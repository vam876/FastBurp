import browser from 'webextension-polyfill';

export interface AISettings {
  apiEndpoint: string;
  apiKey: string;
  apiModel: string;
  systemPrompt: string;
  requiresApiKey: boolean;
  maxResponseSize: number;
}

export interface Message {
  id: string;
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface ChatHistoryItem {
  messages: Message[];
  timestamp: number;
  requestData: string;
  responseData: string;
}

export interface AIServiceEvents {
  onToken: (token: string) => void;
  onComplete: (fullResponse: string) => void;
  onError: (error: Error) => void;
}

// 导出配置的接口定义
export interface ExportConfig {
  settings: AISettings;
  promptTemplates: Array<{name: string, prompt: string}>;
  chatHistory?: Record<string, ChatHistoryItem | Message[]>;
  version: string;
  exportDate: string;
}

export const STORAGE_KEYS = {
  AI_SETTINGS: 'aiSettings',
  CHAT_HISTORY: 'aiChatHistory',
  PROMPT_TEMPLATES: 'promptTemplates',
};

export class AIService {
  private abortController: AbortController | null = null;
  private decoder = new TextDecoder();
  
  constructor() {}
  
  // 加载AI设置
  async loadSettings(): Promise<AISettings> {
    const result = await browser.storage.local.get(STORAGE_KEYS.AI_SETTINGS);
    const defaultSettings: AISettings = {
      apiEndpoint: 'https://api.openai.com/v1/chat/completions',
      apiKey: '',
      apiModel: 'gpt-3.5-turbo',
      systemPrompt: '你是一个网络安全专家，请分析以下HTTP请求和响应，指出任何潜在的安全问题、漏洞或异常情况。',
      requiresApiKey: true,
      maxResponseSize: 10000 // 默认最大响应大小为10KB
    };
    
    return result[STORAGE_KEYS.AI_SETTINGS] || defaultSettings;
  }
  
  // 保存AI设置
  async saveSettings(settings: AISettings): Promise<void> {
    await browser.storage.local.set({ [STORAGE_KEYS.AI_SETTINGS]: settings });
  }
  
  // 加载提示词模板
  async loadPromptTemplates(): Promise<Array<{name: string, prompt: string}>> {
    const result = await browser.storage.local.get(STORAGE_KEYS.PROMPT_TEMPLATES);
    // 默认提示词模板
    const defaultTemplates = [
      {
        name: '网络安全工程师',
        prompt: `你是一位经验丰富的网络安全工程师，专注于HTTP请求和响应的安全分析。请对以下HTTP请求和响应进行全面的安全评估：

1. 首先，分析请求的基本信息，包括目标URL、HTTP方法、协议版本、请求头和请求体。
2. 识别请求中可能存在的安全风险，如SQL注入、XSS、CSRF、命令注入、路径遍历等常见漏洞。
3. 评估请求参数和Cookie的安全性，检查是否存在敏感信息泄露。
4. 分析响应中的安全头部字段，如Content-Security-Policy、X-XSS-Protection、X-Content-Type-Options等。
5. 检查响应体中是否包含敏感信息或潜在的安全问题。
6. 提供具体的安全建议，包括如何修复发现的漏洞和如何加强整体安全性。

请使用专业的网络安全术语，提供深入分析，并给出实用的安全建议。如果发现高危漏洞，请特别标注出来。`
      },
      {
        name: '测试工程师',
        prompt: `你是一位专业的API测试工程师，精通HTTP协议和接口测试。请对以下HTTP请求和响应进行全面的测试分析：

1. 评估请求格式的正确性，包括URL结构、请求头和请求体的格式。
2. 分析请求参数的有效性，检查是否存在边界值问题、类型错误或缺失必要参数。
3. 检查响应状态码是否合适，响应头是否包含必要信息。
4. 评估响应体的结构和内容，验证数据格式、完整性和一致性。
5. 识别性能优化机会，包括响应时间、数据传输效率和缓存策略。
6. 提出可能的边缘测试用例，包括异常输入、并发请求和错误处理测试。
7. 给出具体的测试建议和改进点，以提高API的质量和稳定性。

请详细说明每个测试点的发现和建议，使用专业的测试术语，并提供可操作的改进方案。`
      },
      {
        name: '漏洞研究专家',
        prompt: `你是一位资深的漏洞研究专家，擅长发现和分析Web应用程序的安全漏洞。请对以下HTTP请求和响应进行深入的漏洞分析：

1. 详细检查请求中的所有参数、头部和Cookie，寻找可能的注入点和攻击面。
2. 分析请求路径和参数处理方式，识别可能的目录遍历、文件包含或权限绕过漏洞。
3. 评估身份验证和授权机制，检查是否存在会话管理问题或权限提升漏洞。
4. 检查响应中的敏感信息泄露，包括错误信息、内部路径、技术栈信息等。
5. 识别可能的业务逻辑漏洞，如竞态条件、不安全的直接对象引用等。
6. 将发现的问题与已知的CVE或OWASP Top 10漏洞类型进行对比。
7. 提供详细的漏洞利用场景、影响范围和修复建议。

请使用专业的漏洞研究术语，提供技术深度分析，并给出具体的复现步骤和修复方案。对于高危漏洞，请标注其CVSS评分或风险等级。`
      }
    ];
    
    return result[STORAGE_KEYS.PROMPT_TEMPLATES] || defaultTemplates;
  }
  
