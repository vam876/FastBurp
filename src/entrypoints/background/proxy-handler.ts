import { ProxySettings, ProxyProtocol } from '../popup/services/proxy-service';

// 存储键
export const PROXY_STORAGE_KEYS = {
  PROXY_SETTINGS: 'proxySettings',
  PROXY_STATE: 'proxyState' // 代理状态追踪
};

// 默认代理设置
export const DEFAULT_PROXY_SETTINGS: ProxySettings = {
  enabled: false,
  host: '127.0.0.1',
  port: 8080,
  protocol: ProxyProtocol.HTTP,
  bypassList: ['localhost', '127.0.0.1'],
  requireAuth: false
};

// 代理状态接口
interface ProxyState {
  isOurProxyActive: boolean; // 是否是我们的插件设置的代理
  lastSetTime: number; // 最后设置时间
  originalSettings: any | null; // 原始代理设置(用于恢复)
}

// 加载代理设置
export async function loadProxySettings(): Promise<ProxySettings> {
  try {
    const result = await chrome.storage.local.get(PROXY_STORAGE_KEYS.PROXY_SETTINGS);
    return result[PROXY_STORAGE_KEYS.PROXY_SETTINGS] || DEFAULT_PROXY_SETTINGS;
  } catch (error) {
    console.error('加载代理设置失败:', error);
    return DEFAULT_PROXY_SETTINGS;
  }
}

// 检查URL是否应该绕过代理
function shouldBypassProxy(url: string, bypassList: string[]): boolean {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;
    
    return bypassList.some(rule => {
      if (rule === hostname) return true;
      if (rule.startsWith('*.') && hostname.endsWith(rule.slice(1))) return true;
      return false;
    });
  } catch {
    return false;
  }
}

// 保存代理状态
async function saveProxyState(state: ProxyState): Promise<void> {
  try {
    await chrome.storage.local.set({ [PROXY_STORAGE_KEYS.PROXY_STATE]: state });
  } catch (error) {
    console.error('保存代理状态失败:', error);
  }
}

// 加载代理状态
async function loadProxyState(): Promise<ProxyState> {
  try {
    const result = await chrome.storage.local.get(PROXY_STORAGE_KEYS.PROXY_STATE);
    return result[PROXY_STORAGE_KEYS.PROXY_STATE] || {
      isOurProxyActive: false,
      lastSetTime: 0,
      originalSettings: null
    };
  } catch (error) {
    console.error('加载代理状态失败:', error);
    return {
      isOurProxyActive: false,
      lastSetTime: 0,
      originalSettings: null
    };
  }
}

// 获取当前Chrome代理设置
async function getChromeProxySettings(): Promise<any> {
  try {
    if (typeof chrome === 'undefined' || !chrome.proxy || !chrome.proxy.settings) {
      return null;
    }
    
    return new Promise((resolve) => {
      chrome.proxy.settings.get({ incognito: false }, (details) => {
        if (chrome.runtime.lastError) {
          console.warn('获取代理设置失败:', chrome.runtime.lastError);
          resolve(null);
        } else {
          resolve(details);
        }
      });
    });
  } catch (error) {
    console.error('获取Chrome代理设置失败:', error);
    return null;
  }
}

// 设置Chrome系统代理 (改进版 - 保存原始设置)
async function setChromeProxy(proxySettings: ProxySettings): Promise<void> {
  try {
    // 检查chrome.proxy API是否可用
    if (typeof chrome === 'undefined' || !chrome.proxy || !chrome.proxy.settings) {
      return;
    }

    const state = await loadProxyState();

    if (!proxySettings.enabled) {
      // 只有当代理是我们设置的时候才清除
      if (state.isOurProxyActive) {
        try {
          // 如果有原始设置,恢复它;否则清除
          if (state.originalSettings && state.originalSettings.value) {
            await chrome.proxy.settings.set({
              value: state.originalSettings.value,
              scope: 'regular'
            });
            console.log('[FastBurp Proxy] 已恢复原始代理设置');
          } else {
            await chrome.proxy.settings.clear({ scope: 'regular' });
            console.log('[FastBurp Proxy] 已清除代理设置');
          }
          
          // 更新状态
          await saveProxyState({
            isOurProxyActive: false,
            lastSetTime: Date.now(),
            originalSettings: null
          });
        } catch (error) {
          console.warn('[FastBurp Proxy] 清除代理失败:', error);
        }
      }
      return;
    }

    // 启用代理 - 先保存当前设置
    const currentSettings = await getChromeProxySettings();
    
    // 检查当前是否已经有其他代理在运行
    if (currentSettings && 
        currentSettings.levelOfControl !== 'controlled_by_this_extension' &&
        currentSettings.value && 
        currentSettings.value.mode !== 'direct' &&
        currentSettings.value.mode !== 'system') {
      // 保存当前设置以便后续恢复
      if (!state.isOurProxyActive) {
        state.originalSettings = currentSettings;
        console.log('[FastBurp Proxy] 已保存其他代理设置,禁用时将恢复');
      }
    }

    // 构建代理配置
    const config = {
      mode: 'fixed_servers',
      rules: {
        singleProxy: {
          scheme: proxySettings.protocol,
          host: proxySettings.host,
          port: proxySettings.port
        },
        bypassList: proxySettings.bypassList
      }
    };

    // 应用代理设置
    await chrome.proxy.settings.set({
      value: config,
      scope: 'regular'
    });

    // 更新状态
    await saveProxyState({
      isOurProxyActive: true,
      lastSetTime: Date.now(),
      originalSettings: state.originalSettings
    });

    console.log(`[FastBurp Proxy] 代理已启用: ${proxySettings.protocol}://${proxySettings.host}:${proxySettings.port}`);
  } catch (error) {
    console.error('[FastBurp Proxy] 设置失败:', error);
    throw error;
  }
}

