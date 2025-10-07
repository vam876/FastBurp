import browser from 'webextension-polyfill';
import { applyProxyToRequest, checkProxyPermissions, watchProxyChanges, forceClearChromeProxy } from './background/proxy-handler';
import { 
  processUrl, 
  processRequestHeaders, 
  processRequestBody,
  processResponseHeaders,
  processResponseBody
} from './background/regex-handler';
import { FingerprintService } from './popup/services/fingerprint-service';

function parseRawRequest(rawRequest: string) {
  const lines = rawRequest.replace(/\r/g, '').split('\n');
  const firstLine = lines.shift() || '';
  const [method, url] = firstLine.split(' ');
  
  const headers: { name: string; value: string }[] = [];
  let body;
  let isHeaderSection = true;

  for (const line of lines) {
    if (isHeaderSection && line === '') {
      isHeaderSection = false;
      continue;
    }
    if (isHeaderSection) {
      const parts = line.split(': ');
      if (parts.length === 2) {
        headers.push({ name: parts[0], value: parts[1] });
      }
    } else {
      body = (body ? body + '\n' : '') + line;
    }
  }
  return { method, url, headers, postData: body };
}

// Helper to parse charset from Content-Type header
const getCharset = (headers: {name: string, value: string}[]): string => {
    const contentType = headers.find(h => h.name.toLowerCase() === 'content-type');
    if (contentType) {
        const match = contentType.value.match(/charset=([^;]+)/);
        if (match) return match[1].trim();
    }
    return 'utf-8'; // Default to utf-8
};

// 将请求头数组转换为对象
const headersArrayToObject = (headers: { name: string; value: string }[]): Record<string, string> => {
  const result: Record<string, string> = {};
  
  headers.forEach(h => {
    // 保持原始大小写，同时添加小写版本作为备用
    result[h.name] = h.value;
    result[h.name.toLowerCase()] = h.value;
  });
  
  return result;
};