  // 保存提示词模板
  async savePromptTemplates(templates: Array<{name: string, prompt: string}>): Promise<void> {
    await browser.storage.local.set({ [STORAGE_KEYS.PROMPT_TEMPLATES]: templates });
  }
  
  // 导出配置
  async exportConfig(includeHistory: boolean = false): Promise<ExportConfig> {
    const settings = await this.loadSettings();
    const promptTemplates = await this.loadPromptTemplates();
    const exportData: ExportConfig = {
      settings,
      promptTemplates,
      version: '1.0',
      exportDate: new Date().toISOString()
    };
    
    if (includeHistory) {
      exportData.chatHistory = await this.loadChatHistory();
    }
    
    return exportData;
  }
  
  // 导入配置
  async importConfig(configData: string): Promise<boolean> {
    try {
      console.log('开始导入配置...');
      const config = JSON.parse(configData) as ExportConfig;
      
      // 验证导入数据的格式
      if (!config.settings || !config.promptTemplates) {
        throw new Error('导入的配置格式无效');
      }
      
      console.log('导入的配置数据:', {
        settings: config.settings,
        promptTemplatesCount: config.promptTemplates.length,
        hasHistory: !!config.chatHistory
      });
      
      // 保存设置
      await this.saveSettings(config.settings);
      console.log('设置已保存');
      
      // 保存提示词模板 - 使用直接方式并确保存储
      try {
        // 先检查模板格式
        if (!Array.isArray(config.promptTemplates)) {
          throw new Error('提示词模板格式无效，不是数组');
        }
        
        // 验证每个模板
        const validTemplates = config.promptTemplates.filter(t => 
          t && typeof t === 'object' && typeof t.name === 'string' && typeof t.prompt === 'string'
        );
        
        if (validTemplates.length === 0) {
          throw new Error('没有有效的提示词模板');
        }
        
        if (validTemplates.length !== config.promptTemplates.length) {
          console.warn(`发现 ${config.promptTemplates.length - validTemplates.length} 个无效模板，已过滤`);
        }
        
        // 保存到存储
        await browser.storage.local.set({ [STORAGE_KEYS.PROMPT_TEMPLATES]: validTemplates });
        
        // 验证是否成功保存
        const savedData = await browser.storage.local.get(STORAGE_KEYS.PROMPT_TEMPLATES);
        const savedTemplates = savedData[STORAGE_KEYS.PROMPT_TEMPLATES];
        
        if (!savedTemplates || !Array.isArray(savedTemplates) || savedTemplates.length === 0) {
          throw new Error('提示词模板保存失败，无法验证存储');
        }
        
        console.log('成功导入提示词模板:', savedTemplates);
      } catch (templateError) {
        console.error('保存提示词模板失败:', templateError);
        throw new Error(`提示词模板导入失败: ${templateError instanceof Error ? templateError.message : String(templateError)}`);
      }
      
      // 如果包含历史记录，也导入
      if (config.chatHistory) {
        await browser.storage.local.set({ [STORAGE_KEYS.CHAT_HISTORY]: config.chatHistory });
        console.log('聊天历史已导入');
      }
      
      return true;
    } catch (error) {
      console.error('导入配置失败:', error);
      throw error;
    }
  }
  