// 检查Chrome代理API权限
export function checkProxyPermissions(): void {
  if (typeof chrome !== 'undefined' && chrome.proxy && chrome.proxy.settings) {
    console.log('[FastBurp Proxy] 代理API可用 ✓');
  } else {
    console.warn('[FastBurp Proxy] 代理API不可用');
  }
}


// 应用代理设置到请求（使用Chrome系统代理）
export async function applyProxyToRequest(
  requestId: string,
  request: any,
  tabId: number
): Promise<boolean> {
  try {
    const proxySettings = await loadProxySettings();
    const state = await loadProxyState();
    
    // 如果代理未启用，确保Chrome系统代理被清除
    if (!proxySettings.enabled) {
      if (state.isOurProxyActive) {
        await setChromeProxy(proxySettings);
      }
      return false;
    }
    
    // 检查是否应该绕过代理
    if (shouldBypassProxy(request.url, proxySettings.bypassList)) {
      return false;
    }
    
    // 启用代理 - 设置Chrome系统代理(首次)
    if (!state.isOurProxyActive) {
      await setChromeProxy(proxySettings);
    }
    
    // 返回false让Chrome自动使用系统代理处理
    return false;
  } catch (error) {
    console.error('[FastBurp Proxy] 应用失败:', error);
    return false;
  }
}

// 测试代理连接
export async function testProxyConnection(proxySettings: ProxySettings): Promise<{
  success: boolean;
  message: string;
  responseTime?: number;
}> {
  if (!proxySettings.enabled) {
    return {
      success: false,
      message: '代理未启用'
    };
  }
  
  const startTime = Date.now();
  
  try {
    // 设置Chrome系统代理
    await setChromeProxy(proxySettings);
    
    // 检查代理是否设置成功
    const currentProxy = await getChromeProxySettings();
    if (currentProxy && currentProxy.value && currentProxy.value.mode === 'fixed_servers') {
      const responseTime = Date.now() - startTime;
      return {
        success: true,
        message: `Chrome系统代理设置成功 - 响应时间: ${responseTime}ms`,
        responseTime
      };
    } else {
      return {
        success: false,
        message: 'Chrome系统代理设置失败'
      };
    }
  } catch (error) {
    const responseTime = Date.now() - startTime;
    return {
      success: false,
      message: error instanceof Error ? error.message : '代理设置失败',
      responseTime
    };
  }
}

// 清除代理设置
export async function clearProxySettings(): Promise<void> {
  try {
    const state = await loadProxyState();
    
    // 只有当代理是我们设置的时候才清除
    if (state.isOurProxyActive && typeof chrome !== 'undefined' && chrome.proxy && chrome.proxy.settings) {
      try {
        // 如果有原始设置,恢复它;否则清除
        if (state.originalSettings && state.originalSettings.value) {
          await chrome.proxy.settings.set({
            value: state.originalSettings.value,
            scope: 'regular'
          });
        } else {
          await chrome.proxy.settings.clear({ scope: 'regular' });
        }
        
        // 更新状态
        await saveProxyState({
          isOurProxyActive: false,
          lastSetTime: Date.now(),
          originalSettings: null
        });
      } catch (error) {
        console.warn('[FastBurp Proxy] 清除失败:', error);
      }
    }
    
    // 清除存储的设置
    await chrome.storage.local.remove(PROXY_STORAGE_KEYS.PROXY_SETTINGS);
  } catch (error) {
    console.error('[FastBurp Proxy] 清除设置失败:', error);
  }
}

// 强制清除Chrome系统代理
export async function forceClearChromeProxy(): Promise<void> {
  try {
    if (typeof chrome !== 'undefined' && chrome.proxy && chrome.proxy.settings) {
      await chrome.proxy.settings.clear({ scope: 'regular' });
      
      // 更新状态
      await saveProxyState({
        isOurProxyActive: false,
        lastSetTime: Date.now(),
        originalSettings: null
      });
      
      console.log('[FastBurp Proxy] 已强制清除');
    }
  } catch (error) {
    console.error('[FastBurp Proxy] 强制清除失败:', error);
  }
}

// 监听代理设置变化(用于检测其他插件的代理修改)
export function watchProxyChanges(callback: (details: any) => void): void {
  if (typeof chrome !== 'undefined' && chrome.proxy && chrome.proxy.settings && chrome.proxy.settings.onChange) {
    chrome.proxy.settings.onChange.addListener(async (details) => {
      const state = await loadProxyState();
      
      // 如果变化不是由我们的插件引起的,更新我们的状态
      if (details.levelOfControl !== 'controlled_by_this_extension' && state.isOurProxyActive) {
        console.log('[FastBurp Proxy] 检测到其他程序修改代理,已更新状态');
        await saveProxyState({
          isOurProxyActive: false,
          lastSetTime: Date.now(),
          originalSettings: null
        });
      }
      
      if (callback) {
        callback(details);
      }
    });
  }
}
