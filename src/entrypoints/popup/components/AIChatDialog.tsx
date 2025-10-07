import React, { useState, useEffect, useRef } from 'react';
import { FiSend, FiStopCircle, FiX, FiTrash2, FiMessageCircle, FiAlertTriangle, FiSettings, FiMaximize2, FiMinimize2, FiCopy, FiCheck, FiRefreshCw, FiPlus } from 'react-icons/fi';
import { aiService, Message, AISettings } from '../services/ai-service';
import '../styles/AIChatDialog.css';

interface AIChatDialogProps {
  requestId: string;
  requestData: string;
  responseData: string;
  onClose: () => void;
  darkMode?: boolean;
  onOpenSettings?: () => void;
}

const AIChatDialog: React.FC<AIChatDialogProps> = ({
  requestId,
  requestData,
  responseData,
  onClose,
  darkMode = true,
  onOpenSettings
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [userInput, setUserInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [settings, setSettings] = useState<AISettings | null>(null);
  const [currentMessage, setCurrentMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isResponseTooLarge, setIsResponseTooLarge] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [responseSize, setResponseSize] = useState(0);
  const [responseSizeLimit, setResponseSizeLimit] = useState(10000);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [streamingProgress, setStreamingProgress] = useState(0);
  const [isFromHistory, setIsFromHistory] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  
  // 立即检查响应大小
  useEffect(() => {
    // 立即更新响应大小，不管是否超出限制
    if (responseData) {
      const responseLength = responseData.length;
      setResponseSize(responseLength);
      
      // 如果已经有设置信息，立即检查是否超过限制
      if (settings && responseLength > settings.maxResponseSize) {
        console.log(`立即检测到响应过大: ${responseLength} 字符，超过限制: ${settings.maxResponseSize} 字符`);
        setIsResponseTooLarge(true);
        setIsLoading(false);
      }
    }
  }, [responseData, settings]);
  
  // 加载设置和历史
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // 加载AI设置
        const aiSettings = await aiService.loadSettings();
        setSettings(aiSettings);
        setResponseSizeLimit(aiSettings.maxResponseSize);
        
        // 检查响应数据
        if (responseData) {
        const responseLength = responseData.length;
        setResponseSize(responseLength);
        
        if (responseLength > aiSettings.maxResponseSize) {
          console.log(`响应数据过大: ${responseLength} 字符，超过限制: ${aiSettings.maxResponseSize} 字符`);
          setIsResponseTooLarge(true);
          setIsLoading(false);
          return;
          }
        } else {
          // 响应数据为空，设置默认值
          setResponseSize(0);
          console.log('响应数据为空，将使用请求数据进行分析');
        }
        
        // 继续加载聊天历史
        loadChatHistory(aiSettings);
        
      } catch (err) {
        console.error('加载AI对话数据失败:', err);
        setError('加载对话数据失败，请检查设置');
        setIsLoading(false);
      }
    };
    
    const loadChatHistory = async (aiSettings: AISettings) => {
      try {
        // 加载聊天历史
        const history = await aiService.loadChatHistory();
        const chatHistory = history[requestId];
        
        // 处理新的聊天历史格式
        if (chatHistory) {
          if ('messages' in chatHistory && Array.isArray(chatHistory.messages)) {
            // 新格式：ChatHistoryItem
            setMessages(chatHistory.messages);
            setIsFromHistory(true);
            console.log('加载新格式聊天历史:', chatHistory.messages.length, '条消息');
            console.log('聊天历史内容:', chatHistory.messages.map(msg => ({
              role: msg.role,
              content: msg.content.substring(0, 100),
              timestamp: msg.timestamp
            })));
          } else if (Array.isArray(chatHistory)) {
            // 旧格式：Message[]
            setMessages(chatHistory);
            setIsFromHistory(true);
            console.log('加载旧格式聊天历史:', chatHistory.length, '条消息');
            console.log('聊天历史内容:', chatHistory.map(msg => ({
              role: msg.role,
              content: msg.content.substring(0, 100),
              timestamp: msg.timestamp
            })));
          } else {
            setMessages([]);
            setIsFromHistory(false);
            console.log('无效的聊天历史格式，创建新聊天');
          }
        } else {
          // 如果没有历史记录，创建初始系统消息
          const hasResponseData = responseData && responseData.length > 0;
          const initialMessage: Message = {
            id: `system-${Date.now()}`,
            role: 'system',
            content: `这是一个关于请求 ${requestId} 的AI分析助手。${hasResponseData ? 
              '检测到完整的请求和响应数据，可以进行全面分析。' : 
              '检测到请求数据，响应数据可能为空或未完成。'
            }

您可以询问关于这个请求的任何问题，包括：
• 请求分析：请求的目的、参数、头信息、URL结构等
${hasResponseData ? '• 响应分析：响应状态、内容、错误、头信息等' : '• 响应分析：当前响应状态（数据可能不完整）'}
• 安全分析：潜在的安全问题、漏洞、风险等
• 性能分析：请求结构、参数优化等
• 调试建议：如何优化、修复问题等

${hasResponseData ? '请告诉我您想了解什么？' : '注意：当前响应数据可能不完整，建议先完成请求重放后再进行分析。'}`,
            timestamp: Date.now()
          };
          setMessages([initialMessage]);
        }
        
        setIsLoading(false);
      } catch (err) {
        console.error('加载聊天历史失败:', err);
        setIsLoading(false);
      }
    };
    
    loadData();
  }, [requestId, responseData]);
  
  // 自动滚动到底部
  useEffect(() => {
    scrollToBottom();
  }, [messages, currentMessage]);
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  
  // 处理用户输入
  const handleUserInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setUserInput(e.target.value);
    
    // 自动调整输入框高度
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
  };
  
  // 处理回车发送（Shift+Enter换行）
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };
  
  // 发送消息
  const handleSendMessage = async () => {
    if (!userInput.trim() || isProcessing) return;
    
    const userMessage: Message = { 
      id: `user-${Date.now()}`,
      role: 'user',
      content: userInput.trim(),
      timestamp: Date.now()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setUserInput('');
    setIsProcessing(true);
    setError(null);
    
    // 重置输入框高度
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }
    
    // 创建AI消息占位符
    const aiMessageId = `ai-${Date.now()}`;
    const aiMessage: Message = {
      id: aiMessageId,
      role: 'assistant',
      content: '',
      timestamp: Date.now()
    };
    
    setMessages(prev => [...prev, aiMessage]);
    
    try {
      // 设置流式消息ID和进度
      setStreamingMessageId(aiMessageId);
      setStreamingProgress(0);
      setRetryCount(0);
      
      // 检查数据完整性
      const hasRequestData = requestData && requestData.length > 0;
      const hasResponseData = responseData && responseData.length > 0;
      
      if (!hasRequestData && !hasResponseData) {
        throw new Error('请求和响应数据都为空，无法进行分析');
      }
      
      let tokenCount = 0;
      
      // 使用流式响应，传递现有消息历史
      console.log('发送消息，现有对话历史:', messages.length, '条消息');
      console.log('对话上下文:', messages.map(msg => ({ role: msg.role, content: msg.content.substring(0, 100) })));
      
      const response = await aiService.sendMessage(
        userInput.trim(),
        requestData || '请求数据为空',
        responseData || '响应数据为空或未完成',
        settings!,
        requestId,
        (token) => {
          tokenCount++;
          // 更新进度（假设平均每个token约4个字符）
          setStreamingProgress(Math.min((tokenCount * 4) / 100, 0.95));
          
          // 实时更新AI消息内容，使用函数式更新避免闭包问题
          setMessages(prev => {
            const messageIndex = prev.findIndex(msg => msg.id === aiMessageId);
            if (messageIndex === -1) return prev;
            
            const newMessages = [...prev];
            newMessages[messageIndex] = {
              ...newMessages[messageIndex],
              content: newMessages[messageIndex].content + token
            };
            return newMessages;
          });
        },
        messages // 传递现有消息历史
      );
      
      // 流式响应完成，确保最终内容完整
      setMessages(prev => prev.map(msg => 
        msg.id === aiMessageId 
          ? { ...msg, content: response }
          : msg
      ));
      
      // 清除流式状态和进度
      setStreamingMessageId(null);
      setStreamingProgress(1);
      
      // 保存到历史记录，确保消息顺序正确，并包含请求和响应数据
      const finalMessages = [
        ...messages.filter(msg => msg.id !== aiMessageId), // 排除临时的AI消息
        userMessage, 
        { ...aiMessage, content: response }
      ];
      
      // 将请求和响应数据保存到聊天历史中
      await aiService.saveChatHistory(requestId, finalMessages, {
        requestData,
        responseData
      });
      
    } catch (err) {
      console.error('发送消息失败:', err);
      setError(err instanceof Error ? err.message : '发送消息失败');
      
      // 清除流式状态和进度
      setStreamingMessageId(null);
      setStreamingProgress(0);
      
      // 更新AI消息为错误状态
      setMessages(prev => prev.map(msg => 
        msg.id === aiMessageId 
          ? { ...msg, content: `❌ 发送消息失败: ${err instanceof Error ? err.message : '未知错误'}` }
          : msg
      ));
      
      // 增加重试计数
      setRetryCount(prev => prev + 1);
    } finally {
      setIsProcessing(false);
    }
  };
  
  // 停止生成
  const handleStopGeneration = () => {
    aiService.stopRequest();
    setIsProcessing(false);
    setStreamingMessageId(null);
    setStreamingProgress(0);
    setCurrentMessage('');
  };

  // 重试发送消息
  const handleRetryMessage = async () => {
    if (retryCount > 0) {
      // 移除错误消息
      setMessages(prev => prev.filter(msg => !msg.content.includes('❌ 发送消息失败')));
      // 重新发送最后一条用户消息
      const lastUserMessage = messages.filter(msg => msg.role === 'user').pop();
      if (lastUserMessage) {
        setUserInput(lastUserMessage.content);
        setTimeout(() => handleSendMessage(), 100);
      }
    }
  };
  
  // 新建聊天
  const handleNewChat = () => {
    if (window.confirm('确定要开始新的聊天吗？当前聊天记录将被保存。')) {
      // 清空当前消息，但保留请求和响应数据
      setMessages([]);
      setIsFromHistory(false);
      
      // 创建新的初始系统消息
      const hasResponseData = responseData && responseData.length > 0;
      const initialMessage: Message = {
        id: `system-${Date.now()}`,
        role: 'system',
        content: `这是一个关于请求 ${requestId} 的AI分析助手。${hasResponseData ? 
          '检测到完整的请求和响应数据，可以进行全面分析。' : 
          '检测到请求数据，响应数据可能为空或未完成。'
        }

您可以询问关于这个请求的任何问题，包括：
• 请求分析：请求的目的、参数、头信息、URL结构等
${hasResponseData ? '• 响应分析：响应状态、内容、错误、头信息等' : '• 响应分析：当前响应状态（数据可能不完整）'}
• 安全分析：潜在的安全问题、漏洞、风险等
• 性能分析：请求结构、参数优化等
• 调试建议：如何优化、修复问题等

${hasResponseData ? '请告诉我您想了解什么？' : '注意：当前响应数据可能不完整，建议先完成请求重放后再进行分析。'}`,
        timestamp: Date.now()
      };
      setMessages([initialMessage]);
    }
  };
  
  // 清空聊天记录
  const handleClearChat = async () => {
    if (window.confirm('确定要清空当前聊天记录吗？')) {
      try {
        await aiService.deleteChatHistory(requestId);
          setMessages([]);
      } catch (err) {
        console.error('清空聊天记录失败:', err);
      }
    }
  };
  
  // 复制消息内容
  const copyMessageContent = async (content: string, messageId: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedMessageId(messageId);
      setTimeout(() => setCopiedMessageId(null), 2000);
    } catch (error) {
      console.error('复制失败:', error);
      // 回退方案
      const textArea = document.createElement('textarea');
      textArea.value = content;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopiedMessageId(messageId);
      setTimeout(() => setCopiedMessageId(null), 2000);
    }
  };
  
  // 切换全屏模式
  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };
  
  // 格式化时间
  const formatTime = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  // 渲染消息内容
  const renderMessageContent = (content: string) => {
    // 简单的代码块检测和格式化
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    const inlineCodeRegex = /`([^`]+)`/g;
    
    let formattedContent = content
      .replace(codeBlockRegex, (match, lang, code) => {
        return `<div class="code-block ${lang || ''}">${code.trim()}</div>`;
      })
      .replace(inlineCodeRegex, '<code>$1</code>');
    
    // 处理换行
    formattedContent = formattedContent.replace(/\n/g, '<br>');
    
    return <div dangerouslySetInnerHTML={{ __html: formattedContent }} />;
  };
  
  if (isLoading) {
    return (
      <div className={`ai-chat-dialog ${darkMode ? 'dark' : 'light'} ${isFullscreen ? 'fullscreen' : ''}`}>
        <div className="ai-chat-dialog-header">
          <h2>AI分析助手</h2>
          <div className="ai-chat-dialog-actions">
            <button className="ai-chat-action-button" onClick={toggleFullscreen} title="切换全屏">
              {isFullscreen ? <FiMinimize2 size={18} /> : <FiMaximize2 size={18} />}
            </button>
            <button className="ai-chat-close-button" onClick={onClose} title="关闭">
              <FiX size={18} />
            </button>
              </div>
            </div>
        <div className="ai-chat-loading">
          <div className="loading-spinner"></div>
          <p>正在加载AI助手...</p>
            </div>
          </div>
    );
  }

  if (error && !isResponseTooLarge) {
    return (
      <div className={`ai-chat-dialog ${darkMode ? 'dark' : 'light'} ${isFullscreen ? 'fullscreen' : ''}`}>
        <div className="ai-chat-dialog-header">
          <h2>AI分析助手</h2>
          <div className="ai-chat-dialog-actions">
            <button className="ai-chat-action-button" onClick={toggleFullscreen} title="切换全屏">
              {isFullscreen ? <FiMinimize2 size={18} /> : <FiMaximize2 size={18} />}
            </button>
            <button className="ai-chat-close-button" onClick={onClose} title="关闭">
              <FiX size={18} />
            </button>
          </div>
        </div>
        <div className="ai-chat-error">
          <FiAlertTriangle size={24} />
          <p>{error}</p>
          <button onClick={() => window.location.reload()}>重试</button>
        </div>
      </div>
    );
  }

  if (isResponseTooLarge) {
    return (
      <div className={`ai-chat-dialog ${darkMode ? 'dark' : 'light'} ${isFullscreen ? 'fullscreen' : ''}`}>
        <div className="ai-chat-dialog-header">
          <h2>AI分析助手</h2>
          <div className="ai-chat-dialog-actions">
            <button className="ai-chat-action-button" onClick={toggleFullscreen} title="切换全屏">
              {isFullscreen ? <FiMinimize2 size={18} /> : <FiMaximize2 size={18} />}
            </button>
            <button className="ai-chat-close-button" onClick={onClose} title="关闭">
              <FiX size={18} />
            </button>
          </div>
        </div>
        <div className="ai-chat-response-too-large">
          <FiAlertTriangle size={24} />
          <h3>响应数据过大</h3>
          <p>当前响应数据大小: <strong>{responseSize.toLocaleString()}</strong> 字符</p>
          <p>AI分析限制: <strong>{responseSizeLimit.toLocaleString()}</strong> 字符</p>
          <div className="response-size-actions">
            <button onClick={onOpenSettings} className="settings-button">
              <FiSettings size={16} /> 调整设置
            </button>
            <button onClick={onClose} className="close-button">
              <FiX size={16} /> 关闭
            </button>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className={`ai-chat-dialog ${darkMode ? 'dark' : 'light'} ${isFullscreen ? 'fullscreen' : ''}`}>
      <div className="ai-chat-dialog-header">
        <h2>AI分析助手</h2>
        <div className="ai-chat-dialog-actions">
          <button 
            className="ai-chat-action-button" 
            onClick={handleNewChat} 
            title="新建聊天"
          >
            <FiPlus size={22} />
          </button>
          <button 
            className="ai-chat-action-button" 
            onClick={onOpenSettings} 
            title="AI设置"
          >
            <FiSettings size={22} />
          </button>
          <button 
            className="ai-chat-action-button" 
            onClick={handleClearChat} 
            title="清空聊天"
          >
            <FiTrash2 size={22} />
          </button>
          <button 
            className="ai-chat-action-button" 
            onClick={toggleFullscreen} 
            title="切换全屏"
          >
            {isFullscreen ? <FiMinimize2 size={22} /> : <FiMaximize2 size={22} />}
          </button>
          <button className="ai-chat-close-button" onClick={onClose} title="关闭">
            <FiX size={22} />
          </button>
        </div>
      </div>
      
      <div className="ai-chat-messages" ref={chatContainerRef}>
        {messages.length === 0 ? (
          <div className="ai-chat-empty-state">
            <div className="empty-state-icon">💬</div>
            <h3>开始新的对话</h3>
            <p>您可以询问关于这个HTTP请求的任何问题，包括安全分析、性能优化、调试建议等。</p>
            <div className="empty-state-tips">
              <div className="tip-item">
                <strong>💡 提示：</strong>
                {requestData ? '检测到请求数据，可以进行请求分析。' : '请求数据为空，建议先完成请求重放。'}
              </div>
              <div className="tip-item">
                <strong>📊 状态：</strong>
                {responseData ? '检测到响应数据，可以进行全面分析。' : '响应数据为空，建议先完成请求重放。'}
              </div>
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <div key={message.id} className={`ai-chat-message ${message.role}`}>
              <div className="message-header">
                <div className="message-role">
                  {message.role === 'user' ? '👤 您' : 
                   message.role === 'assistant' ? '🤖 AI助手' : '⚙️ 系统'}
                </div>
                <div className="message-time">{formatTime(message.timestamp)}</div>
                <div className="message-actions">
                  {message.role === 'assistant' && message.content.includes('❌ 发送消息失败') && (
                    <button
                      className="retry-button"
                      onClick={handleRetryMessage}
                      title="重试发送"
                    >
                      <FiRefreshCw size={14} />
                    </button>
                  )}
                  <button
                    className="copy-message-button"
                    onClick={() => copyMessageContent(message.content, message.id)}
                    title="复制消息"
                  >
                    {copiedMessageId === message.id ? (
                      <FiCheck size={14} className="copy-success" />
                    ) : (
                      <FiCopy size={14} />
                    )}
                  </button>
                </div>
              </div>
              <div className={`message-content ${streamingMessageId === message.id ? 'streaming' : ''}`}>
                {renderMessageContent(message.content)}
                {streamingMessageId === message.id && message.content === '' && (
                  <div className="streaming-placeholder">
                    <div className="typing-indicator">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                    <span className="generating-text">AI正在思考中...</span>
                    <div className="progress-bar">
                      <div 
                        className="progress-fill" 
                        style={{ width: `${streamingProgress * 100}%` }}
                      ></div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
        
        {isProcessing && !streamingMessageId && (
          <div className="ai-chat-message assistant">
            <div className="message-header">
              <div className="message-role">🤖 AI助手</div>
              <div className="message-time">正在生成...</div>
            </div>
            <div className="message-content">
              <div className="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </div>
              <span className="generating-text">AI正在思考中...</span>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>
      
      <div className="ai-chat-input-container">
        <div className="ai-chat-input-wrapper">
        <textarea
            ref={inputRef}
            className="ai-chat-input"
          value={userInput}
            onChange={handleUserInput}
          onKeyDown={handleKeyDown}
            placeholder="输入您的问题... (Shift+Enter换行，Enter发送)"
            disabled={isProcessing}
          rows={1}
        />
          <div className="input-actions">
        {isProcessing ? (
          <button 
                className="ai-chat-stop-button"
            onClick={handleStopGeneration}
            title="停止生成"
          >
                <FiStopCircle size={18} />
          </button>
        ) : (
          <button 
                className="ai-chat-send-button"
            onClick={handleSendMessage}
                disabled={!userInput.trim()}
                title="发送消息"
          >
                <FiSend size={18} />
          </button>
        )}
          </div>
        </div>
                 <div className="input-tips">
           💡 提示：您可以询问关于请求分析、安全检测、性能优化等问题
           {/* 只在非聊天历史模式下显示数据不完整警告 */}
           {!isFromHistory && (!requestData || !responseData) && (
             <div className="data-warning">
               ⚠️ 数据不完整：{!requestData ? '请求数据为空' : ''}{!requestData && !responseData ? '，' : ''}{!responseData ? '响应数据为空' : ''}
               {!responseData && <span className="warning-tip">建议先完成请求重放</span>}
             </div>
           )}
         </div>
      </div>
    </div>
  );
};

export default AIChatDialog;