  // 加载聊天历史
  async loadChatHistory(): Promise<Record<string, ChatHistoryItem | Message[]>> {
    const result = await browser.storage.local.get('chatHistory');
    const history = result.chatHistory || {};
    
    // 兼容旧格式的聊天历史
    const normalizedHistory: Record<string, ChatHistoryItem | Message[]> = {};
    
    for (const [key, value] of Object.entries(history)) {
      if (Array.isArray(value)) {
        // 旧格式：直接是Message数组，转换为新格式
        const oldMessages = value as Message[];
        normalizedHistory[key] = {
          messages: oldMessages,
          timestamp: Date.now(),
          requestData: '',
          responseData: ''
        };
        console.log(`迁移旧格式聊天历史: ${key}, ${oldMessages.length} 条消息`);
      } else if (value && typeof value === 'object' && 'messages' in value) {
        // 新格式：ChatHistoryItem
        normalizedHistory[key] = value as ChatHistoryItem;
      } else {
        // 无效格式，跳过
        console.warn(`跳过无效的聊天历史格式: ${key}`, value);
      }
    }
    
    return normalizedHistory;
  }
  
  // 保存聊天历史
  async saveChatHistory(
    requestId: string, 
    messages: Message[], 
    contextData?: { requestData?: string; responseData?: string }
  ): Promise<void> {
    try {
      // 确保所有消息都有时间戳
      const messagesWithTimestamp = messages.map(msg => {
        if (!msg.timestamp) {
          return { ...msg, timestamp: Date.now() };
        }
        return msg;
      });
      
      const history = await this.loadChatHistory();
      
      // 创建新的聊天历史项
      const newChatHistoryItem: ChatHistoryItem = {
        messages: messagesWithTimestamp,
        timestamp: Date.now(),
        requestData: contextData?.requestData || '',
        responseData: contextData?.responseData || ''
      };
      
      history[requestId] = newChatHistoryItem;
      
      await browser.storage.local.set({
        chatHistory: history
      });
      
      console.log(`聊天历史已保存: ${requestId}, 消息数量: ${messagesWithTimestamp.length}, 包含上下文数据`);
    } catch (error) {
      console.error('保存聊天历史失败:', error);
      throw error;
    }
  }
  
  // 删除聊天历史
  async deleteChatHistory(requestId: string): Promise<void> {
    const history = await this.loadChatHistory();
    delete history[requestId];
    await browser.storage.local.set({ chatHistory: history });
    console.log(`聊天历史已删除: ${requestId}`);
  }
  
  // 清空所有聊天历史
  async clearAllChatHistory(): Promise<void> {
    await browser.storage.local.set({ chatHistory: {} });
    console.log('所有聊天历史已清空');
  }
  
  // 停止当前请求
  stopRequest(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }
  