export default defineBackground(() => {
  // 检查代理权限
  checkProxyPermissions();
  
  // 监听代理设置变化
  watchProxyChanges(() => {});
  
  // 监听插件禁用/卸载事件,确保清除代理
  if (chrome.management) {
    chrome.management.getSelf((info) => {
      const extensionId = info.id;
      const checkInterval = setInterval(async () => {
        try {
          await chrome.management.get(extensionId);
        } catch (error) {
          clearInterval(checkInterval);
          try {
            await forceClearChromeProxy();
          } catch (e) {
            // 静默处理
          }
        }
      }, 5000);
    });
  }

  let isEnabled = false;
  let mode: 'intercept' | 'proxy' = 'intercept';
  let requestsStore: any[] = [];
  const attachedTabs = new Map<number, string>();
  const version = '1.3';
  const pendingActions = new Set<string>();
  
  // Updated maps to handle the replay-via-debugger flow, now with timeout IDs
  // 更新replayDataStore的类型定义
  const replayDataStore = new Map<string, { 
    originalId: string, 
    replayId: string, // 添加replayId字段
    headers: any[], 
    postData?: string, 
    timeoutId: ReturnType<typeof setTimeout> 
  }>();
  const replayIdToOriginalIdMap = new Map<string, string>(); // Maps new requestId to original request's ID

  // API请求白名单，这些URL不会被拦截
  let apiWhitelist: string[] = [];

  function updateBadge(enabled: boolean) {
    if (enabled) {
      browser.action.setBadgeText({ text: 'ON' });
      browser.action.setBadgeBackgroundColor({ color: mode === 'proxy' ? '#2196F3' : '#4CAF50' }); // 代理模式为蓝色，拦截模式为绿色
    } else {
      browser.action.setBadgeText({ text: '' });
    }
  }

  async function attachDebugger(tabId: number) {
    if (attachedTabs.has(tabId)) return;
    
    try {
      await chrome.debugger.attach({ tabId }, version);
      attachedTabs.set(tabId, version);
      await chrome.debugger.sendCommand({ tabId }, 'Fetch.enable', {
        patterns: [{ 
            requestStage: 'Request',
            resourceType: 'Document'
        }, { 
            requestStage: 'Request',
            resourceType: 'XHR'
        },{
            requestStage: 'Response',
            resourceType: 'Document'
        }, {
            requestStage: 'Response',
            resourceType: 'XHR'
        }],
      });
    } catch (error: any) {
      attachedTabs.delete(tabId);
      if (error.message.includes('another debugger')) {
        browser.notifications.create(`attach-fail-${tabId}`, {
          type: 'basic',
          iconUrl: 'icon/128.png',
          title: '附加调试器失败',
          message: `无法附加到标签页 ${tabId}。请确保该标签页未打开开发者工具(F12)。`,
        });
      }
    }
  }

  async function detachDebugger(tabId: number) {
    if (!attachedTabs.has(tabId)) return;
    try {
      await chrome.debugger.detach({ tabId });
    } catch (error) {
      // 静默处理
    } finally {
      attachedTabs.delete(tabId);
    }
  }

  async function toggleAllTabs(shouldEnable: boolean) {
    isEnabled = shouldEnable;
    updateBadge(isEnabled);
    const tabs = await browser.tabs.query({ url: ['http://*/*', 'https://*/*'] });
    for (const tab of tabs) {
      if (tab.id) {
        if (shouldEnable) {
          await attachDebugger(tab.id);
        } else {
          await detachDebugger(tab.id);
        }
      }
    }
  }
  
  // Initialization logic
  async function initialize() {
    const result = await browser.storage.local.get(['networkInterceptorEnabled', 'networkInterceptorMode', 'aiApiEndpoint']);
    isEnabled = !!result.networkInterceptorEnabled;
    mode = result.networkInterceptorMode || 'intercept';
    updateBadge(isEnabled);
    
    // 添加API端点到白名单
    if (result.aiApiEndpoint) {
      try {
        const url = new URL(result.aiApiEndpoint);
        apiWhitelist = [url.origin];
      } catch (e) {
        // 静默处理
      }
    }
    
    if (isEnabled) {
      await toggleAllTabs(true);
    }
  }

  initialize();
  
  const broadcastRequestsUpdate = () => {
    browser.runtime.sendMessage({
      action: 'update-requests',
      data: requestsStore,
    }).catch(() => { /* Ignore errors */ });
  };
  
  // 使用webRequest API监听请求(静默)

  // 监听请求头发送前
  browser.webRequest.onBeforeSendHeaders.addListener(
    (details) => {
      // 查找是否有对应的请求正在等待修改
      const requestIndex = requestsStore.findIndex(r => 
        r.request.url === details.url && 
        r.status === 'paused' &&
        r.tabId === details.tabId
      );
      
      if (requestIndex !== -1 && details.requestHeaders) {
        // 存储原始请求头以供UI显示和编辑
        const formattedHeaders = details.requestHeaders.map(h => ({
          name: h.name,
          value: h.value?.toString() || ''
        }));
        
        requestsStore[requestIndex].requestHeaders = formattedHeaders;
        broadcastRequestsUpdate();
      }
      
      return { requestHeaders: details.requestHeaders };
    },
    { urls: ["<all_urls>"] },
    ["requestHeaders"]
  );

  // 监听响应头
  browser.webRequest.onHeadersReceived.addListener(
    (details) => {
      // 查找对应的请求
      const requestIndex = requestsStore.findIndex(r => 
        r.request.url === details.url && 
        r.tabId === details.tabId
      );
      
      if (requestIndex !== -1 && details.responseHeaders) {
        // 存储响应头
        const formattedHeaders = details.responseHeaders.map(h => ({
          name: h.name,
          value: h.value?.toString() || ''
        }));
        
        requestsStore[requestIndex].responseHeaders = formattedHeaders;
        
        // 指纹识别检测 (异步执行，不阻塞响应)
        const fingerprintService = new FingerprintService();
        fingerprintService.detectHTTPFingerprints({
          url: details.url,
          responseHeaders: headersArrayToObject(formattedHeaders),
          responseBody: '', // 响应体需要在其他地方获取
        }).then(fingerprints => {
          if (fingerprints.length > 0) {
            console.log(`检测到 ${fingerprints.length} 个指纹:`, fingerprints);
            // 保存指纹结果
            return fingerprintService.saveFingerprintResult({
              url: details.url,
              timestamp: Date.now(),
              fingerprints,
              summary: {
                total: fingerprints.length,
                byType: {
                  framework: 0,
                  server: 0,
                  cms: 0,
                  cdn: 0,
                  security: 0,
                  social: 0,
                  advertising: 0,
                  utility: 0,
                  technology: 0,
                  component: 0,
                  os: 0
                },
                byRisk: {
                  low: 0,
                  medium: 0,
                  high: 0,
                  critical: 0
                }
              }
            });
          }
        }).catch(error => {
          console.error('指纹检测失败:', error);
        });
        
        broadcastRequestsUpdate();
      }
      
      return { responseHeaders: details.responseHeaders };
    },
    { urls: ["<all_urls>"] },
    ["responseHeaders"]
  );
  
  // onEvent listener: Now updates in-memory store and broadcasts
  chrome.debugger.onEvent.addListener(async (source, method, params?: any) => {
    if (method !== 'Fetch.requestPaused' || !source.tabId) return;

    const { requestId, request, responseStatusCode, responseHeaders, networkId, redirectResponse } = params;
    
    // 确保requestId有效
    if (!requestId) {
      console.warn('Received event with invalid requestId', params);
      return;
    }

    // 检查是否为白名单URL
    const isWhitelisted = apiWhitelist.some(whitelistedUrl => request.url.startsWith(whitelistedUrl));
    if (isWhitelisted) {
      console.log('Allowing whitelisted request:', request.url);
      try {
        await chrome.debugger.sendCommand({ tabId: source.tabId }, 'Fetch.continueRequest', { requestId });
      } catch (e) {
        console.error('Failed to continue whitelisted request:', e);
      }
      return;
    }

    const replayId = request.headers['X-Replay-Id'];
    if (replayId && replayDataStore.has(replayId)) {
        const replayData = replayDataStore.get(replayId)!;
        
        // **Fix**: Clear the timeout as soon as the replay is successfully intercepted.
        clearTimeout(replayData.timeoutId);
        replayDataStore.delete(replayId);

        replayIdToOriginalIdMap.set(requestId, replayData.originalId);
        pendingActions.add(replayData.originalId);

        try {
            await chrome.debugger.sendCommand(
                { tabId: source.tabId },
                'Fetch.continueRequest',
                {
                    requestId: requestId,
                    headers: replayData.headers,
                    postData: replayData.postData ? btoa(unescape(encodeURIComponent(replayData.postData))) : undefined
                }
            );
        } catch(e) {
            console.error('Failed to continue replay request:', e);
            replayIdToOriginalIdMap.delete(requestId);
            pendingActions.delete(replayData.originalId);
        }
        return;
    }

    const originalRequestIdForUpdate = replayIdToOriginalIdMap.get(requestId);
    const uniqueId = originalRequestIdForUpdate || networkId || `${source.tabId}-${requestId}`;
    
    const existingRequestIndex = requestsStore.findIndex(r => r.id === uniqueId);

    // 检查是否需要应用代理设置
    if (!responseHeaders && !redirectResponse) { // 只在初始请求阶段检查代理
      try {
        console.log('检查代理设置，请求URL:', request.url);
        const proxyApplied = await applyProxyToRequest(requestId, request, source.tabId);
        if (proxyApplied) {
          console.log(`请求 ${requestId} 已通过代理处理`);
          return; // 代理已处理，不需要继续
        } else {
          console.log(`请求 ${requestId} 使用原始请求处理`);
        }
      } catch (error) {
        console.error('应用代理设置失败:', error);
        // 代理处理失败，继续使用原始请求
      }
    }

    if (responseHeaders) { // Stage 3: Response received
        if (existingRequestIndex !== -1) {
            // We have the headers, now get the body.
            // We call this and immediately continue the request. We don't wait for the body to be read.
            try {
                const response = await chrome.debugger.sendCommand(
                    { tabId: source.tabId }, 'Fetch.getResponseBody', { requestId }
                ) as { body: string; base64Encoded: boolean };

                let responseBodyText = '';
                if (response.body) {
                    const charset = getCharset(responseHeaders);
                    if (response.base64Encoded) {
                      const binaryString = atob(response.body);
                      const bytes = new Uint8Array(binaryString.length);
                      for (let i = 0; i < binaryString.length; i++) {
                        bytes[i] = binaryString.charCodeAt(i);
                      }
                      responseBodyText = new TextDecoder(charset).decode(bytes);
                    } else {
                      responseBodyText = new TextDecoder(charset).decode(new TextEncoder().encode(response.body));
                    }
                }

                // 应用正则过滤到响应头
                const processedResponseHeaders = await processResponseHeaders(responseHeaders, request.url, requestId);
                
                // 应用正则过滤到响应体
                const processedResponseBody = await processResponseBody(responseBodyText, request.url, requestId);
                
                let rawResponse = `HTTP/1.1 ${responseStatusCode}\r\n`;
                processedResponseHeaders.forEach((h: any) => rawResponse += `${h.name}: ${h.value}\r\n`);
                rawResponse += `\r\n${processedResponseBody}`;

                requestsStore[existingRequestIndex].rawResponse = rawResponse;
                requestsStore[existingRequestIndex].status = 'finished';
                requestsStore[existingRequestIndex].responseHeaders = processedResponseHeaders.map((h: any) => ({ name: h.name, value: h.value }));
            } catch (e: any) {
                requestsStore[existingRequestIndex].rawResponse = `Error getting response body: ${e.message}`;
                requestsStore[existingRequestIndex].status = 'finished';
            } finally {
                pendingActions.delete(uniqueId);
                replayIdToOriginalIdMap.delete(requestId);
                broadcastRequestsUpdate();
            }

            // 使用try-catch包裹，防止继续请求失败
            try {
                await chrome.debugger.sendCommand({ tabId: source.tabId }, 'Fetch.continueRequest', { requestId });
            } catch (e) {
                console.error(`Failed to continue response request ${requestId}:`, e);
            }
        }
    } else { // Stage 1: Initial request (not a replay)
        // This part should not be triggered by our replay requests because of the early return
        if (existingRequestIndex !== -1) {
            // 如果请求已存在，更新请求ID以确保后续操作使用最新的ID
            requestsStore[existingRequestIndex].requestId = requestId;
            return;
        }
        
        // 应用正则过滤到URL
        const processedUrl = await processUrl(request.url, requestId);
        
        let rawRequest = `${request.method} ${processedUrl} HTTP/1.1\r\n`;
        const requestHeaders: { name: string; value: string }[] = [];
        
        // 应用正则过滤到请求头
        for (const [key, value] of Object.entries(request.headers)) {
          const vStr = String(value);
          const processedValue = await processRequestHeaders([{ name: key, value: vStr }], request.url, requestId);
          const processedHeader = processedValue[0];
          rawRequest += `${processedHeader.name}: ${processedHeader.value}\r\n`;
          requestHeaders.push(processedHeader);
        }
        
        // 应用正则过滤到请求体
        let processedPostData = request.postData;
        if (request.postData) {
          processedPostData = await processRequestBody(request.postData, request.url, requestId);
          rawRequest += `\r\n${processedPostData}`;
        }
        const requestStatus = mode === 'proxy' ? 'finished' : 'paused';
        const newRequest = {
          id: uniqueId, tabId: source.tabId, requestId: requestId, request: request,
          rawRequest: rawRequest, status: requestStatus, isRedirect: !!redirectResponse,
          requestHeaders: requestHeaders,
        };
        requestsStore.push(newRequest);
        broadcastRequestsUpdate();
        if (mode === 'proxy') {
          // 使用try-catch包裹，防止继续请求失败
          try {
              await chrome.debugger.sendCommand({ tabId: source.tabId }, 'Fetch.continueRequest', { requestId });
          } catch (e) {
              console.error(`Failed to continue proxy request ${requestId}:`, e);
              // 更新请求状态
              const index = requestsStore.findIndex(r => r.id === uniqueId);
              if (index !== -1) {
                  requestsStore[index].status = 'finished';
                  requestsStore[index].rawResponse = `继续请求失败: ${e instanceof Error ? e.message : JSON.stringify(e)}`;
                  broadcastRequestsUpdate();
              }
          }
        }
    }
  });

  // 监听存储变化，更新白名单
  browser.storage.onChanged.addListener(async (changes, area) => {
    if (area === 'local') {
      if (changes.networkInterceptorEnabled) {
        const { newValue } = changes.networkInterceptorEnabled;
        toggleAllTabs(!!newValue);
        
        // 关闭代理时，将所有未放行的请求状态改为已放行
        if (!newValue) {
          const pausedRequests = requestsStore.filter(req => req.status === 'paused');
          if (pausedRequests.length > 0) {
            pausedRequests.forEach(req => {
              req.status = 'finished';
              req.rawResponse = '代理已关闭，请求自动放行';
            });
            broadcastRequestsUpdate();
          }
        }
      }
      if (changes.networkInterceptorMode) {
        mode = changes.networkInterceptorMode.newValue;
        updateBadge(isEnabled); // 更新徽章颜色
      }
      if (changes.aiApiEndpoint) {
        try {
          const url = new URL(changes.aiApiEndpoint.newValue);
          apiWhitelist = [url.origin];
        } catch (e) {
          // 静默处理
        }
      }
      // 监听代理设置变化
      if (changes.proxySettings) {
        const newSettings = changes.proxySettings.newValue;
        
        // 如果代理被禁用,确保清除Chrome系统代理
        if (newSettings && !newSettings.enabled) {
          try {
            await forceClearChromeProxy();
          } catch (error) {
            // 静默处理
          }
        }
      }
    }
  });

   browser.tabs.onCreated.addListener(async (tab) => {
    if (isEnabled && tab.id) {
      await attachDebugger(tab.id);
    }
  });

  browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (isEnabled && changeInfo.url && tab.url) {
      if (!attachedTabs.has(tabId)) {
        await attachDebugger(tabId);
      }
    }
  });

  browser.tabs.onRemoved.addListener((tabId) => {
    if (attachedTabs.has(tabId)) {
      detachDebugger(tabId);
    }
  });
  
  chrome.debugger.onDetach.addListener((source: chrome.debugger.Debuggee) => {
    if (source.tabId && attachedTabs.has(source.tabId)) {
      attachedTabs.delete(source.tabId);
    }
  });

  // 监听插件关闭事件
  browser.runtime.onSuspend.addListener(async () => {
    requestsStore = [];
    
    // 清除我们设置的代理
    try {
      await forceClearChromeProxy();
    } catch (error) {
      // 静默处理
    }
  });

  // onMessage listener: Handles UI commands
  browser.runtime.onMessage.addListener(async (message: any) => {
    const { action, requestData, rawRequest, headers } = message;

    if (action === 'get-initial-requests') {
        broadcastRequestsUpdate();
    } else if (action === 'resume-request' && requestData) {
        if (pendingActions.has(requestData.id)) return true;
        pendingActions.add(requestData.id);
        
        // 找到请求在requestsStore中的索引
        const requestIndex = requestsStore.findIndex(r => r.id === requestData.id);
        
        try {
            // 检查请求是否已经超时或无效
            if (requestIndex === -1 || !requestData.requestId) {
                throw new Error('请求已失效或超时');
            }
            
            // 尝试放行请求
            try {
                await chrome.debugger.sendCommand(
                    { tabId: requestData.tabId }, 'Fetch.continueRequest',
                    { 
                        requestId: requestData.requestId,
                        headers: headers || parseRawRequest(rawRequest).headers
                    }
                );
                
                // 放行成功，更新请求状态
                if (requestIndex !== -1) {
                    requestsStore[requestIndex].status = 'finished';
                    broadcastRequestsUpdate();
                }
            } catch (e) {
                // 处理特定的InterceptionId错误
                const errorStr = e instanceof Error ? e.message : JSON.stringify(e);
                console.error(`Failed to continue request ${requestData.id}:`, errorStr);
                
                if (errorStr.includes('Invalid InterceptionId') || errorStr.includes('-32602')) {
                    // 这是一个已知的错误，请求可能已经超时或被自动处理
                    if (requestIndex !== -1) {
                        requestsStore[requestIndex].status = 'finished';
                        requestsStore[requestIndex].rawResponse = '请求已自动完成或超时';
                        broadcastRequestsUpdate();
                    }
                } else {
                    // 其他类型的错误
                    if (requestIndex !== -1) {
                        requestsStore[requestIndex].status = 'finished';
                        requestsStore[requestIndex].rawResponse = `放行失败: ${errorStr}`;
                        broadcastRequestsUpdate();
                    }
                }
            }
        } catch (e) {
            console.error(`处理请求 ${requestData.id} 时出错:`, e);
            
            // 即使处理失败，也更新请求状态为已完成
            if (requestIndex !== -1) {
                requestsStore[requestIndex].status = 'finished';
                requestsStore[requestIndex].rawResponse = `处理失败: ${e instanceof Error ? e.message : JSON.stringify(e)}`;
                broadcastRequestsUpdate();
            }
        } finally {
            pendingActions.delete(requestData.id);
        }
    } else if (action === 'replay-request' && requestData) {
        if (pendingActions.has(requestData.id)) return true;
        
        // 将请求标记为处理中
        pendingActions.add(requestData.id);
        
        const replayId = `${Date.now()}-${Math.random()}`;
        const { url, method, postData } = parseRawRequest(rawRequest);
        
        // 获取请求头
        const requestHeaders = headers || [];
        
        // 创建一个新的请求对象，用于显示在UI中
        const replayRequestId = `replay-${Date.now()}`;
        const replayRequest = {
            id: replayRequestId,
            tabId: requestData.tabId,
            requestId: `replay-${requestData.requestId}`,
            request: {
                url,
                method,
                headers: headersArrayToObject(requestHeaders)
            },
            rawRequest: rawRequest,
            status: 'finished' as const, // 直接标记为已完成，而不是暂停
            isRedirect: false,
            requestHeaders: requestHeaders
        };
        
        // 将重放请求添加到请求列表
        requestsStore.push(replayRequest);
        
        const cleanupReplayState = (updateUI = false, response?: string) => {
            const data = replayDataStore.get(replayId);
            if (data) {
                clearTimeout(data.timeoutId);
                replayDataStore.delete(replayId);
                
                // 如果需要更新UI，则更新重放请求的响应
                if (updateUI) {
                    const requestIndex = requestsStore.findIndex(r => r.id === replayRequestId);
                    if (requestIndex !== -1) {
                        requestsStore[requestIndex].rawResponse = response || '重放请求超时或失败';
                        broadcastRequestsUpdate();
                    }
                }
            }
            
            // 清除pendingActions
            pendingActions.delete(requestData.id);
        };

        // 增加超时时间到30秒，给请求更多处理时间
        const timeoutId = setTimeout(() => {
            console.warn(`Replay ${replayId} timed out and was cleaned up.`);
            cleanupReplayState(true, '重放请求超时'); // 更新UI状态
        }, 30000);

        replayDataStore.set(replayId, {
            originalId: requestData.id,
            replayId: replayRequestId,
            headers: requestHeaders,
            postData: postData,
            timeoutId: timeoutId
        });

        // 使用增强的fetch函数来执行重放
        const executeFetch = (fetchUrl: string, fetchMethod: string, fetchReplayId: string, fetchPostData?: string, fetchHeaders?: Array<{name: string, value: string}>) => {
            // 构建fetch选项
            const fetchOptions: RequestInit = {
                method: fetchMethod,
                headers: {
                    'X-Replay-Id': fetchReplayId,
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache',
                    'Expires': '0'
                },
                credentials: 'include' // 包含cookie
            };
            
            // 添加自定义请求头
            if (fetchHeaders && fetchHeaders.length > 0) {
                const headerObj = fetchOptions.headers as Record<string, string>;
                fetchHeaders.forEach(h => {
                    // 跳过某些特殊的头部
                    if (!['content-length', 'host'].includes(h.name.toLowerCase())) {
                        headerObj[h.name] = h.value;
                    }
                });
            }
            
            // 添加请求体
            if (fetchPostData && ['POST', 'PUT', 'PATCH'].includes(fetchMethod.toUpperCase())) {
                fetchOptions.body = fetchPostData;
            }
            
            // 执行fetch请求
            fetch(fetchUrl, fetchOptions)
                .then(async response => {
                    try {
                        // 获取响应文本
                        const responseText = await response.text();
                        
                        // 构建响应头字符串
                        let responseHeadersText = `HTTP/1.1 ${response.status} ${response.statusText}\r\n`;
                        response.headers.forEach((value, name) => {
                            responseHeadersText += `${name}: ${value}\r\n`;
                        });
                        responseHeadersText += '\r\n';
                        
                        // 完整响应
                        const fullResponse = responseHeadersText + responseText;
                        
                        // 发送消息到background脚本
                        chrome.runtime.sendMessage({
                            action: 'replay-fetch-success',
                            replayId: fetchReplayId,
                            response: fullResponse
                        }).catch(() => {});
                    } catch (e) {
                        chrome.runtime.sendMessage({
                            action: 'replay-fetch-failed',
                            replayId: fetchReplayId,
                            error: e instanceof Error ? e.message : String(e)
                        }).catch(() => {});
                    }
                })
                .catch(e => {
                    console.error(`Injected replay fetch for ${fetchReplayId} failed:`, e);
                    // 在页面上下文中无法直接访问background脚本，
                    // 所以我们发送一个消息通知background脚本处理失败
                    chrome.runtime.sendMessage({
                        action: 'replay-fetch-failed',
                        replayId: fetchReplayId,
                        error: e.message
                    }).catch(() => {});
                });
        };

        const injection = {
            func: executeFetch,
            args: [url, method, replayId, postData, requestHeaders]
        };

        // 立即广播更新，显示重放请求
        broadcastRequestsUpdate();

        (async () => {
            try {
                // First, try to inject into the original tab
                await browser.scripting.executeScript({
                    target: { tabId: requestData.tabId },
                    ...injection
                });
            } catch (e) {
                console.warn(`Injecting script into original tab ${requestData.tabId} failed. Trying active tab.`, e);
                try {
                    // If it fails, find the currently active tab
                    const [activeTab] = await browser.tabs.query({ active: true, currentWindow: true });
                    if (activeTab && activeTab.id) {
                        await browser.scripting.executeScript({
                            target: { tabId: activeTab.id },
                            ...injection
                        });
                    } else {
                        throw new Error("No active tab found to initiate replay.");
                    }
                } catch (e2) {
                    console.error("Failed to inject script into any suitable tab. Aborting replay.", e2);
                    cleanupReplayState(true, '重放失败: 无法注入脚本'); // 更新UI状态
                }
            }
        })();
    } else if (action === 'replay-fetch-success') {
        // 处理重放请求成功的消息
        const { replayId, response } = message;
        if (replayId && replayDataStore.has(replayId)) {
            const data = replayDataStore.get(replayId)!;
            const requestIndex = requestsStore.findIndex(r => r.id === data.replayId);
            if (requestIndex !== -1) {
                requestsStore[requestIndex].rawResponse = response;
                broadcastRequestsUpdate();
            }
            
            // 清理状态
            clearTimeout(data.timeoutId);
            replayDataStore.delete(replayId);
            pendingActions.delete(data.originalId);
        }
    } else if (action === 'replay-fetch-failed') {
        // 处理重放请求失败的消息
        const { replayId, error } = message;
        if (replayId && replayDataStore.has(replayId)) {
            const data = replayDataStore.get(replayId)!;
            const requestIndex = requestsStore.findIndex(r => r.id === data.replayId);
            if (requestIndex !== -1) {
                requestsStore[requestIndex].rawResponse = `重放请求失败: ${error || '未知错误'}`;
                broadcastRequestsUpdate();
            }
            
            // 清理状态
            clearTimeout(data.timeoutId);
            replayDataStore.delete(replayId);
            pendingActions.delete(data.originalId);
        }
    } else if (action === 'clear-requests') {
        requestsStore = [];
        broadcastRequestsUpdate();
    } else if (action === 'set-mode') {
        mode = message.mode;
        updateBadge(isEnabled);
        console.log(`Mode changed to: ${mode}`);
    } else if (action === 'update-proxy-settings') {
        // 更新代理设置
        console.log('收到代理设置更新:', message.settings);
        // 这里可以添加额外的代理设置处理逻辑
    } else if (action === 'test-proxy-connection') {
        // 测试代理连接
        try {
            const { testProxyConnection } = await import('./background/proxy-handler');
            const result = await testProxyConnection(message.settings);
            return result;
        } catch (error) {
            console.error('测试代理连接失败:', error);
            return {
                success: false,
                message: error instanceof Error ? error.message : '测试代理连接失败'
            };
        }
    }
    return true;
  });

  // This function is now OBSOLETE as replay is handled via the debugger
  // async function handleReplayRequest(...) { ... }
  // We can remove it.

});
