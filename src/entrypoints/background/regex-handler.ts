import { RegexScope } from '../popup/services/regex-service';

// 存储
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

// 正则规则接口
export interface RegexRule {
  id: string;
  name: string;
  pattern: string;
  description: string;
  enabled: boolean;
  action: RegexRuleAction;
  replacement?: string;
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
  context: string;
  scope: RegexScope;
}

// 正则设置接口
export interface RegexSettings {
  enableRegexFilter: boolean;
  highlightMatches: boolean;
  logMatches: boolean;
  maxMatchesToStore: number;
}

// 默认正则设置
export const DEFAULT_REGEX_SETTINGS: RegexSettings = {
  enableRegexFilter: true,
  highlightMatches: true,
  logMatches: true,
  maxMatchesToStore: 1000
};

// 处理结果接口
export interface ProcessResult {
  processedContent: string;
  matches: RegexMatch[];
}

// 加载正则规则
export async function loadRules(): Promise<RegexRule[]> {
  try {
    const result = await chrome.storage.local.get(REGEX_STORAGE_KEYS.REGEX_RULES);
    return result[REGEX_STORAGE_KEYS.REGEX_RULES] || [];
  } catch (error) {
    return [];
  }
}

// 加载正则设置
export async function loadSettings(): Promise<RegexSettings> {
  try {
    const result = await chrome.storage.local.get(REGEX_STORAGE_KEYS.REGEX_SETTINGS);
    return result[REGEX_STORAGE_KEYS.REGEX_SETTINGS] || DEFAULT_REGEX_SETTINGS;
  } catch (error) {
    return DEFAULT_REGEX_SETTINGS;
  }
}

// 保存匹配记录
export async function saveMatches(newMatches: RegexMatch[]): Promise<void> {
  try {
    if (newMatches.length === 0) return;
    
    const settings = await loadSettings();
    if (!settings.logMatches) return;
    
    const result = await chrome.storage.local.get(REGEX_STORAGE_KEYS.REGEX_MATCHES);
    const existingMatches = result[REGEX_STORAGE_KEYS.REGEX_MATCHES] || [];
    
    // 合并并限制记录数量
    const allMatches = [...newMatches, ...existingMatches]
      .slice(0, settings.maxMatchesToStore);
    
    await chrome.storage.local.set({ [REGEX_STORAGE_KEYS.REGEX_MATCHES]: allMatches });
  } catch (error) {
    // 静默处理
  }
}

// 处理内容（匹配和替换）
export async function processContent(
  content: string, 
  scope: RegexScope, 
  requestInfo: {
    url: string,
    requestId: string
  }
): Promise<ProcessResult> {
  try {
    // 加载设置和规则
    const settings = await loadSettings();
    if (!settings.enableRegexFilter) {
      return { processedContent: content, matches: [] };
    }
    
    const rules = await loadRules();
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
        // 静默处理规则错误
      }
    }
    
    // 保存匹配记录
    if (matches.length > 0) {
      await saveMatches(matches);
    }
    
    return { processedContent, matches };
  } catch (error) {
    return { processedContent: content, matches: [] };
  }
}

// 处理URL
export async function processUrl(url: string, requestId: string): Promise<string> {
  const result = await processContent(url, RegexScope.REQUEST_URL, { url, requestId });
  return result.processedContent;
}

// 处理请求头
export async function processRequestHeaders(
  headers: { name: string; value: string }[], 
  url: string, 
  requestId: string
): Promise<{ name: string; value: string }[]> {
  const processedHeaders: { name: string; value: string }[] = [];
  
  for (const header of headers) {
    const result = await processContent(
      header.value, 
      RegexScope.REQUEST_HEADERS, 
      { url, requestId }
    );
    
    processedHeaders.push({
      name: header.name,
      value: result.processedContent
    });
  }
  
  return processedHeaders;
}

// 处理请求体
export async function processRequestBody(
  body: string | undefined, 
  url: string, 
  requestId: string
): Promise<string | undefined> {
  if (!body) return body;
  
  const result = await processContent(body, RegexScope.REQUEST_BODY, { url, requestId });
  return result.processedContent;
}

// 处理响应头
export async function processResponseHeaders(
  headers: { name: string; value: string }[], 
  url: string, 
  requestId: string
): Promise<{ name: string; value: string }[]> {
  const processedHeaders: { name: string; value: string }[] = [];
  
  for (const header of headers) {
    const result = await processContent(
      header.value, 
      RegexScope.RESPONSE_HEADERS, 
      { url, requestId }
    );
    
    processedHeaders.push({
      name: header.name,
      value: result.processedContent
    });
  }
  
  return processedHeaders;
}

// 处理响应体
export async function processResponseBody(
  body: string, 
  url: string, 
  requestId: string
): Promise<string> {
  const result = await processContent(body, RegexScope.RESPONSE_BODY, { url, requestId });
  return result.processedContent;
}