  // 发送聊天请求（流式响应）
  async sendChatRequest(
    messages: Message[],
    settings: AISettings,
    events: AIServiceEvents
  ): Promise<void> {
    if (this.abortController) {
      this.abortController.abort();
    }
    
    this.abortController = new AbortController();
    const { signal } = this.abortController;
    
    try {
      // 构建请求头
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      
      // 只有在需要API密钥时才添加Authorization头
      if (settings.requiresApiKey && settings.apiKey) {
        headers['Authorization'] = `Bearer ${settings.apiKey}`;
      }
      
      const response = await fetch(settings.apiEndpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: settings.apiModel,
          messages: messages,
          temperature: 0.7,
          stream: true, // 启用流式响应
          max_tokens: 4000
        }),
        signal
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API请求失败: ${response.status} ${response.statusText}\n${errorText}`);
      }
      
      if (!response.body) {
        throw new Error('响应没有返回数据流');
      }
      
      const reader = response.body.getReader();
      let fullResponse = '';
      let buffer = ''; // 用于处理跨chunk的数据
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        // 解码新的chunk并添加到buffer
        const chunk = this.decoder.decode(value, { stream: true });
        buffer += chunk;
        
        // 按行分割并处理
        const lines = buffer.split('\n');
        // 保留最后一行（可能不完整）
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine) continue;
          
          // 处理SSE格式的数据
          if (trimmedLine.startsWith('data: ')) {
            const data = trimmedLine.slice(6);
            if (data === '[DONE]') continue;
            
            try {
              const json = JSON.parse(data);
              const token = json.choices?.[0]?.delta?.content || '';
              if (token) {
                events.onToken(token);
                fullResponse += token;
              }
            } catch (e) {
              console.warn('解析响应数据失败:', e, '原始数据:', data);
              // 继续处理，不中断流
            }
          }
        }
      }
      
      // 处理buffer中剩余的数据
      if (buffer.trim()) {
        const trimmedBuffer = buffer.trim();
        if (trimmedBuffer.startsWith('data: ')) {
          const data = trimmedBuffer.slice(6);
          if (data !== '[DONE]') {
            try {
              const json = JSON.parse(data);
              const token = json.choices?.[0]?.delta?.content || '';
              if (token) {
                events.onToken(token);
                fullResponse += token;
              }
            } catch (e) {
              console.warn('解析剩余buffer数据失败:', e);
            }
          }
        }
      }
      
      events.onComplete(fullResponse);
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          console.log('请求已取消');
        } else {
          events.onError(error);
        }
      } else {
        events.onError(new Error('未知错误'));
      }
    } finally {
      this.abortController = null;
    }
  }
  
  // 发送消息到AI服务（支持流式响应）
  async sendMessage(
    userMessage: string,
    requestData: string,
    responseData: string,
    settings: AISettings,
    requestId: string,
    onToken?: (token: string) => void,
    existingMessages?: Message[]
  ): Promise<string> {
    // 设置默认值
    const existingMsgs = existingMessages || [];
    
    console.log('sendMessage 调用参数:', {
      userMessage: userMessage.substring(0, 100),
      requestDataLength: requestData?.length || 0,
      responseDataLength: responseData?.length || 0,
      existingMessagesCount: existingMsgs.length
    });
    
    // 构建消息数组，包含对话历史
    const messages: Message[] = [];
    
    // 1. 添加系统提示词
    messages.push({
      id: `system-${Date.now()}`,
      role: 'system',
      content: settings.systemPrompt,
      timestamp: Date.now()
    });
    
    // 2. 添加HTTP请求和响应上下文（每次对话都包含）
    const hasRequestData = requestData && requestData !== '请求数据为空';
    const hasResponseData = responseData && responseData !== '响应数据为空或未完成';
    
    let contextPrompt = '';
    if (hasRequestData && hasResponseData) {
      contextPrompt = `请分析以下HTTP请求和响应：\n\n请求数据：\n${requestData}\n\n响应数据：\n${responseData}`;
    } else if (hasRequestData) {
      contextPrompt = `请分析以下HTTP请求（注意：响应数据可能不完整）：\n\n请求数据：\n${requestData}\n\n响应数据：${responseData}`;
    } else if (hasResponseData) {
      contextPrompt = `请分析以下HTTP响应（注意：请求数据可能不完整）：\n\n请求数据：${requestData}\n\n响应数据：\n${responseData}`;
    } else {
      contextPrompt = `请分析以下HTTP请求和响应（数据可能不完整）：\n\n请求数据：${requestData}\n\n响应数据：${responseData}`;
    }
    
    messages.push({
      id: `context-${Date.now()}`,
      role: 'user',
      content: contextPrompt,
      timestamp: Date.now() + 1
    });
    
    // 3. 添加现有的对话历史（排除系统消息、上下文和错误消息）
    const conversationMessages = existingMsgs.filter(msg => 
      msg.role !== 'system' && 
      !msg.content.includes('请分析以下HTTP请求和响应') &&
      !(msg.role === 'assistant' && msg.content.includes('❌ 发送消息失败')) // 排除错误消息
    );
    
    console.log('过滤后的对话历史:', conversationMessages.length, '条消息');
    console.log('对话内容:', conversationMessages.map(msg => ({ role: msg.role, content: msg.content.substring(0, 50) })));
    
    messages.push(...conversationMessages);
    
    // 4. 添加当前用户消息
    messages.push({
      id: `user-${Date.now()}`,
      role: 'user',
      content: userMessage,
      timestamp: Date.now() + 2
    });
    
    console.log('构建的完整消息数组:', messages.length, '条消息');
    console.log('消息结构:', messages.map(msg => ({ role: msg.role, content: msg.content.substring(0, 50) })));

    return new Promise((resolve, reject) => {
      this.sendChatRequest(messages, settings, {
        onToken: (token) => {
          // 如果提供了onToken回调，则实时调用
          if (onToken) {
            onToken(token);
          }
        },
        onComplete: (fullResponse) => {
          resolve(fullResponse);
        },
        onError: (error) => {
          reject(error);
        }
      });
    });
  }

  // 发送消息到AI服务（非流式，直接返回完整响应）
  async sendMessageSync(
    userMessage: string,
    requestData: string,
    responseData: string,
    settings: AISettings,
    requestId: string,
    existingMessages?: Message[]
  ): Promise<string> {
    // 设置默认值
    const existingMsgs = existingMessages || [];
    
    console.log('sendMessageSync 调用参数:', {
      userMessage: userMessage.substring(0, 100),
      requestDataLength: requestData?.length || 0,
      responseDataLength: responseData?.length || 0,
      existingMessagesCount: existingMsgs.length
    });
    
    // 构建消息数组，包含对话历史
    const messages: Message[] = [];
    
    // 1. 添加系统提示词
    messages.push({
      id: `system-${Date.now()}`,
      role: 'system',
      content: settings.systemPrompt,
      timestamp: Date.now()
    });
    
    // 2. 添加HTTP请求和响应上下文（每次对话都包含）
    const hasRequestData = requestData && requestData !== '请求数据为空';
    const hasResponseData = responseData && responseData !== '响应数据为空或未完成';
    
    let contextPrompt = '';
    if (hasRequestData && hasResponseData) {
      contextPrompt = `请分析以下HTTP请求和响应：\n\n请求数据：\n${requestData}\n\n响应数据：\n${responseData}`;
    } else if (hasRequestData) {
      contextPrompt = `请分析以下HTTP请求（注意：响应数据可能不完整）：\n\n请求数据：\n${requestData}\n\n响应数据：${responseData}`;
    } else if (hasResponseData) {
      contextPrompt = `请分析以下HTTP响应（注意：响应数据可能不完整）：\n\n请求数据：${requestData}\n\n响应数据：\n${responseData}`;
    } else {
      contextPrompt = `请分析以下HTTP请求和响应（数据可能不完整）：\n\n请求数据：${requestData}\n\n响应数据：${responseData}`;
    }
    
    messages.push({
      id: `context-${Date.now()}`,
      role: 'user',
      content: contextPrompt,
      timestamp: Date.now() + 1
    });
    
    // 3. 添加现有的对话历史（排除系统消息、上下文和错误消息）
    const conversationMessages = existingMsgs.filter(msg => 
      msg.role !== 'system' && 
      !msg.content.includes('请分析以下HTTP请求和响应') &&
      !(msg.role === 'assistant' && msg.content.includes('❌ 发送消息失败')) // 排除错误消息
    );
    messages.push(...conversationMessages);
    
    // 4. 添加当前用户消息
    messages.push({
      id: `user-${Date.now()}`,
      role: 'user',
      content: userMessage,
      timestamp: Date.now() + 2
    });

    return new Promise((resolve, reject) => {
      this.sendChatRequest(messages, settings, {
        onToken: () => {}, // 非流式模式，忽略token
        onComplete: (fullResponse) => {
          resolve(fullResponse);
        },
        onError: (error) => {
          reject(error);
        }
      });
    });
  }

  // 创建初始消息
  createInitialMessages(requestData: string, responseData: string, systemPrompt: string): Message[] {
    const now = Date.now();
    return [
      {
        id: `system-${now}`,
        role: 'system',
        content: systemPrompt,
        timestamp: now
      },
      {
        id: `user-${now + 1}`,
        role: 'user',
        content: `请分析以下HTTP请求和响应：\n\n请求数据：\n${requestData}\n\n响应数据：\n${responseData}`,
        timestamp: now + 1
      }
    ];
  }
}

export const aiService = new AIService(); 