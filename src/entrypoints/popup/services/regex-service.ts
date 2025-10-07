import browser from 'webextension-polyfill';

// 存储键
export const REGEX_STORAGE_KEYS = {
  REGEX_RULES: 'regexRules',
  REGEX_MATCHES: 'regexMatches',
  REGEX_SETTINGS: 'regexSettings'
};

// 正则规则动作类型
export enum RegexRuleAction {
  RECORD = 'record',
  REPLACE = 'replace'
}

// 正则应用范围
export enum RegexScope {
  REQUEST_URL = 'request_url',
  REQUEST_HEADERS = 'request_headers',
  REQUEST_BODY = 'request_body',
  RESPONSE_HEADERS = 'response_headers',
  RESPONSE_BODY = 'response_body',
  ALL = 'all'
}

// 正则规则接口
export interface RegexRule {
  id: string;
  name: string;
  pattern: string;
  description: string;
  enabled: boolean;
  action: RegexRuleAction;
  replacement?: string; // 仅当action为REPLACE时使用
  scope: RegexScope;
  createdAt: number;
  updatedAt: number;
}

// 正则匹配记录接口
export interface RegexMatch {
  id: string;
  ruleId: string;
  ruleName: string;
  matchedContent: string;
  url: string;
  timestamp: number;
  requestId: string;
  context: string; // 匹配内容的上下文
  scope: RegexScope; // 匹配发生的范围
}

// 正则设置接口
export interface RegexSettings {
  enableRegexFilter: boolean;
  highlightMatches: boolean;
  logMatches: boolean;
  maxMatchesToStore: number; // 最大存储匹配数量
}

// 默认正则设置
export const DEFAULT_REGEX_SETTINGS: RegexSettings = {
  enableRegexFilter: true,
  highlightMatches: true,
  logMatches: true,
  maxMatchesToStore: 1000
};

// 预设敏感信息规则
export const PRESET_SENSITIVE_RULES: Partial<RegexRule>[] = [
  {
    name: "中国手机号",
    pattern: "(?<!\\d)1[3-9]\\d{9}(?!\\d)",
    description: "匹配中国大陆手机号码",
    action: RegexRuleAction.RECORD,
    scope: RegexScope.ALL,
    enabled: true
  },
  {
    name: "中国身份证号",
    pattern: "[1-9]\\d{5}(?:19|20)\\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\\d|3[01])\\d{3}[\\dXx]",
    description: "匹配18位身份证号码",
    action: RegexRuleAction.RECORD,
    scope: RegexScope.ALL,
    enabled: true
  },
  {
    name: "JWT Token",
    pattern: "eyJ[a-zA-Z0-9_-]+\\.eyJ[a-zA-Z0-9_-]+\\.[a-zA-Z0-9_-]+",
    description: "匹配JWT格式令牌",
    action: RegexRuleAction.RECORD,
    scope: RegexScope.ALL,
    enabled: true
  },
  {
    name: "API密钥",
    pattern: "(api[_-]?key|apikey|api[_-]?token)[\"']?\\s*[:=]\\s*[\"']([a-zA-Z0-9]{16,64})[\"']",
    description: "匹配常见API密钥格式",
    action: RegexRuleAction.RECORD,
    scope: RegexScope.ALL,
    enabled: true
  },
  {
    name: "AWS访问密钥",
    pattern: "AKIA[0-9A-Z]{16}",
    description: "匹配AWS访问密钥ID",
    action: RegexRuleAction.RECORD,
    scope: RegexScope.ALL,
    enabled: true
  },
  {
    name: "AWS S3 URL",
    pattern: "https?://[a-z0-9.-]+\\.s3\\.amazonaws\\.com/",
    description: "匹配AWS S3存储桶URL",
    action: RegexRuleAction.RECORD,
    scope: RegexScope.ALL,
    enabled: true
  }
];

// 处理结果接口
export interface ProcessResult {
  processedContent: string;
  matches: RegexMatch[];
}

// 正则服务类
export class RegexService {
  // 加载正则规则
  async loadRules(): Promise<RegexRule[]> {
    try {
      const result = await browser.storage.local.get(REGEX_STORAGE_KEYS.REGEX_RULES);
      const rules = result[REGEX_STORAGE_KEYS.REGEX_RULES];
      
      // 如果没有规则，初始化预设规则
      if (!rules || !Array.isArray(rules) || rules.length === 0) {
        return this.initializePresetRules();
      }
      
      return rules;
    } catch (error) {
      console.error('加载正则规则失败:', error);
      return [];
    }
  }
  
