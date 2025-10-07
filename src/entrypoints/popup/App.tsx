import { useState, useEffect, useMemo, createRef, RefObject, useCallback } from 'react';
import browser from 'webextension-polyfill';
import './App.css';
import './styles/TabSelector.css';
import { 
    FiPlay, FiRefreshCw, FiTrash2, FiSearch, FiChevronLeft, FiChevronRight, 
    FiFilter, FiCheckCircle, FiPauseCircle, FiLoader, FiChevronsRight, FiAlertTriangle,
    FiEye, FiPlus, FiX, FiSettings, FiMessageCircle, FiClock, FiGithub, FiServer,
    FiActivity, FiCode, FiList
} from 'react-icons/fi';

// 导入新的AI组件
import AIChatDialog from './components/AIChatDialog';
import AIManager from './components/AIManager';
import { aiService } from './services/ai-service';

// 导入正则和代理组件
import RegexManager from './components/RegexManager';
import ProxySettings from './components/ProxySettings';
import { regexService } from './services/regex-service';
import { proxyService } from './services/proxy-service';

// 导入指纹识别组件
import { FingerprintDetector } from './components/FingerprintDetector';

// 导入编码解码组件
import EncoderDecoder from './components/EncoderDecoder';

interface InterceptedRequest {
  id: string;
  tabId: number;
  requestId: string;
  request: {
    url: string;
    method: string;
    headers?: Record<string, string>; // 添加请求头字段
  };
  rawRequest: string;
  rawResponse?: string;
  status: 'paused' | 'finished'; // 'pending' is no longer needed
  isRedirect: boolean;
  requestHeaders?: { name: string; value: string }[]; // 添加结构化请求头
  responseHeaders?: { name: string; value: string }[]; // 添加结构化响应头
}

type FilterType = 'all' | 'finished' | 'paused';
type ModeType = 'intercept' | 'proxy'; // 新增模式类型

type TabType = 'requests' | 'fingerprint' | 'regex' | 'proxy' | 'encoder';

