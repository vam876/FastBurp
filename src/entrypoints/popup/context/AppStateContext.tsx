import React, { createContext, useContext, useReducer, ReactNode } from 'react';

// 类型定义
export type ModeType = 'intercept' | 'proxy';
export type FilterType = 'all' | 'paused' | 'finished';
export type TabType = 'requests' | 'ai' | 'regex' | 'proxy' | 'fingerprint' | 'encoder';

export interface InterceptedRequest {
  id: string;
  tabId: number;
  requestId: string;
  request: {
    url: string;
    method: string;
    headers?: Record<string, string>;
  };
  rawRequest: string;
  rawResponse?: string;
  status: 'paused' | 'finished';
  isRedirect: boolean;
  requestHeaders?: { name: string; value: string }[];
  responseHeaders?: { name: string; value: string }[];
  hasPostDataIssue?: boolean;
  isFileUpload?: boolean;
  timestamp?: number;
}

// 应用状态接口
export interface AppState {
  // 网络拦截状态
  isEnabled: boolean;
  mode: ModeType;
  requests: InterceptedRequest[];
  selectedRequestId: string | null;
  requestText: string;
  maxRequestsCount: number;
  
  // 过滤和搜索
  filter: FilterType;
  statusFilter: string;
  methodFilter: string;
  searchQuery: string;
  searchInputValue: string;
  isRegex: boolean;
  filterToMatches: boolean;
  searchMatches: number[];
  currentMatchIndex: number;
  isSearching: boolean;
  
  // UI状态
  activeTab: TabType;
  requestHeaders: { name: string; value: string }[];
  showHeadersEditor: boolean;
  
  // AI相关
  showAIDialog: boolean;
  showAIManager: boolean;
  isDarkMode: boolean;
  
  // 响应处理
  isResponseTooLarge: boolean;
  responseSize: number;
  responseSizeLimit: number;
  showResponseWarning: boolean;
  
  // 布局
  leftPanelWidth: number;
  isDragging: boolean;
  
  // 错误处理
  networkError: string | null;
  isReconnecting: boolean;
  lastConnectionCheck: number;
  
  // 请求状态
  pendingRequestIds: Set<string>;
  replayingId: string | null;
  
  // 独立模式
  isStandalone: boolean;
}

// Action类型
export type AppAction =
  | { type: 'SET_ENABLED'; payload: boolean }
  | { type: 'SET_MODE'; payload: ModeType }
  | { type: 'SET_REQUESTS'; payload: InterceptedRequest[] }
  | { type: 'ADD_REQUEST'; payload: InterceptedRequest }
  | { type: 'UPDATE_REQUEST'; payload: { id: string; updates: Partial<InterceptedRequest> } }
  | { type: 'SET_SELECTED_REQUEST_ID'; payload: string | null }
  | { type: 'SET_REQUEST_TEXT'; payload: string }
  | { type: 'SET_MAX_REQUESTS_COUNT'; payload: number }
  | { type: 'SET_FILTER'; payload: FilterType }
  | { type: 'SET_STATUS_FILTER'; payload: string }
  | { type: 'SET_METHOD_FILTER'; payload: string }
  | { type: 'SET_SEARCH_QUERY'; payload: string }
  | { type: 'SET_SEARCH_INPUT_VALUE'; payload: string }
  | { type: 'SET_IS_REGEX'; payload: boolean }
  | { type: 'SET_FILTER_TO_MATCHES'; payload: boolean }
  | { type: 'SET_SEARCH_MATCHES'; payload: number[] }
  | { type: 'SET_CURRENT_MATCH_INDEX'; payload: number }
  | { type: 'SET_IS_SEARCHING'; payload: boolean }
  | { type: 'SET_ACTIVE_TAB'; payload: TabType }
  | { type: 'SET_REQUEST_HEADERS'; payload: { name: string; value: string }[] }
  | { type: 'SET_SHOW_HEADERS_EDITOR'; payload: boolean }
  | { type: 'SET_SHOW_AI_DIALOG'; payload: boolean }
  | { type: 'SET_SHOW_AI_MANAGER'; payload: boolean }
  | { type: 'SET_IS_DARK_MODE'; payload: boolean }
  | { type: 'SET_IS_RESPONSE_TOO_LARGE'; payload: boolean }
  | { type: 'SET_RESPONSE_SIZE'; payload: number }
  | { type: 'SET_RESPONSE_SIZE_LIMIT'; payload: number }
  | { type: 'SET_SHOW_RESPONSE_WARNING'; payload: boolean }
  | { type: 'SET_LEFT_PANEL_WIDTH'; payload: number }
  | { type: 'SET_IS_DRAGGING'; payload: boolean }
  | { type: 'SET_NETWORK_ERROR'; payload: string | null }
  | { type: 'SET_IS_RECONNECTING'; payload: boolean }
  | { type: 'SET_LAST_CONNECTION_CHECK'; payload: number }
  | { type: 'SET_PENDING_REQUEST_IDS'; payload: Set<string> }
  | { type: 'ADD_PENDING_REQUEST_ID'; payload: string }
  | { type: 'REMOVE_PENDING_REQUEST_ID'; payload: string }
  | { type: 'SET_REPLAYING_ID'; payload: string | null }
  | { type: 'SET_IS_STANDALONE'; payload: boolean }
  | { type: 'CLEAR_ALL_REQUESTS' }
  | { type: 'MANAGE_REQUESTS_MEMORY'; payload: InterceptedRequest[] };

