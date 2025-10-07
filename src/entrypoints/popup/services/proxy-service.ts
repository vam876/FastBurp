import browser from 'webextension-polyfill';

// 存储键
export const PROXY_STORAGE_KEYS = {
  PROXY_SETTINGS: 'proxySettings'
};

// 代理协议类型
export enum ProxyProtocol {
  HTTP = 'http',
  HTTPS = 'https',
  SOCKS4 = 'socks4',
  SOCKS5 = 'socks5'
}

// 代理设置接口
export interface ProxySettings {
  enabled: boolean;
  host: string;
  port: number;
  protocol: ProxyProtocol;
  bypassList: string[]; // 不经过代理的域名列表
  username?: string;    // 代理认证用户名（可选）
  password?: string;    // 代理认证密码（可选）
  requireAuth: boolean; // 是否需要认证
}

// 默认代理设置
export const DEFAULT_PROXY_SETTINGS: ProxySettings = {
  enabled: false,
  host: '127.0.0.1',
  port: 8080,
  protocol: ProxyProtocol.HTTP,
  bypassList: ['localhost', '127.0.0.1'],
  requireAuth: false
};

// 代理服务类
export class ProxyService {
  // 加载代理设置
  async loadSettings(): Promise<ProxySettings> {
    try {
      const result = await browser.storage.local.get(PROXY_STORAGE_KEYS.PROXY_SETTINGS);
      return result[PROXY_STORAGE_KEYS.PROXY_SETTINGS] || DEFAULT_PROXY_SETTINGS;
    } catch (error) {
      return DEFAULT_PROXY_SETTINGS;
    }
  }
  
  // 保存代理设置
  async saveSettings(settings: ProxySettings): Promise<void> {
    try {
      await browser.storage.local.set({ [PROXY_STORAGE_KEYS.PROXY_SETTINGS]: settings });
      
      // 通知后台脚本更新代理设置
      await browser.runtime.sendMessage({
        action: 'update-proxy-settings',
        settings
      });
    } catch (error) {
      throw error;
    }
  }
  
  // 测试代理连接
  async testProxyConnection(settings: ProxySettings): Promise<{
    success: boolean;
    message: string;
    responseTime?: number;
  }> {
    try {
      // 发送测试请求到后台脚本
      const startTime = Date.now();
      const response = await browser.runtime.sendMessage({
        action: 'test-proxy-connection',
        settings
      });
      const endTime = Date.now();
      
      if (response && response.success) {
        return {
          success: true,
          message: '代理连接成功',
          responseTime: endTime - startTime
        };
      } else {
        return {
          success: false,
          message: response?.message || '代理连接失败'
        };
      }
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : '测试代理连接失败'
      };
    }
  }
  
  // 检查URL是否应该绕过代理
  shouldBypassProxy(url: string, bypassList: string[]): boolean {
    if (!url || bypassList.length === 0) return false;
    
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname;
      
      return bypassList.some(pattern => {
        // 精确匹配
        if (pattern === hostname) return true;
        
        // 域名后缀匹配（如 .example.com）
        if (pattern.startsWith('.') && hostname.endsWith(pattern)) return true;
        
        // 通配符匹配（如 *.example.com）
        if (pattern.startsWith('*.')) {
          const domain = pattern.substring(2);
          return hostname === domain || hostname.endsWith('.' + domain);
        }
        
        return false;
      });
    } catch (error) {
      return false;
    }
  }
  
  // 构建代理URL
  buildProxyUrl(settings: ProxySettings): string {
    if (!settings.enabled) return '';
    
    let url = `${settings.protocol}://`;
    
    if (settings.requireAuth && settings.username) {
      url += `${encodeURIComponent(settings.username)}`;
      if (settings.password) {
        url += `:${encodeURIComponent(settings.password)}`;
      }
      url += '@';
    }
    
    url += `${settings.host}:${settings.port}`;
    return url;
  }
}

export const proxyService = new ProxyService();