function App() {
  const [isEnabled, setIsEnabled] = useState(false);
  const [mode, setMode] = useState<ModeType>('intercept'); // 新增模式状态
  const [requests, setRequests] = useState<InterceptedRequest[]>([]);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [requestText, setRequestText] = useState(''); // Bring back the separate state for the editor
  const [filter, setFilter] = useState<FilterType>('all');
  
  // **New**: State for method filter
  const [methodFilter, setMethodFilter] = useState<string>('ALL');
  
  const [pendingRequestIds, setPendingRequestIds] = useState<Set<string>>(new Set());
  const [replayingId, setReplayingId] = useState<string | null>(null);
  
  // 搜索相关状态
  const [searchQuery, setSearchQuery] = useState('');
  const [searchInputValue, setSearchInputValue] = useState(''); // 新增：输入框的值
  const [isRegex, setIsRegex] = useState(false);
  const [filterToMatches, setFilterToMatches] = useState(false);
  const [searchMatches, setSearchMatches] = useState<number[]>([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(-1);
  const [isSearching, setIsSearching] = useState(false); // 新增：标记是否正在搜索
  
  // 标签页切换状态
  const [activeTab, setActiveTab] = useState<TabType>('requests');
  
  // 响应文本元素的引用，用于滚动定位
  const responseBodyRef = createRef<HTMLDivElement>();
  const [requestHeaders, setRequestHeaders] = useState<{ name: string; value: string }[]>([]);
  const [showHeadersEditor, setShowHeadersEditor] = useState(false);
  
  // 选中的请求
  const selectedRequest = requests.find(r => r.id === selectedRequestId) || null;

  // AI相关状态
  const [showAIDialog, setShowAIDialog] = useState(false);
  const [showAIManager, setShowAIManager] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true); // 默认使用深色模式
  
  // 响应大小检查状态
  const [isResponseTooLarge, setIsResponseTooLarge] = useState(false);
  const [responseSize, setResponseSize] = useState(0);
  const [responseSizeLimit, setResponseSizeLimit] = useState(10000);
  const [showResponseWarning, setShowResponseWarning] = useState(false); // 控制是否显示警告
  
  // 添加可拖动分隔线状态
  const [leftPanelWidth, setLeftPanelWidth] = useState(35); // 左侧面板宽度百分比
  const [isDragging, setIsDragging] = useState(false);
  
  useEffect(() => {
    browser.runtime.sendMessage({ action: 'get-initial-requests' });

    const handleMessage = (message: any) => {
      if (message.action === 'update-requests') {
        setRequests(message.data || []);
        // When the list updates, it means any pending actions are now complete
        setPendingRequestIds(new Set());
        setReplayingId(null);
      }
    };
    browser.runtime.onMessage.addListener(handleMessage);

    // 获取初始状态
    browser.storage.local.get(['networkInterceptorEnabled', 'networkInterceptorMode']).then((result) => {
        setIsEnabled(!!result.networkInterceptorEnabled);
        setMode(result.networkInterceptorMode || 'intercept');
    });

    return () => {
      browser.runtime.onMessage.removeListener(handleMessage);
    };
  }, []); // Run only once on mount

  // 添加拖拽处理函数
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDoubleClick = useCallback(() => {
    // 双击重置到默认宽度
    setLeftPanelWidth(35);
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;
    
    const container = document.querySelector('.main-content') as HTMLElement;
    if (!container) return;
    
    const containerRect = container.getBoundingClientRect();
    const newWidth = ((e.clientX - containerRect.left) / containerRect.width) * 100;
    
    // 限制最小和最大宽度，确保URL能够完整显示
    const clampedWidth = Math.max(25, Math.min(70, newWidth));
    setLeftPanelWidth(clampedWidth);
  }, [isDragging]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // 检查选中请求的响应大小
  useEffect(() => {
    const checkResponseSize = async () => {
      if (!selectedRequest) {
        setIsResponseTooLarge(false);
        setResponseSize(0);
        setShowResponseWarning(false); // 清除警告显示
        return;
      }

      try {
        // 加载AI设置
        const aiSettings = await aiService.loadSettings();
        setResponseSizeLimit(aiSettings.maxResponseSize);
        
        // 检查响应大小
        const responseData = selectedRequest.rawResponse || '';
        const responseLength = responseData.length;
        setResponseSize(responseLength);
        
        if (responseLength > aiSettings.maxResponseSize) {
          console.log(`响应数据过大: ${responseLength} 字符，超过限制: ${aiSettings.maxResponseSize} 字符`);
          setIsResponseTooLarge(true);
        } else {
          setIsResponseTooLarge(false);
          setShowResponseWarning(false); // 响应正常时清除警告
        }
      } catch (err) {
        console.error('检查响应大小失败:', err);
        setIsResponseTooLarge(false);
        setShowResponseWarning(false);
      }
    };

    checkResponseSize();
  }, [selectedRequest]);

  // 自动隐藏警告的定时器
  useEffect(() => {
    if (showResponseWarning) {
      const timer = setTimeout(() => {
        setShowResponseWarning(false);
      }, 5000); // 5秒后自动隐藏

      return () => clearTimeout(timer);
    }
  }, [showResponseWarning]);

  // 处理重放逻辑
  const handleReplay = async () => {
    if (!selectedRequest) return;
    setPendingRequestIds(prev => new Set(prev).add(selectedRequest.id));
    setReplayingId(selectedRequest.id);
    setShowResponseWarning(false); // 重放时清除警告
    
    try {
      // 直接使用fetch发送请求，不依赖background脚本
      const parsedRequest = parseRawRequest(requestText);
      const url = parsedRequest.url;
      const method = parsedRequest.method;
      
      // 构建请求选项
      const fetchOptions: RequestInit = {
        method: method,
        headers: headersArrayToObject(requestHeaders),
        credentials: 'include',
        // 如果有请求体且不是GET或HEAD请求，添加请求体
        ...(parsedRequest.postData && !['GET', 'HEAD'].includes(method) ? { body: parsedRequest.postData } : {})
      };
      
      // 发送请求
      const response = await fetch(url, fetchOptions);
      
      // 处理响应
      const responseHeaders: { name: string; value: string }[] = [];
      response.headers.forEach((value, name) => {
        responseHeaders.push({ name, value });
      });
      
      const responseText = await response.text();
      let rawResponse = `HTTP/1.1 ${response.status} ${response.statusText}\r\n`;
      response.headers.forEach((value, name) => {
        rawResponse += `${name}: ${value}\r\n`;
      });
      rawResponse += `\r\n${responseText}`;
      
      // 更新请求状态
      const updatedRequests = requests.map(r => {
        if (r.id === selectedRequest.id) {
          return {
            ...r,
            status: 'finished' as const,
            rawResponse,
            responseHeaders
          };
        }
        return r;
      });
      
      setRequests(updatedRequests);
      
    } catch (error) {
      // 更新请求状态为失败
      const updatedRequests = requests.map(r => {
        if (r.id === selectedRequest.id) {
          return {
            ...r,
            status: 'finished' as const,
            rawResponse: `重放请求失败: ${error instanceof Error ? error.message : String(error)}`
          };
        }
        return r;
      });
      
      setRequests(updatedRequests);
    } finally {
      setPendingRequestIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(selectedRequest.id);
        return newSet;
      });
      setReplayingId(null);
    }
  };
  
  // 解析请求头数组为对象
  const headersArrayToObject = (headers: { name: string; value: string }[]): Record<string, string> => {
    const result: Record<string, string> = {};
    headers.forEach(h => {
      if (h.name && h.value) {
        result[h.name] = h.value;
      }
    });
    return result;
  };
  
  // 解析原始请求
  const parseRawRequest = (rawRequest: string) => {
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
  };

  // AI分析请求
  const analyzeRequest = async () => {
    if (!selectedRequest) return;
    
    // 如果响应过大，显示警告并打开设置
    if (isResponseTooLarge) {
      setShowResponseWarning(true); // 显示警告
      setTimeout(() => {
        alert(`响应数据过大 (${responseSize.toLocaleString()}/${responseSizeLimit.toLocaleString()} 字符)，无法进行AI分析。请调整AI设置中的最大响应大小限制。`);
        handleOpenAISettings();
      }, 100);
      return;
    }
    
    try {
      // 加载AI设置以获取最大响应大小限制
      const aiSettings = await aiService.loadSettings();
      const maxResponseSize = aiSettings.maxResponseSize;
      
      // 检查响应大小是否超过限制
      const responseData = selectedRequest.rawResponse || '';
      
      // 打开AI对话框
      setShowAIDialog(true);
      
      // 打印日志，帮助调试
      if (responseData.length > maxResponseSize) {
        console.log(`响应数据过大: ${responseData.length} 字符，超过限制: ${maxResponseSize} 字符`);
      }
    } catch (err) {
      console.error('AI分析前检查响应大小失败:', err);
      // 即使检查失败，也尝试打开对话框，让组件内部处理错误
      if (selectedRequest.id) {
        setShowAIDialog(true);
      }
    }
  };
  
  // 处理聊天历史选择
  const handleSelectChat = (requestId: string) => {
    // 找到对应的请求
    const request = requests.find(r => r.id === requestId);
    if (request) {
      setSelectedRequestId(request.id);
      setShowAIDialog(true);
      setShowAIManager(false);
    } else {
      // 如果在当前请求列表中找不到该ID的请求，可能是因为已被清除
      // 从历史记录中删除该聊天
      aiService.deleteChatHistory(requestId).catch(err => 
        console.error('删除无效聊天历史失败:', err)
      );
      alert('找不到对应的请求记录，可能已被清除');
    }
  };
  
  // 关闭AI对话框
  const handleCloseAIDialog = () => {
    setShowAIDialog(false);
  };
  
  // 打开AI管理器到设置标签
  const handleOpenAISettings = () => {
    setShowAIManager(true);
    // 使用setTimeout确保DOM元素已经渲染
    setTimeout(() => {
      const settingsTab = document.querySelector('.ai-tab-button:nth-child(1)');
      if (settingsTab instanceof HTMLElement) {
        settingsTab.click();
      }
    }, 0);
  };
  
  // 打开AI管理器到历史标签
  const handleOpenAIHistory = () => {
    setShowAIManager(true);
    // 使用setTimeout确保DOM元素已经渲染
    setTimeout(() => {
      const historyTab = document.querySelector('.ai-tab-button:nth-child(2)');
      if (historyTab instanceof HTMLElement) {
        historyTab.click();
      }
    }, 0);
  };
  
  // 关闭AI管理器
  const handleCloseAIManager = () => {
    setShowAIManager(false);
  };

  // 在独立窗口打开程序
  const handleOpenInNewWindow = () => {
    const popupURL = chrome.runtime.getURL('/popup.html?standalone=true');
    
    // 尝试使用chrome.windows.create打开独立窗口
    chrome.windows.create({
      url: popupURL,
      type: 'popup',
      width: 800,
      height: 600,
      focused: true
    }, () => {
      if (chrome.runtime.lastError) {
        console.error('打开独立窗口失败:', chrome.runtime.lastError);
        // 回退到普通window.open方式
        globalThis.window.open(popupURL, '_blank', 'width=800,height=600,popup');
      }
    });
  };

  // 检查是否是独立窗口模式
  const [isStandalone, setIsStandalone] = useState(false);
  
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const standalone = urlParams.get('standalone') === 'true';
    setIsStandalone(standalone);
    
    if (standalone) {
      // 独立窗口模式下可以做一些特殊处理
      document.title = '网络请求分析工具';
    }
  }, []);

  const handleToggle = () => {
    const newState = !isEnabled;
    setIsEnabled(newState); // Provide immediate UI feedback
    browser.storage.local.set({ networkInterceptorEnabled: newState });
    // 移除清空请求的代码，关闭开关时保留数据
    // if (!newState) {
    //   browser.runtime.sendMessage({ action: 'clear-requests' });
    //   setRequests([]);
    //   setSelectedRequestId(null);
    // }
  };

  // 处理模式切换
  const handleModeChange = (newMode: ModeType) => {
    setMode(newMode);
    browser.storage.local.set({ networkInterceptorMode: newMode });
    // 通知后台脚本模式已更改
    browser.runtime.sendMessage({ action: 'set-mode', mode: newMode });
  };

  const handleRequestTextChange = (newText: string) => {
    if (!selectedRequest) return;
    const nextRequests = requests.map(r => 
      r.id === selectedRequestId ? { ...r, rawRequest: newText } : r
    );
    setRequests(nextRequests);
  };

  const handleSelectRequest = (req: InterceptedRequest) => {
    setSelectedRequestId(req.id);
    // This is the ONLY place where we override the user's edits.
    setRequestText(req.rawRequest);
    // 设置请求头
    setRequestHeaders(req.requestHeaders || []);
    // 清除搜索状态
    setSearchInputValue('');
    setSearchQuery('');
    setSearchMatches([]);
    setCurrentMatchIndex(-1);
  };

  // 处理请求头编辑
  const handleHeaderNameChange = (index: number, value: string) => {
    const newHeaders = [...requestHeaders];
    newHeaders[index] = { ...newHeaders[index], name: value };
    setRequestHeaders(newHeaders);
  };

  const handleHeaderValueChange = (index: number, value: string) => {
    const newHeaders = [...requestHeaders];
    newHeaders[index] = { ...newHeaders[index], value };
    setRequestHeaders(newHeaders);
  };

  const addHeader = () => {
    setRequestHeaders([...requestHeaders, { name: '', value: '' }]);
  };

  const removeHeader = (index: number) => {
    const newHeaders = [...requestHeaders];
    newHeaders.splice(index, 1);
    setRequestHeaders(newHeaders);
  };

  const handleResume = () => {
    if (!selectedRequest || selectedRequest.status !== 'paused') return;
    setPendingRequestIds(prev => new Set(prev).add(selectedRequest.id));
    browser.runtime.sendMessage({
      action: 'resume-request',
      requestData: selectedRequest,
      rawRequest: requestText, // Send the edited text from the editor state
      headers: requestHeaders, // 发送编辑后的请求头
    });
  };
  
  const isActionInProgress = replayingId !== null;
  const isSelectedPending = selectedRequest ? pendingRequestIds.has(selectedRequest.id) : false;

  const handleClearAll = () => {
    // 清除请求前先备份所有ID，以便后续清理无效的聊天历史
    const requestIds = requests.map(req => req.id);
    
    browser.runtime.sendMessage({ action: 'clear-requests' });
    setRequests([]);
    setSelectedRequestId(null);
    
    // 不清空聊天历史，只发送清除请求
    // aiService.clearAllChatHistory()
    //   .then(() => console.log('所有聊天历史已清空'))
    //   .catch(err => console.error('清空聊天历史失败:', err));
  };

  // Extract unique request methods for the filter buttons
  const availableMethods = useMemo(() => {
    const methods = new Set(requests.map(r => r.request.method.toUpperCase()));
    return ['ALL', ...Array.from(methods)];
  }, [requests]);
  
  // **Updated**: Filtering logic now includes method filter
  const filteredRequests = useMemo(() => {
    return requests.filter(req => {
      const statusMatch = (filter === 'all') || (req.status === filter);
      const methodMatch = (methodFilter === 'ALL') || (req.request.method.toUpperCase() === methodFilter);
      return statusMatch && methodMatch;
    });
  }, [requests, filter, methodFilter]);

  // 响应文本值
  const responseTextValue = useMemo(() => {
    if (!selectedRequest) return '';
    if (pendingRequestIds.has(selectedRequest.id) || replayingId === selectedRequest.id) {
        return '正在等待响应...';
    } else if (selectedRequest.status === 'finished') {
        return selectedRequest.rawResponse || '响应体为空';
    } else {
        return '请求尚未放行...';
    }
  }, [selectedRequest, pendingRequestIds, replayingId]);

  // 优化的搜索函数 - 使用Web Worker来提高性能
  const performSearch = useCallback((query: string, text: string, useRegex: boolean) => {
    if (!query || !text) {
      setSearchMatches([]);
      setCurrentMatchIndex(-1);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);

    // 使用requestAnimationFrame来避免阻塞UI
    requestAnimationFrame(() => {
      try {
        const startTime = performance.now();
        
        // 对于大文本，分块处理以避免阻塞UI
        const chunkSize = 10000; // 每次处理10000个字符
        const textLength = text.length;
        const chunks = Math.ceil(textLength / chunkSize);
        
        let allMatches: number[] = [];
        const regex = new RegExp(useRegex ? query : query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), useRegex ? 'g' : 'gi');
        
        // 分块处理搜索
        const processChunk = (chunkIndex: number) => {
          if (chunkIndex >= chunks) {
            // 所有块处理完毕
            const endTime = performance.now();
            console.log(`搜索耗时: ${endTime - startTime}ms, 找到 ${allMatches.length} 个匹配`);
            
            setSearchMatches(allMatches);
            setCurrentMatchIndex(allMatches.length > 0 ? 0 : -1);
            setIsSearching(false);
            return;
          }
          
          const start = chunkIndex * chunkSize;
          const end = Math.min(start + chunkSize, textLength);
          const chunk = text.substring(start, end);
          
          // 为了处理跨块的匹配，我们需要重叠一部分
          const overlap = query.length;
          const searchText = chunkIndex > 0 
            ? text.substring(Math.max(0, start - overlap), end)
            : chunk;
          
          // 重置正则表达式的lastIndex
          regex.lastIndex = 0;
          
          let match;
          while ((match = regex.exec(searchText)) !== null) {
            // 计算实际位置（考虑重叠部分）
            const actualIndex = chunkIndex > 0 
              ? start - overlap + match.index 
              : match.index;
            
            // 只添加有效范围内的匹配
            if (actualIndex >= 0 && actualIndex < textLength) {
              allMatches.push(actualIndex);
            }
            
            // 防止无限循环
            if (match.index === regex.lastIndex) {
              regex.lastIndex++;
            }
          }
          
          // 使用setTimeout处理下一个块，避免长时间阻塞UI
          setTimeout(() => processChunk(chunkIndex + 1), 0);
        };
        
        // 开始处理第一个块
        processChunk(0);
        
      } catch (e) {
        // 无效的正则表达式
        console.error('搜索错误:', e);
        setSearchMatches([]);
        setCurrentMatchIndex(-1);
        setIsSearching(false);
      }
    });
  }, []);

  // 处理搜索按钮点击
  const handleSearchClick = () => {
    setSearchQuery(searchInputValue);
    performSearch(searchInputValue, responseTextValue, isRegex);
  };
  
  // 处理搜索导航
  const handleSearchNav = (direction: 'next' | 'prev') => {
    if (searchMatches.length === 0) return;
    
    let nextIndex = currentMatchIndex + (direction === 'next' ? 1 : -1);
    if (nextIndex >= searchMatches.length) nextIndex = 0;
    if (nextIndex < 0) nextIndex = searchMatches.length - 1;
    setCurrentMatchIndex(nextIndex);
    
    // 滚动到当前匹配项
    scrollToMatch(nextIndex);
  };

  // 滚动到指定匹配项的函数
  const scrollToMatch = (index: number) => {
    if (index < 0 || !responseBodyRef.current || !searchMatches[index]) return;
    
    const matchPosition = searchMatches[index];
    const matchElement = document.getElementById(`match-${index}`);
    
    if (matchElement) {
      matchElement.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
    }
  };
  
  // 获取元素内的所有文本节点
  const getAllTextNodes = (element: HTMLElement): Text[] => {
    const textNodes: Text[] = [];
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null);
    
    let node;
    while (node = walker.nextNode()) {
      textNodes.push(node as Text);
    }
    
    return textNodes;
  };
  
  // 渲染响应内容，高亮匹配项
  const renderedResponse = useMemo(() => {
    if (!responseTextValue) return [{ type: 'text' as const, content: '' }];
    if (searchQuery.length === 0) return [{ type: 'text' as const, content: responseTextValue }];

    try {
      const regex = new RegExp(isRegex ? searchQuery : searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), isRegex ? 'g' : 'gi');
      const parts: { type: 'text' | 'match'; content: string; index?: number }[] = [];
      let lastIndex = 0;
      let match;
      let matchCount = 0;

      // 优化：对于大文本，只渲染可见区域附近的匹配项
      const maxRenderChars = 100000; // 最大渲染字符数
      
      if (responseTextValue.length > maxRenderChars && filterToMatches) {
        // 如果文本很大且只显示匹配项，我们只渲染匹配项及其周围的一些上下文
        searchMatches.forEach((matchPos, idx) => {
          const contextSize = 100; // 匹配项前后显示的字符数
          const start = Math.max(0, matchPos - contextSize);
          const end = Math.min(responseTextValue.length, matchPos + searchQuery.length + contextSize);
          
          if (idx > 0 && start > searchMatches[idx-1] + searchQuery.length + contextSize) {
            parts.push({ type: 'text', content: '...' });
          }
          
          // 添加匹配前的上下文
          if (start < matchPos) {
            parts.push({ type: 'text', content: responseTextValue.substring(start, matchPos) });
          }
          
          // 添加匹配项
          parts.push({ 
            type: 'match', 
            content: responseTextValue.substring(matchPos, matchPos + searchQuery.length), 
            index: idx 
          });
          
          // 添加匹配后的上下文
          if (matchPos + searchQuery.length < end) {
            parts.push({ type: 'text', content: responseTextValue.substring(matchPos + searchQuery.length, end) });
          }
        });
      } else {
        // 对于较小的文本或需要显示完整内容时，使用正常的渲染方式
        while ((match = regex.exec(responseTextValue)) !== null) {
          // 添加匹配前的文本
          if (match.index > lastIndex) {
            parts.push({ type: 'text', content: responseTextValue.substring(lastIndex, match.index) });
          }
          
          // 添加匹配的文本，并记录它是第几个匹配
          parts.push({ 
            type: 'match', 
            content: match[0], 
            index: matchCount++ 
          });
          
          lastIndex = regex.lastIndex;
          
          // 防止无限循环
          if (match.index === regex.lastIndex) {
            regex.lastIndex++;
          }
        }

        // 添加最后一个匹配后的文本
        if (lastIndex < responseTextValue.length) {
          parts.push({ type: 'text', content: responseTextValue.substring(lastIndex) });
        }
      }
      
      return parts;
    } catch (e) {
      return [{ type: 'text' as const, content: responseTextValue }];
    }
  }, [searchQuery, responseTextValue, isRegex, searchMatches, filterToMatches]);

  // 当当前匹配索引变化时，滚动到匹配项
  useEffect(() => {
    if (currentMatchIndex >= 0) {
      scrollToMatch(currentMatchIndex);
    }
  }, [currentMatchIndex]);

  return (
    <div className={`app ${isStandalone ? 'standalone-mode' : ''}`}>
      <div className="app-container">
        <div className="header">
          <h1>FastBurp - API调试工具 V1.1.6</h1>
          <a 
                href="https://github.com/vam876" 
                target="_blank" 
                rel="noopener noreferrer" 
                title="GitHub" 
                className="icon-only-button github-link"
              >
                <FiGithub size={16} />
              </a>
          <div className="header-controls">
              <div className="mode-selector">
                <button 
                  className={mode === 'intercept' ? 'active' : ''} 
                  onClick={() => handleModeChange('intercept')}
                  title="拦截模式：暂停请求并允许修改"
                >
                  <FiPauseCircle size={14} />
                  <span>拦截模式</span>
                </button>
                <button 
                  className={mode === 'proxy' ? 'active' : ''} 
                  onClick={() => handleModeChange('proxy')}
                  title="代理模式：不拦截请求，仅记录流量"
                >
                  <FiEye size={14} />
                  <span>代理模式</span>
                </button>
              </div>
              <label className="switch">
                  <input type="checkbox" checked={isEnabled} onChange={handleToggle} />
                  <span className="slider round"></span>
              </label>
              <button onClick={handleClearAll} disabled={!isEnabled}>
                  <FiTrash2 size={14} />
                  <span>清除</span>
              </button>
              <button onClick={handleOpenAISettings} title="AI设置" className="icon-only-button">
                  <FiSettings size={16} />
              </button>
              <button 
                onClick={handleOpenAIHistory} 
                title="聊天历史" 
                className="icon-only-button"
              >
                  <FiClock size={16} />
              </button>
              <button onClick={handleOpenInNewWindow} title="在独立窗口打开" className="icon-only-button">
                  <FiPlus size={16} />
              </button>
           
          </div>
        </div>
        
        <div className="tab-selector">
          <button 
            className={activeTab === 'requests' ? 'active' : ''}
            onClick={() => setActiveTab('requests')}
            title="请求列表"
          >
            <FiActivity size={16} />
            <span>请求分析</span>
          </button>
          <button 
            className={activeTab === 'regex' ? 'active' : ''}
            onClick={() => setActiveTab('regex')}
            title="正则规则管理"
          >
            <FiFilter size={16} />
            <span>正则规则</span>
          </button>
          <button 
            className={activeTab === 'proxy' ? 'active' : ''}
            onClick={() => setActiveTab('proxy')}
            title="代理设置"
          >
            <FiServer size={16} />
            <span>代理设置</span>
          </button>
                     <button 
             className={activeTab === 'fingerprint' ? 'active' : ''}
             onClick={() => setActiveTab('fingerprint')}
             title="指纹识别"
           >
             <FiCode size={16} />
             <span>指纹识别</span>
           </button>
           <button 
             className={activeTab === 'encoder' ? 'active' : ''}
             onClick={() => setActiveTab('encoder')}
             title="编码解码工具"
           >
             <FiCode size={16} />
             <span>编码解码</span>
           </button>
        </div>
        
        {activeTab === 'requests' ? (
          <div className={`main-content ${isDragging ? 'dragging' : ''}`}>
            <div 
              className="request-list-panel"
              style={{ width: `${leftPanelWidth}%` }}
            >
              {/* 请求列表面板内容 */}
              <div className="filter-tabs">
                <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>
                    <FiFilter size={14} /><span>全部</span>
                </button>
                <button className={filter === 'finished' ? 'active' : ''} onClick={() => setFilter('finished')}>
                    <FiCheckCircle size={14} /><span>已放行</span>
                </button>
                <button className={filter === 'paused' ? 'active' : ''} onClick={() => setFilter('paused')}>
                    <FiPauseCircle size={14} /><span>未放行</span>
                </button>
              </div>
              
              {/* Method filter bar */}
              <div className="method-filter-tabs">
                {availableMethods.map(method => (
                  <button 
                    key={method}
                    className={methodFilter === method ? 'active' : ''}
                    onClick={() => setMethodFilter(method)}
                  >
                    {method}
                  </button>
                ))}
              </div>
    
              <div className="request-list">
                {filteredRequests.map((req) => {
                  const isPending = pendingRequestIds.has(req.id);
                  return (
                    <div
                      key={req.id}
                      className={`request-item ${selectedRequestId === req.id ? 'selected' : ''}`}
                      onClick={() => handleSelectRequest(req)}
                    >
                      {req.isRedirect && <span className="redirect-icon"><FiChevronsRight /></span>}
                      <span className={`method ${req.request.method.toLowerCase()}`}>{req.request.method}</span>
                      <span className="url" title={req.request.url}>{req.request.url}</span>
                      <span className={`status ${req.status}`}>
                        {isPending ? <FiLoader className="spinning" /> : 
                         replayingId === req.id ? <FiLoader className="spinning" /> : 
                         req.status === 'paused' ? <FiAlertTriangle /> : <FiCheckCircle />}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
            
            {/* 可拖动的分隔线 */}
            <div 
              className={`resize-handle ${isDragging ? 'dragging' : ''}`}
              onMouseDown={handleMouseDown}
              onDoubleClick={handleDoubleClick}
              style={{ cursor: 'col-resize' }}
              title="拖动调整宽度，双击重置"
            />
            
            <div 
              className="details-panel"
              style={{ width: `${100 - leftPanelWidth}%` }}
            >
              <div className="request-panel">
                <div className="panel-header">
                    <h3>请求</h3>
                    <div className="panel-actions">
                        <button 
                            onClick={() => setShowHeadersEditor(!showHeadersEditor)}
                            title={showHeadersEditor ? "隐藏请求头" : "需在这里编辑，Cookie不能修改"}
                        >
                            <FiEye size={14} />
                            <span>{showHeadersEditor ? "隐藏请求头" : "编辑请求头"}</span>
                        </button>
                        <button 
                            onClick={handleReplay}
                            disabled={!selectedRequest || isActionInProgress || isSelectedPending}
                        >
                            <FiRefreshCw size={14} className={replayingId === selectedRequest?.id ? 'spinning' : ''} />
                            <span>{replayingId === selectedRequest?.id ? '重放中...' : '重放'}</span>
                        </button>
                        <button 
                            onClick={handleResume} 
                            disabled={!selectedRequest || selectedRequest.status !== 'paused' || isActionInProgress || isSelectedPending || mode === 'proxy'}
                        >
                            <FiPlay size={14} />
                            <span>放行</span>
                        </button>
                        <button
                            onClick={analyzeRequest}
                            disabled={!selectedRequest}
                            title="AI分析请求"
                            className="ai-analyze-button"
                        >
                            <FiMessageCircle size={14} />
                            <span>AI分析</span>
                        </button>
                    </div>
                </div>
                
                {showHeadersEditor && selectedRequest && (
                  <div className="headers-editor">
                    <div className="headers-list">
                      {requestHeaders.map((header, index) => (
                        <div key={index} className="header-item">
                          <input 
                            type="text"
                            placeholder="名称"
                            value={header.name} 
                            onChange={(e) => handleHeaderNameChange(index, e.target.value)}
                            disabled={pendingRequestIds.has(selectedRequest.id) || isActionInProgress}
                          />
                          <input 
                            type="text"
                            placeholder="值"
                            value={header.value} 
                            onChange={(e) => handleHeaderValueChange(index, e.target.value)}
                            disabled={pendingRequestIds.has(selectedRequest.id) || isActionInProgress}
                          />
                          <button 
                            onClick={() => removeHeader(index)}
                            disabled={pendingRequestIds.has(selectedRequest.id) || isActionInProgress}
                            title="删除此请求头"
                          >
                            <FiX size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                    <button 
                      className="add-header-button"
                      onClick={addHeader}
                      disabled={pendingRequestIds.has(selectedRequest.id) || isActionInProgress}
                    >
                      <FiPlus size={14} />
                      <span>添加请求头</span>
                    </button>
                  </div>
                )}
                
                <textarea
                  value={requestText}
                  onChange={(e) => setRequestText(e.target.value)}
                  disabled={!selectedRequest || pendingRequestIds.has(selectedRequest.id) || isActionInProgress}
                />
              </div>
              <div className="response-panel">
                <div className="panel-header">
                    <h3>响应</h3>
                    
                    {/* 响应大小提示 */}
                    {showResponseWarning && isResponseTooLarge && selectedRequest && (
                      <div className="response-size-warning">
                        <FiAlertTriangle size={14} />
                        <span>响应过大 ({responseSize.toLocaleString()}/{responseSizeLimit.toLocaleString()})</span>
                        <button 
                          onClick={handleOpenAISettings}
                          className="warning-settings-button"
                          title="调整AI设置"
                        >
                          <FiSettings size={12} />
                        </button>
                      </div>
                    )}
                    
                    <div className="search-controls">
                        <div className="search-input-wrapper">
                            <input 
                                type="text" 
                                placeholder="搜索响应内容..."
                                value={searchInputValue}
                                onChange={e => setSearchInputValue(e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') {
                                    handleSearchClick();
                                  }
                                }}
                            />
                            <button 
                              className="search-button" 
                              onClick={handleSearchClick}
                              disabled={isSearching || !searchInputValue.trim()}
                              title="搜索"
                            >
                              {isSearching ? <FiLoader className="spinning" size={14} /> : <FiSearch size={14} />}
                            </button>
                        </div>
                        <button 
                          onClick={() => handleSearchNav('prev')} 
                          disabled={searchMatches.length === 0}
                          title="上一个匹配项"
                        >
                          <FiChevronLeft/>
                        </button>
                        <button 
                          onClick={() => handleSearchNav('next')} 
                          disabled={searchMatches.length === 0}
                          title="下一个匹配项"
                        >
                          <FiChevronRight/>
                        </button>
                        <label className="regex-label" title="使用正则表达式搜索">
                            <input type="checkbox" checked={isRegex} onChange={e => setIsRegex(e.target.checked)} />
                            <span>正则</span>
                        </label>
                        <label className="regex-label" title="只显示匹配的内容">
                            <input type="checkbox" checked={filterToMatches} onChange={e => setFilterToMatches(e.target.checked)} />
                            <span>仅匹配</span>
                        </label>
                        {searchMatches.length > 0 && (
                          <span className="match-count">
                            {currentMatchIndex + 1}/{searchMatches.length}
                          </span>
                        )}
                    </div>
                </div>
                <div className="response-body" ref={responseBodyRef}>
                    {renderedResponse.map((part, i) => {
                        if (part.type === 'match') {
                            return (
                                <mark 
                                  key={i} 
                                  className={part.index === currentMatchIndex ? 'current' : ''}
                                  id={`match-${part.index}`}
                                >
                                    {part.content}
                                </mark>
                            );
                        }
                        return filterToMatches ? null : <span key={i}>{part.content}</span>;
                    })}
                </div>
              </div>
            </div>
          </div>
                 ) : activeTab === 'fingerprint' ? (
           <FingerprintDetector darkMode={isDarkMode} />
         ) : activeTab === 'regex' ? (
           <RegexManager darkMode={isDarkMode} />
         ) : activeTab === 'proxy' ? (
           <ProxySettings darkMode={isDarkMode} />
         ) : activeTab === 'encoder' ? (
           <EncoderDecoder />
         ) : null}
        
        {/* AI对话框 */}
        {showAIDialog && selectedRequest && (
          <AIChatDialog
            requestId={selectedRequest.id}
            requestData={selectedRequest.rawRequest}
            responseData={selectedRequest.rawResponse || ''}
            onClose={handleCloseAIDialog}
            darkMode={isDarkMode}
          />
        )}
        
        {/* AI管理器 */}
        {showAIManager && (
          <div className="ai-manager-overlay" onClick={handleCloseAIManager}>
            <div className="ai-manager-container" onClick={e => e.stopPropagation()}>
              <AIManager
                darkMode={isDarkMode}
                onSelectChat={handleSelectChat}
                onClose={handleCloseAIManager}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;

