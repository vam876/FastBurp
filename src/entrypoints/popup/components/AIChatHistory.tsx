import React, { useState, useEffect } from 'react';
import { FiMessageCircle, FiTrash2, FiExternalLink, FiSearch, FiFilter, FiCalendar, FiClock, FiRefreshCw, FiX } from 'react-icons/fi';
import { aiService, Message } from '../services/ai-service';
import '../styles/AIChatHistory.css';

interface AIChatHistoryProps {
  darkMode?: boolean;
  onSelectChat: (requestId: string) => void;
}

interface ChatHistoryItem {
  requestId: string;
  messages: Message[];
  lastUpdated: number;
  preview: string;
  messageCount: number;
  hasUserMessage: boolean;
  hasAIResponse: boolean;
}

const AIChatHistory: React.FC<AIChatHistoryProps> = ({ 
  darkMode = true,
  onSelectChat
}) => {
  const [chatHistory, setChatHistory] = useState<ChatHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [clearingAll, setClearingAll] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'user' | 'ai' | 'recent'>('all');
  const [sortBy, setSortBy] = useState<'time' | 'messages'>('time');
  
  useEffect(() => {
    loadChatHistory();
  }, []);
  
  const loadChatHistory = async () => {
    setIsLoading(true);
    try {
      const history = await aiService.loadChatHistory();
      
      // 转换为数组并排序（最新的在前）
      const historyArray: ChatHistoryItem[] = Object.entries(history).map(([requestId, chatData]) => {
        // 处理新的聊天历史格式
        let messages: Message[];
        let timestamp: number;
        
        if (chatData && typeof chatData === 'object' && 'messages' in chatData) {
          // 新格式：ChatHistoryItem
          messages = chatData.messages;
          timestamp = chatData.timestamp;
        } else if (Array.isArray(chatData)) {
          // 旧格式：Message[]
          messages = chatData;
          timestamp = Date.now();
        } else {
          // 无效格式，跳过
          console.warn(`跳过无效的聊天历史格式: ${requestId}`, chatData);
          return null;
        }
        
        if (!Array.isArray(messages) || messages.length === 0) {
          console.warn(`跳过空的聊天历史: ${requestId}`);
          return null;
        }
        
        const lastMessage = messages[messages.length - 1];
        const lastUpdated = lastMessage?.timestamp || timestamp;
        const userMessages = messages.filter(m => m.role === 'user');
        const aiMessages = messages.filter(m => m.role === 'assistant');
        
        return {
          requestId,
          messages,
          lastUpdated,
          preview: getChatPreview(messages),
          messageCount: messages.length,
          hasUserMessage: userMessages.length > 0,
          hasAIResponse: aiMessages.length > 0
        };
      }).filter(Boolean) as ChatHistoryItem[]; // 过滤掉null值
      
      setChatHistory(historyArray);
    } catch (err) {
      console.error('加载聊天历史失败:', err);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleDeleteChat = async (requestId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // 防止触发选择聊天
    
    try {
      await aiService.deleteChatHistory(requestId);
      setChatHistory(prev => prev.filter(chat => chat.requestId !== requestId));
    } catch (err) {
      console.error(`删除聊天历史 ${requestId} 失败:`, err);
    }
  };
  
  const handleClearAllHistory = async () => {
    if (window.confirm('确定要清空所有聊天历史吗？此操作不可恢复！')) {
      setClearingAll(true);
      try {
        await aiService.clearAllChatHistory();
        setChatHistory([]);
      } catch (err) {
        console.error('清空所有聊天历史失败:', err);
      } finally {
        setClearingAll(false);
      }
    }
  };
  
  const getChatPreview = (messages: Message[]): string => {
    // 获取最后一条非系统消息
    const lastNonSystemMessage = [...messages].reverse()
      .find(msg => msg.role !== 'system');
    
    if (!lastNonSystemMessage) return '无对话内容';
    
    const content = lastNonSystemMessage.content;
    const maxLength = 80;
    
    return content.length > maxLength
      ? content.substring(0, maxLength) + '...'
      : content;
  };
  
  const formatTime = (timestamp: number): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 1) {
      return '刚刚';
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}小时前`;
    } else if (diffInHours < 24 * 7) {
      return `${Math.floor(diffInHours / 24)}天前`;
    } else {
      return date.toLocaleDateString('zh-CN', { 
        month: '2-digit',
        day: '2-digit'
      });
    }
  };
  
  const formatFullTime = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleString('zh-CN', { 
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  // 过滤和排序聊天记录
  const filteredAndSortedHistory = chatHistory
    .filter(chat => {
      // 搜索过滤
      if (searchQuery && !chat.preview.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      
      // 类型过滤
      switch (filterType) {
        case 'user':
          return chat.hasUserMessage;
        case 'ai':
          return chat.hasAIResponse;
        case 'recent':
          const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
          return chat.lastUpdated > oneWeekAgo;
        default:
          return true;
      }
    })
    .sort((a, b) => {
      // 排序
      switch (sortBy) {
        case 'messages':
          return b.messageCount - a.messageCount;
        case 'time':
        default:
          return b.lastUpdated - a.lastUpdated;
      }
    });
  
  const getFilterIcon = () => {
    switch (filterType) {
      case 'user': return <FiMessageCircle size={14} />;
      case 'ai': return <FiExternalLink size={14} />;
      case 'recent': return <FiClock size={14} />;
      default: return <FiFilter size={14} />;
    }
  };
  
  const getFilterLabel = () => {
    switch (filterType) {
      case 'user': return '用户消息';
      case 'ai': return 'AI回复';
      case 'recent': return '最近一周';
      default: return '全部';
    }
  };
  
  if (isLoading) {
    return (
      <div className={`ai-chat-history ${darkMode ? 'dark' : 'light'}`}>
        <div className="history-header">
          <h2>聊天历史</h2>
        </div>
        <div className="history-loading">
          <div className="loading-spinner"></div>
          <p>正在加载聊天历史...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className={`ai-chat-history ${darkMode ? 'dark' : 'light'}`}>
      <div className="history-header">
        <h2>聊天历史</h2>
        <div className="header-actions">
          <button 
            className="refresh-button"
            onClick={loadChatHistory}
            title="刷新"
          >
            <FiRefreshCw size={16} />
          </button>
          <button 
            className="clear-all-button"
            onClick={handleClearAllHistory}
            disabled={clearingAll || chatHistory.length === 0}
            title="清空所有"
          >
            <FiTrash2 size={16} />
          </button>
        </div>
      </div>
      
      {/* 搜索和过滤工具栏 */}
      <div className="history-toolbar">
        <div className="search-container">
          <FiSearch size={16} className="search-icon" />
          <input
            type="text"
            placeholder="搜索聊天内容..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
          {searchQuery && (
            <button
              className="clear-search-button"
              onClick={() => setSearchQuery('')}
              title="清除搜索"
            >
              <FiX size={14} />
            </button>
          )}
        </div>
        
        <div className="filter-container">
          <div className="filter-dropdown">
            <button className="filter-button">
              {getFilterIcon()}
              <span>{getFilterLabel()}</span>
              <FiFilter size={12} />
            </button>
            <div className="filter-menu">
              <button 
                className={`filter-option ${filterType === 'all' ? 'active' : ''}`}
                onClick={() => setFilterType('all')}
              >
                <FiFilter size={14} /> 全部
              </button>
              <button 
                className={`filter-option ${filterType === 'user' ? 'active' : ''}`}
                onClick={() => setFilterType('user')}
              >
                <FiMessageCircle size={14} /> 用户消息
              </button>
              <button 
                className={`filter-option ${filterType === 'ai' ? 'active' : ''}`}
                onClick={() => setFilterType('ai')}
              >
                <FiExternalLink size={14} /> AI回复
              </button>
              <button 
                className={`filter-option ${filterType === 'recent' ? 'active' : ''}`}
                onClick={() => setFilterType('recent')}
              >
                <FiClock size={14} /> 最近一周
              </button>
            </div>
          </div>
          
          <div className="sort-container">
            <button 
              className={`sort-button ${sortBy === 'time' ? 'active' : ''}`}
              onClick={() => setSortBy('time')}
              title="按时间排序"
            >
              <FiCalendar size={14} />
            </button>
            <button 
              className={`sort-button ${sortBy === 'messages' ? 'active' : ''}`}
              onClick={() => setSortBy('messages')}
              title="按消息数量排序"
            >
              <FiMessageCircle size={14} />
            </button>
          </div>
        </div>
      </div>
      
      {/* 统计信息 */}
      <div className="history-stats">
        <span className="stat-item">
          <FiMessageCircle size={14} />
          总计: {filteredAndSortedHistory.length} 个对话
        </span>
        {searchQuery && (
          <span className="stat-item">
            <FiSearch size={14} />
            搜索结果: {filteredAndSortedHistory.length} 个
          </span>
        )}
        <span className="stat-item">
          <FiClock size={14} />
          最新: {chatHistory.length > 0 ? formatTime(chatHistory[0].lastUpdated) : '无'}
        </span>
      </div>
      
      {/* 聊天记录列表 */}
      <div className="history-list">
        {filteredAndSortedHistory.length === 0 ? (
          <div className="empty-history">
            {searchQuery ? (
              <>
                <FiSearch size={48} />
                <p>没有找到匹配的聊天记录</p>
                <button 
                  className="clear-search-button"
                  onClick={() => setSearchQuery('')}
                >
                  清除搜索条件
                </button>
              </>
            ) : (
              <>
                <FiMessageCircle size={48} />
                <p>暂无聊天历史</p>
                <p className="empty-tip">开始与AI助手对话后，聊天记录将显示在这里</p>
              </>
            )}
          </div>
        ) : (
          filteredAndSortedHistory.map((chat) => (
            <div 
              key={chat.requestId} 
              className="history-item"
              onClick={() => onSelectChat(chat.requestId)}
            >
              <div className="item-header">
                <div className="item-info">
                  <div className="item-title">
                    <span className="request-id">#{chat.requestId.slice(-8)}</span>
                    <span className="message-count">
                      <FiMessageCircle size={12} />
                      {chat.messageCount}
                    </span>
                  </div>
                  <div className="item-time" title={formatFullTime(chat.lastUpdated)}>
                    {formatTime(chat.lastUpdated)}
                  </div>
                </div>
                <div className="item-actions">
                  <button
                    className="delete-button"
                    onClick={(e) => handleDeleteChat(chat.requestId, e)}
                    title="删除此对话"
                  >
                    <FiTrash2 size={14} />
                  </button>
                </div>
              </div>
              
              <div className="item-preview">
                {chat.preview}
              </div>
              
              <div className="item-meta">
                <div className="meta-tags">
                  {chat.hasUserMessage && (
                    <span className="tag user-tag">
                      <FiMessageCircle size={10} /> 用户
                    </span>
                  )}
                  {chat.hasAIResponse && (
                    <span className="tag ai-tag">
                      <FiExternalLink size={10} /> AI
                    </span>
                  )}
                </div>
                <div className="meta-stats">
                  <span className="stat">
                    <FiMessageCircle size={12} />
                    {chat.messages.filter(m => m.role === 'user').length} 问
                  </span>
                  <span className="stat">
                    <FiExternalLink size={12} />
                    {chat.messages.filter(m => m.role === 'assistant').length} 答
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default AIChatHistory; 