// 初始状态
const initialState: AppState = {
  isEnabled: false,
  mode: 'intercept',
  requests: [],
  selectedRequestId: null,
  requestText: '',
  maxRequestsCount: 1000,
  
  filter: 'all',
  statusFilter: 'ALL',
  methodFilter: 'ALL',
  searchQuery: '',
  searchInputValue: '',
  isRegex: false,
  filterToMatches: false,
  searchMatches: [],
  currentMatchIndex: -1,
  isSearching: false,
  
  activeTab: 'requests',
  requestHeaders: [],
  showHeadersEditor: false,
  
  showAIDialog: false,
  showAIManager: false,
  isDarkMode: true,
  
  isResponseTooLarge: false,
  responseSize: 0,
  responseSizeLimit: 10000,
  showResponseWarning: false,
  
  leftPanelWidth: 35,
  isDragging: false,
  
  networkError: null,
  isReconnecting: false,
  lastConnectionCheck: Date.now(),
  
  pendingRequestIds: new Set(),
  replayingId: null,
  
  isStandalone: false,
};

// Reducer函数
function appStateReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_ENABLED':
      return { ...state, isEnabled: action.payload };
    
    case 'SET_MODE':
      return { ...state, mode: action.payload };
    
    case 'SET_REQUESTS':
      return { ...state, requests: action.payload };
    
    case 'ADD_REQUEST':
      return { 
        ...state, 
        requests: [...state.requests, action.payload] 
      };
    
    case 'UPDATE_REQUEST':
      return {
        ...state,
        requests: state.requests.map(req => 
          req.id === action.payload.id 
            ? { ...req, ...action.payload.updates }
            : req
        )
      };
    
    case 'SET_SELECTED_REQUEST_ID':
      return { ...state, selectedRequestId: action.payload };
    
    case 'SET_REQUEST_TEXT':
      return { ...state, requestText: action.payload };
    
    case 'SET_MAX_REQUESTS_COUNT':
      return { ...state, maxRequestsCount: action.payload };
    
    case 'SET_FILTER':
      return { ...state, filter: action.payload };
    
    case 'SET_STATUS_FILTER':
      return { ...state, statusFilter: action.payload };
    
    case 'SET_METHOD_FILTER':
      return { ...state, methodFilter: action.payload };
    
    case 'SET_SEARCH_QUERY':
      return { ...state, searchQuery: action.payload };
    
    case 'SET_SEARCH_INPUT_VALUE':
      return { ...state, searchInputValue: action.payload };
    
    case 'SET_IS_REGEX':
      return { ...state, isRegex: action.payload };
    
    case 'SET_FILTER_TO_MATCHES':
      return { ...state, filterToMatches: action.payload };
    
    case 'SET_SEARCH_MATCHES':
      return { ...state, searchMatches: action.payload };
    
    case 'SET_CURRENT_MATCH_INDEX':
      return { ...state, currentMatchIndex: action.payload };
    
    case 'SET_IS_SEARCHING':
      return { ...state, isSearching: action.payload };
    
    case 'SET_ACTIVE_TAB':
      return { ...state, activeTab: action.payload };
    
    case 'SET_REQUEST_HEADERS':
      return { ...state, requestHeaders: action.payload };
    
    case 'SET_SHOW_HEADERS_EDITOR':
      return { ...state, showHeadersEditor: action.payload };
    
    case 'SET_SHOW_AI_DIALOG':
      return { ...state, showAIDialog: action.payload };
    
    case 'SET_SHOW_AI_MANAGER':
      return { ...state, showAIManager: action.payload };
    
    case 'SET_IS_DARK_MODE':
      return { ...state, isDarkMode: action.payload };
    
    case 'SET_IS_RESPONSE_TOO_LARGE':
      return { ...state, isResponseTooLarge: action.payload };
    
    case 'SET_RESPONSE_SIZE':
      return { ...state, responseSize: action.payload };
    
    case 'SET_RESPONSE_SIZE_LIMIT':
      return { ...state, responseSizeLimit: action.payload };
    
    case 'SET_SHOW_RESPONSE_WARNING':
      return { ...state, showResponseWarning: action.payload };
    
    case 'SET_LEFT_PANEL_WIDTH':
      return { ...state, leftPanelWidth: action.payload };
    
    case 'SET_IS_DRAGGING':
      return { ...state, isDragging: action.payload };
    
    case 'SET_NETWORK_ERROR':
      return { ...state, networkError: action.payload };
    
    case 'SET_IS_RECONNECTING':
      return { ...state, isReconnecting: action.payload };
    
    case 'SET_LAST_CONNECTION_CHECK':
      return { ...state, lastConnectionCheck: action.payload };
    
    case 'SET_PENDING_REQUEST_IDS':
      return { ...state, pendingRequestIds: action.payload };
    
    case 'ADD_PENDING_REQUEST_ID':
      return { 
        ...state, 
        pendingRequestIds: new Set(state.pendingRequestIds).add(action.payload) 
      };
    
    case 'REMOVE_PENDING_REQUEST_ID':
      const newPendingIds = new Set(state.pendingRequestIds);
      newPendingIds.delete(action.payload);
      return { ...state, pendingRequestIds: newPendingIds };
    
    case 'SET_REPLAYING_ID':
      return { ...state, replayingId: action.payload };
    
    case 'SET_IS_STANDALONE':
      return { ...state, isStandalone: action.payload };
    
    case 'CLEAR_ALL_REQUESTS':
      return {
        ...state,
        requests: [],
        selectedRequestId: null,
        pendingRequestIds: new Set(),
        replayingId: null,
      };
    
    case 'MANAGE_REQUESTS_MEMORY':
      const managedRequests = manageRequestsMemory(action.payload, state.maxRequestsCount);
      return { ...state, requests: managedRequests };
    
    default:
      return state;
  }
}