  // 初始化预设规则
  async initializePresetRules(): Promise<RegexRule[]> {
    const now = Date.now();
    const rules: RegexRule[] = PRESET_SENSITIVE_RULES.map((rule, index) => ({
      id: `preset-${index}`,
      name: rule.name || `规则${index + 1}`,
      pattern: rule.pattern || '',
      description: rule.description || '',
      enabled: rule.enabled !== undefined ? rule.enabled : true,
      action: rule.action || RegexRuleAction.RECORD,
      replacement: rule.replacement || '',
      scope: rule.scope || RegexScope.ALL,
      createdAt: now,
      updatedAt: now
    }));
    
    await browser.storage.local.set({ [REGEX_STORAGE_KEYS.REGEX_RULES]: rules });
    return rules;
  }
  
  // 保存正则规则
  async saveRule(rule: RegexRule): Promise<void> {
    try {
      const rules = await this.loadRules();
      const now = Date.now();
      const index = rules.findIndex(r => r.id === rule.id);
      
      if (index >= 0) {
        // 更新现有规则
        rules[index] = {
          ...rule,
          updatedAt: now
        };
      } else {
        // 添加新规则
        rules.push({
          ...rule,
          id: rule.id || `rule-${now}-${Math.random().toString(36).substring(2, 9)}`,
          createdAt: now,
          updatedAt: now
        });
      }
      
      await browser.storage.local.set({ [REGEX_STORAGE_KEYS.REGEX_RULES]: rules });
    } catch (error) {
      console.error('保存正则规则失败:', error);
      throw error;
    }
  }
  
  // 删除正则规则
  async deleteRule(ruleId: string): Promise<void> {
    try {
      const rules = await this.loadRules();
      const newRules = rules.filter(rule => rule.id !== ruleId);
      await browser.storage.local.set({ [REGEX_STORAGE_KEYS.REGEX_RULES]: newRules });
    } catch (error) {
      console.error('删除正则规则失败:', error);
      throw error;
    }
  }
  
  // 加载正则设置
  async loadSettings(): Promise<RegexSettings> {
    try {
      const result = await browser.storage.local.get(REGEX_STORAGE_KEYS.REGEX_SETTINGS);
      return result[REGEX_STORAGE_KEYS.REGEX_SETTINGS] || DEFAULT_REGEX_SETTINGS;
    } catch (error) {
      console.error('加载正则设置失败:', error);
      return DEFAULT_REGEX_SETTINGS;
    }
  }
  
  // 保存正则设置
  async saveSettings(settings: RegexSettings): Promise<void> {
    try {
      await browser.storage.local.set({ [REGEX_STORAGE_KEYS.REGEX_SETTINGS]: settings });
    } catch (error) {
      console.error('保存正则设置失败:', error);
      throw error;
    }
  }
  
  // 加载匹配记录
  async loadMatches(): Promise<RegexMatch[]> {
    try {
      const result = await browser.storage.local.get(REGEX_STORAGE_KEYS.REGEX_MATCHES);
      return result[REGEX_STORAGE_KEYS.REGEX_MATCHES] || [];
    } catch (error) {
      console.error('加载匹配记录失败:', error);
      return [];
    }
  }
  
  // 保存匹配记录
  async saveMatches(matches: RegexMatch[]): Promise<void> {
    try {
      const settings = await this.loadSettings();
      const existingMatches = await this.loadMatches();
      
      // 合并并限制记录数量
      const allMatches = [...matches, ...existingMatches]
        .slice(0, settings.maxMatchesToStore);
      
      await browser.storage.local.set({ [REGEX_STORAGE_KEYS.REGEX_MATCHES]: allMatches });
    } catch (error) {
      console.error('保存匹配记录失败:', error);
      throw error;
    }
  }
  
  // 清除匹配记录
  async clearMatches(): Promise<void> {
    try {
      await browser.storage.local.set({ [REGEX_STORAGE_KEYS.REGEX_MATCHES]: [] });
    } catch (error) {
      console.error('清除匹配记录失败:', error);
      throw error;
    }
  }
  
  // 导出规则
  async exportRules(): Promise<string> {
    try {
      const rules = await this.loadRules();
      return JSON.stringify(rules, null, 2);
    } catch (error) {
      console.error('导出规则失败:', error);
      throw error;
    }
  }
  