// 内存管理函数
function manageRequestsMemory(requests: InterceptedRequest[], maxCount: number): InterceptedRequest[] {
  if (requests.length <= maxCount) {
    return requests;
  }
  
  // 按时间戳排序，保留最新的请求
  const sortedRequests = [...requests].sort((a, b) => 
    (b.timestamp || 0) - (a.timestamp || 0)
  );
  
  const managedRequests = sortedRequests.slice(0, maxCount);
  
  // 清理24小时前的请求
  const twentyFourHoursAgo = Date.now() - (24 * 60 * 60 * 1000);
  return managedRequests.filter(req => 
    (req.timestamp || Date.now()) > twentyFourHoursAgo
  );
}

// Context
const AppStateContext = createContext<{
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
} | null>(null);

// Provider组件
export const AppStateProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(appStateReducer, initialState);
  
  return (
    <AppStateContext.Provider value={{ state, dispatch }}>
      {children}
    </AppStateContext.Provider>
  );
};

// Hook
export const useAppState = () => {
  const context = useContext(AppStateContext);
  if (!context) {
    throw new Error('useAppState must be used within an AppStateProvider');
  }
  return context;
};

// Action创建器（可选，提供类型安全的action创建）
export const createAppActions = (dispatch: React.Dispatch<AppAction>) => ({
  setEnabled: (enabled: boolean) => dispatch({ type: 'SET_ENABLED', payload: enabled }),
  setMode: (mode: ModeType) => dispatch({ type: 'SET_MODE', payload: mode }),
  setRequests: (requests: InterceptedRequest[]) => dispatch({ type: 'SET_REQUESTS', payload: requests }),
  addRequest: (request: InterceptedRequest) => dispatch({ type: 'ADD_REQUEST', payload: request }),
  updateRequest: (id: string, updates: Partial<InterceptedRequest>) => 
    dispatch({ type: 'UPDATE_REQUEST', payload: { id, updates } }),
  setSelectedRequestId: (id: string | null) => dispatch({ type: 'SET_SELECTED_REQUEST_ID', payload: id }),
  setRequestText: (text: string) => dispatch({ type: 'SET_REQUEST_TEXT', payload: text }),
  setFilter: (filter: FilterType) => dispatch({ type: 'SET_FILTER', payload: filter }),
  setSearchQuery: (query: string) => dispatch({ type: 'SET_SEARCH_QUERY', payload: query }),
  setActiveTab: (tab: TabType) => dispatch({ type: 'SET_ACTIVE_TAB', payload: tab }),
  setShowAIDialog: (show: boolean) => dispatch({ type: 'SET_SHOW_AI_DIALOG', payload: show }),
  setNetworkError: (error: string | null) => dispatch({ type: 'SET_NETWORK_ERROR', payload: error }),
  clearAllRequests: () => dispatch({ type: 'CLEAR_ALL_REQUESTS' }),
  manageRequestsMemory: (requests: InterceptedRequest[]) => 
    dispatch({ type: 'MANAGE_REQUESTS_MEMORY', payload: requests }),
  // 添加更多action创建器...
});