  // 导入规则
  async importRules(rulesJson: string): Promise<boolean> {
    try {
      const rules = JSON.parse(rulesJson);
      
      if (!Array.isArray(rules)) {
        throw new Error('无效的规则格式，应为数组');
      }
      
      // 验证规则格式
      const validRules = rules.filter(rule => 
        rule && 
        typeof rule === 'object' && 
        typeof rule.name === 'string' && 
        typeof rule.pattern === 'string'
      );
      
      if (validRules.length === 0) {
        throw new Error('没有有效的规则');
      }
      
      // 确保每个规则都有必要的字段
      const now = Date.now();
      const normalizedRules: RegexRule[] = validRules.map((rule, index) => ({
        id: rule.id || `imported-${now}-${index}`,
        name: rule.name,
        pattern: rule.pattern,
        description: rule.description || '',
        enabled: rule.enabled !== undefined ? rule.enabled : true,
        action: rule.action || RegexRuleAction.RECORD,
        replacement: rule.replacement || '',
        scope: rule.scope || RegexScope.ALL,
        createdAt: rule.createdAt || now,
        updatedAt: now
      }));
      
      await browser.storage.local.set({ [REGEX_STORAGE_KEYS.REGEX_RULES]: normalizedRules });
      return true;
    } catch (error) {
      console.error('导入规则失败:', error);
      return false;
    }
  }
  
  // 处理内容（匹配和替换）
  async processContent(
    content: string, 
    scope: RegexScope, 
    requestInfo: {
      url: string,
      requestId: string
    }
  ): Promise<ProcessResult> {
    try {
      // 加载设置和规则
      const settings = await this.loadSettings();
      if (!settings.enableRegexFilter) {
        return { processedContent: content, matches: [] };
      }
      
      const rules = await this.loadRules();
      const enabledRules = rules.filter(rule => 
        rule.enabled && (rule.scope === scope || rule.scope === RegexScope.ALL)
      );
      
      if (enabledRules.length === 0) {
        return { processedContent: content, matches: [] };
      }
      
      let processedContent = content;
      const matches: RegexMatch[] = [];
      
      // 应用每条规则
      for (const rule of enabledRules) {
        try {
          const regex = new RegExp(rule.pattern, 'g');
          
          // 对于记录操作，找出所有匹配项
          if (rule.action === RegexRuleAction.RECORD) {
            let match;
            while ((match = regex.exec(content)) !== null) {
              // 获取匹配内容的上下文（前后各50个字符）
              const start = Math.max(0, match.index - 50);
              const end = Math.min(content.length, match.index + match[0].length + 50);
              const context = content.substring(start, end);
              
              matches.push({
                id: `match-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
                ruleId: rule.id,
                ruleName: rule.name,
                matchedContent: match[0],
                url: requestInfo.url,
                timestamp: Date.now(),
                requestId: requestInfo.requestId,
                context,
                scope
              });
              
              // 防止无限循环
              if (match.index === regex.lastIndex) {
                regex.lastIndex++;
              }
            }
          }
          
          // 对于替换操作，替换所有匹配项
          if (rule.action === RegexRuleAction.REPLACE && rule.replacement !== undefined) {
            processedContent = processedContent.replace(regex, rule.replacement);
          }
        } catch (e) {
          console.error(`应用正则规则 "${rule.name}" 失败:`, e);
        }
      }
      
      // 保存匹配记录
      if (matches.length > 0 && settings.logMatches) {
        await this.saveMatches(matches);
      }
      
      return { processedContent, matches };
    } catch (error) {
      console.error('处理内容失败:', error);
      return { processedContent: content, matches: [] };
    }
  }
  
  // 测试正则表达式
  testRegex(pattern: string, testString: string): { 
    isValid: boolean; 
    matches: { text: string; index: number }[];
    error?: string;
  } {
    try {
      const regex = new RegExp(pattern, 'g');
      const matches: { text: string; index: number }[] = [];
      
      let match;
      while ((match = regex.exec(testString)) !== null) {
        matches.push({
          text: match[0],
          index: match.index
        });
        
        // 防止无限循环
        if (match.index === regex.lastIndex) {
          regex.lastIndex++;
        }
      }
      
      return { isValid: true, matches };
    } catch (error) {
      return { 
        isValid: false, 
        matches: [],
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}

export const regexService = new RegexService();
