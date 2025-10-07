import browser from 'webextension-polyfill';

// 指纹类型枚举
export enum FingerprintType {
  FRAMEWORK = 'framework',           // 框架指纹
  SERVER = 'server',                 // 服务器指纹
  CMS = 'cms',                       // 内容管理系统
  CDN = 'cdn',                       // 内容分发网络
  SECURITY = 'security',             // 安全组件
  SOCIAL = 'social',                 
  ADVERTISING = 'advertising',     
  UTILITY = 'utility',               // 实用工具
  TECHNOLOGY = 'technology',         // 技术栈
  COMPONENT = 'component',           // 组件
  OS = 'os'                         // 操作系统
}

// 指纹信息接口
export interface FingerprintInfo {
  id: string;
  name: string;
  type: FingerprintType;
  version?: string;
  description: string;
  references?: string[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  detectionMethod: 'header' | 'body' | 'javascript' | 'meta' | 'url';
  matchedContent: string;
  source: string; // 检测来源
  url: string; // 匹配的URL
  timestamp: number; // 检测时间
}

// 匹配目标类型
export enum MatchTarget {
  RESPONSE_HEADER = 'response_header',    // 响应头
  REQUEST_HEADER = 'request_header',      // 请求头
  RESPONSE_BODY = 'response_body',        // 响应主体
  COOKIE = 'cookie',                      // Cookie
  URL = 'url',                           // URL
  PAGE_CONTENT = 'page_content',         // 页面内容
  JAVASCRIPT = 'javascript',             // JavaScript代码
  CSS = 'css',                          // CSS样式
  META_TAG = 'meta_tag'                 // Meta标签
}

// 指纹规则接口
export interface FingerprintRule {
  id: string;
  name: string;
  pattern: string;
  type: FingerprintType;
  matchTarget: MatchTarget;              // 匹配目标
  targetField?: string;                  // 具体字段名（如header名称）
  versionPattern?: string;
  description: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  references: string[];
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
  compiledRegex?: RegExp;                // 预编译的正则表达式，性能优化
}

// 指纹检测结果
export interface FingerprintResult {
  url: string;
  timestamp: number;
  fingerprints: FingerprintInfo[];
  summary: {
    total: number;
    byType: Record<FingerprintType, number>;
    byRisk: Record<string, number>;
  };
}

// 存储键
export const FINGERPRINT_STORAGE_KEYS = {
  FINGERPRINT_RULES: 'fingerprintRules',
  FINGERPRINT_RESULTS: 'fingerprintResults',
  FINGERPRINT_SETTINGS: 'fingerprintSettings'
};

// 指纹识别配置
export const FINGERPRINT_CONFIG = {
  HEADERS: [
    // 服务器指纹
    {type: 'server',name: 'Apache',pattern: /apache\/?([\d\.]+)?/i,header: 'server',value:'version'},
    {type: 'server',name: 'Apache Tomcat',pattern: /apache-(coyote)\/?([\d\.]+)?/i,header: 'server',value:'component,version',extType: 'technology', extName: 'Java'},
    {type: 'server',name: 'Nginx',pattern: /nginx\/?([\d\.]+)?/i,header: 'server',value:'version'},
    {type: 'server',name: 'IIS',pattern: /microsoft-iis\/?([\d\.]+)?/i,header: 'server',value:'version',extType: 'os', extName: 'Windows'},
    {type: 'server',name: 'Jetty',pattern: /jetty\s?\/?\(?([0-9a-zA-Z.-]*)\)?/i,header: 'server',value:'version',extType: 'technology', extName: 'Java'},
    {type: 'server',name: 'Resin',pattern: /resin\/?([\d\.]+)?/i,header: 'server',value:'version'},
    {type: 'server',name: 'Varnish',pattern: /varnish\/?([\d\.]+)?/i,header: 'server',value:'version'},
    {type: 'server',name: 'OpenResty',pattern: /openresty\/?([\d\.]+)?/i,header: 'server',value:'version',extType: 'server', extName: 'Nginx'},
    {type: 'server',name: 'Tengine',pattern: /tengine\/?([\d\.]+)?/i,header: 'server',value:'version'},
    {type: 'server',name: 'BWS',pattern: /bws\/?([\d\.]+)?/i,header: 'server',value:'version'},
    {type: 'server',name: 'Zeus',pattern: /zeus\/?([\d\.]+)?/i,header: 'server',value:'version'},
    {type: 'server',name: 'LiteSpeed',pattern: /litespeed\/?([\d\.]+)?/i,header: 'server',value:'version'},
    {type: 'server',name: 'Kestrel',pattern: /kestrel\/?([\d\.]+)?/i,header: 'server',value:'version',extType: 'framework', extName: 'ASP.NET Core'},
    
    // CDN 指纹 - 只保留Cloudflare作为代表
    {type: 'cdn',name: 'Cloudflare',pattern: /.+/i,header: 'cf-ray',value:'ray_id'},
    
    // WAF 指纹 - 只保留ModSecurity作为代表
    {type: 'security',name: 'ModSecurity',pattern: /mod_security/i,header: 'server',value:'version'},
    
    // 组件指纹 - 只保留OpenSSL作为代表
    {type: 'component',name: 'OpenSSL',pattern: /openssl\s?\/?\(?([0-9a-zA-Z.-]*)\)?/i,header: 'server',value:'version'},
    
    // 操作系统指纹
    {type: 'os',name: 'Windows',pattern: /win64|win32|win10|win7|win8|win11/i,header: 'server'},  
    {type: 'os',name: 'Ubuntu',pattern: /ubuntu/i,header: 'server'},
    {type: 'os',name: 'Unix',pattern: /unix/i,header: 'server'},
    {type: 'os',name: 'CentOS',pattern: /centos/i,header: 'server'},
    {type: 'os',name: 'Debian',pattern: /debian/i,header: 'server'},
    {type: 'os',name: 'Red Hat',pattern: /red\s?hat|rhel/i,header: 'server'},
    
    // 框架指纹
    {type: 'framework',name: 'Spring',pattern: /([a-zA-Z0-9\.\-]+):([a-zA-Z0-9\-]+):(\d+)/i,header: 'x-application-context',value:'app,env,port',extType: 'technology', extName: 'Java'},
    {type: 'framework',name: 'JFinal',pattern: /jfinal\s?\/?([\d\.]+)?/i,header: 'server',value:'version',extType: 'technology', extName: 'Java'},
    {type: 'framework',name: 'ASP.NET',pattern: /[0-9.]+/i,header: 'x-aspnet-version',value:'version'},
   
    // 技术栈指纹
    {type: 'technology',name: 'PHP',pattern:/php\/?([\d\.]+)?/i,header: 'x-powered-by',value:'version'},
    {type: 'technology',name: 'Java',pattern: /java/i,header: 'x-powered-by'},
    {type: 'technology',name: 'Python',pattern: /python\/?([\d\.]+)?/i,header: 'server',value:'version'},
    {type: 'technology',name: 'Node.js',pattern: /node\.js/i,header: 'x-powered-by'},
    {type: 'technology',name: 'Ruby',pattern: /ruby/i,header: 'x-powered-by'},
    {type: 'technology',name: 'Go',pattern: /go\/?([\d\.]+)?/i,header: 'server',value:'version'},
    {type: 'technology',name: 'Perl',pattern: /perl/i,header: 'x-powered-by'},
  ],
  
  // Cookie 识别配置
  COOKIES: [
    {type: 'technology',name: 'PHP',match: /PHPSESSID/i},
    {type: 'framework',name: 'ASP.NET',match: /ASP\.NET_SessionId|ASPSESSIONID/i},
    {type: 'technology',name: 'Java',match: /JSESSIONID|jeesite/i},
    {type: 'framework',name: 'Django',match: /django_session/i},
    {type: 'framework',name: 'Laravel',match: /laravel_session/i},
  ],

  // WAF和安全服务检测
  WAF: {
    'cloudflare-waf': {
      name: 'Cloudflare WAF',
      pattern: 'cloudflare.com|cf-ray',
      description: 'Cloudflare Web应用防火墙',
      version: '',
      type: 'security'
    }
  }
};

// 指纹设置接口
export interface FingerprintSettings {
  enableAutoScan: boolean;
  scanOnPageLoad: boolean;
  includeJavaScript: boolean;
  includeCSS: boolean;
  includeMetaTags: boolean;
  maxResultsToStore: number;
}

// 默认指纹设置
export const DEFAULT_FINGERPRINT_SETTINGS: FingerprintSettings = {
  enableAutoScan: true,
  scanOnPageLoad: false,
  includeJavaScript: true,
  includeCSS: true,
  includeMetaTags: true,
  maxResultsToStore: 100
};

// 检测HTTP请求指纹 - 核心功能
async function detectHTTPFingerprints(requestDetails: any, rules: FingerprintRule[]): Promise<FingerprintInfo[]> {
  const fingerprints: FingerprintInfo[] = [];
  const url = requestDetails.url;
  
  // 早期退出：如果没有启用的规则，直接返回
  const enabledRules = rules.filter(rule => rule.enabled);
  if (enabledRules.length === 0) {
    return fingerprints;
  }
  
  // 处理headers格式（可能是数组或对象）
  let headers: { [key: string]: string } = {};
  if (requestDetails.responseHeaders) {
    if (Array.isArray(requestDetails.responseHeaders)) {
      // 如果是数组格式（webRequest API），转换为对象
      requestDetails.responseHeaders.forEach((header: any) => {
        if (header.name && header.value) {
          headers[header.name.toLowerCase()] = header.value;
        }
      });
    } else {
      // 如果已经是对象格式，直接使用
      headers = requestDetails.responseHeaders;
    }
  }
  
  const body = requestDetails.responseBody || '';
  
  // 性能优化：按匹配目标分组规则，避免重复处理
  const rulesByTarget = new Map<MatchTarget, FingerprintRule[]>();
  enabledRules.forEach(rule => {
    if (!rulesByTarget.has(rule.matchTarget)) {
      rulesByTarget.set(rule.matchTarget, []);
    }
    rulesByTarget.get(rule.matchTarget)!.push(rule);
  });
  
  try {
    // 高效的分组检测逻辑
    const processRules = (rules: FingerprintRule[], target: MatchTarget) => {
    for (const rule of rules) {
        // 预编译正则表达式以提高性能
        if (!rule.compiledRegex) {
          try {
            rule.compiledRegex = new RegExp(rule.pattern, 'i');
          } catch (regexError) {
            continue;
          }
        }
      
      let matched = false;
      let matchedContent = '';
      let detectionMethod: 'header' | 'body' | 'javascript' | 'meta' | 'url' = 'url';
      
      // 根据匹配目标进行检测
        switch (target) {
        case MatchTarget.RESPONSE_HEADER:
          if (rule.targetField) {
            const headerValue = headers[rule.targetField.toLowerCase()];
              if (headerValue && rule.compiledRegex.test(headerValue)) {
              matched = true;
              matchedContent = headerValue;
              detectionMethod = 'header';
            }
          }
          break;
          
        case MatchTarget.RESPONSE_BODY:
            if (body && rule.compiledRegex.test(body)) {
            matched = true;
              matchedContent = body.substring(0, 200) + (body.length > 200 ? '...' : '');
            detectionMethod = 'body';
          }
          break;
          
        case MatchTarget.URL:
            if (rule.compiledRegex.test(url)) {
            matched = true;
            matchedContent = url;
            detectionMethod = 'url';
          }
          break;
          
        case MatchTarget.COOKIE:
            const setCookies = headers['set-cookie'];
            const cookies = headers['cookie'];
            
            // 处理数组格式的set-cookie头
            let cookieString = '';
            if (setCookies) {
              cookieString = Array.isArray(setCookies) ? setCookies.join('; ') : setCookies;
            } else if (cookies) {
              cookieString = cookies;
            }
            
            if (cookieString && rule.compiledRegex.test(cookieString)) {
            matched = true;
              matchedContent = cookieString.substring(0, 200) + (cookieString.length > 200 ? '...' : '');
            detectionMethod = 'header';
          }
          break;
      }
      
      // 如果匹配成功，创建指纹信息
      if (matched) {
        // 避免重复结果
        const existingFingerprint = fingerprints.find(fp => 
          fp.name === rule.name && fp.url === url
        );
        
        if (!existingFingerprint) {
          fingerprints.push({
            id: `${rule.name.toLowerCase()}-${Date.now()}`,
            name: rule.name,
            type: rule.type,
            description: rule.description,
            riskLevel: rule.riskLevel,
            detectionMethod,
            matchedContent,
            source: `${detectionMethod} detection`,
            url,
            timestamp: Date.now()
          });
        }
      }
    }
    };

    // 按优先级处理不同类型的匹配目标
    rulesByTarget.forEach((rules, target) => {
      processRules(rules, target);
    });
    
    // 检测预设的HTTP头部指纹
    for (const header of FINGERPRINT_CONFIG.HEADERS) {
      const headerValue = headers[header.header.toLowerCase()];
      if (headerValue && header.pattern && header.pattern.test(headerValue)) {
        // 避免重复结果
        const existingFingerprint = fingerprints.find(fp => 
          fp.name === header.name && fp.url === url
        );
        
        if (!existingFingerprint) {
          fingerprints.push({
            id: `${header.name.toLowerCase()}-header-${Date.now()}`,
            name: header.name,
            type: header.type as FingerprintType,
            description: `通过HTTP响应头检测到${header.name}`,
            riskLevel: 'low',
            detectionMethod: 'header',
            matchedContent: headerValue,
            source: `${header.header} Header`,
            url,
            timestamp: Date.now()
          });
        }
      }
    }
    
    // 检测WAF和安全服务指纹
    if (FINGERPRINT_CONFIG.WAF) {
      for (const [key, config] of Object.entries(FINGERPRINT_CONFIG.WAF)) {
        if (url.includes(config.pattern) || headers['server']?.toLowerCase().includes(config.pattern.toLowerCase())) {
        // 避免重复结果
        const existingFingerprint = fingerprints.find(fp => 
          fp.name === config.name && fp.url === url
        );
        
        if (!existingFingerprint) {
          fingerprints.push({
            id: `${config.name}-network-${Date.now()}`,
            name: config.name,
              type: FingerprintType.SECURITY,
              version: config.version || '',
            description: config.description,
              riskLevel: 'medium',
            detectionMethod: 'url',
            matchedContent: url,
            source: 'Network Request',
            url,
            timestamp: Date.now()
          });
          }
        }
      }
    }
    
  } catch (error) {
    // 静默处理
  }
  
  return fingerprints;
}

export class FingerprintService {
  // 预设指纹规则库
  private presetRules: Partial<FingerprintRule>[] = [
    // 框架指纹
    {
      name: "Vue.js",
      pattern: "vue|vue-router|vuex",
      type: FingerprintType.FRAMEWORK,
      matchTarget: MatchTarget.PAGE_CONTENT,
      versionPattern: "vue@([\\d.]+)",
      description: "Vue.js JavaScript框架",
      riskLevel: 'low',
      references: ['https://vuejs.org/'],
      enabled: true
    },
  
    // 服务器指纹
    {
      name: "Nginx",
      pattern: "nginx",
      type: FingerprintType.SERVER,
      matchTarget: MatchTarget.RESPONSE_HEADER,
      versionPattern: "nginx/([\\d.]+)",
      description: "Nginx Web服务器",
      riskLevel: 'low',
      references: ['https://nginx.org/'],
      enabled: true
    },
    {
      name: "Apache",
      pattern: "apache|httpd",
      type: FingerprintType.SERVER,
      matchTarget: MatchTarget.RESPONSE_HEADER,
      versionPattern: "apache/([\\d.]+)",
      description: "Apache HTTP服务器",
      riskLevel: 'low',
      references: ['https://httpd.apache.org/'],
      enabled: true
    },
    {
      name: "IIS",
      pattern: "iis|microsoft-iis",
      type: FingerprintType.SERVER,
      matchTarget: MatchTarget.RESPONSE_HEADER,
      versionPattern: "iis/([\\d.]+)",
      description: "Microsoft IIS服务器",
      riskLevel: 'low',
      references: ['https://www.iis.net/'],
      enabled: true
    },
    {
      name: "LiteSpeed",
      pattern: "litespeed|ls-",
      type: FingerprintType.SERVER,
      matchTarget: MatchTarget.RESPONSE_HEADER,
      description: "LiteSpeed Web服务器",
      riskLevel: 'low',
      references: ['https://www.litespeedtech.com/'],
      enabled: true
    },
    // 安全组件
    {
      name: "Cloudflare",
      pattern: "cloudflare|cf-ray",
      type: FingerprintType.SECURITY,
      matchTarget: MatchTarget.RESPONSE_HEADER,
      description: "Cloudflare安全服务",
      riskLevel: 'low',
      references: ['https://cloudflare.com/'],
      enabled: true
    },
    {
      name: "WAF检测",
      pattern: "waf|firewall|security",
      type: FingerprintType.SECURITY,
      matchTarget: MatchTarget.RESPONSE_HEADER,
      description: "Web应用防火墙",
      riskLevel: 'low',
      references: [],
      enabled: true
    },
    // CMS系统
    {
      name: "WordPress",
      pattern: "wordpress|wp-content|wp-includes",
      type: FingerprintType.CMS,
      matchTarget: MatchTarget.PAGE_CONTENT,
      description: "WordPress内容管理系统",
      riskLevel: 'medium',
      references: ['https://wordpress.org/'],
      enabled: true
    },
   
    // CDN服务
    {
      name: "jsDelivr",
      pattern: "cdn\\.jsdelivr\\.net",
      type: FingerprintType.CDN,
      matchTarget: MatchTarget.URL,
      description: "jsDelivr CDN服务",
      riskLevel: 'low',
      references: ['https://jsdelivr.net/'],
      enabled: true
    },
    {
      name: "Cloudflare CDN",
      pattern: "cdn\\.cloudflare\\.com",
      type: FingerprintType.CDN,
      matchTarget: MatchTarget.URL,
      description: "Cloudflare CDN服务",
      riskLevel: 'low',
      references: ['https://cloudflare.com/'],
      enabled: true
    },
 
    // 更多服务器和中间件
    {
      name: "Caddy",
      pattern: "caddy",
      type: FingerprintType.SERVER,
      matchTarget: MatchTarget.RESPONSE_HEADER,
      targetField: "server",
      description: "Caddy Web服务器",
      riskLevel: 'low',
      references: ['https://caddyserver.com/'],
      enabled: true
    },
    {
      name: "Traefik",
      pattern: "traefik",
      type: FingerprintType.SERVER,
      matchTarget: MatchTarget.RESPONSE_HEADER,
      targetField: "server",
      description: "Traefik反向代理",
      riskLevel: 'low',
      references: ['https://traefik.io/'],
      enabled: true
    },
    {
      name: "Envoy",
      pattern: "envoy",
      type: FingerprintType.SERVER,
      matchTarget: MatchTarget.RESPONSE_HEADER,
      targetField: "server",
      description: "Envoy代理服务器",
      riskLevel: 'low',
      references: ['https://envoyproxy.io/'],
      enabled: true
    },
    // PHP框架
    {
      name: "ThinkPHP",
      pattern: "thinkphp|think_",
      type: FingerprintType.FRAMEWORK,
      matchTarget: MatchTarget.PAGE_CONTENT,
      description: "ThinkPHP框架",
      riskLevel: 'medium',
      references: ['http://thinkphp.cn/'],
      enabled: true
    },
    {
      name: "Yii Framework",
      pattern: "yii|yiiframework",
      type: FingerprintType.FRAMEWORK,
      matchTarget: MatchTarget.PAGE_CONTENT,
      description: "Yii PHP框架",
      riskLevel: 'medium',
      references: ['https://yiiframework.com/'],
      enabled: true
    },
    {
      name: "Zend Framework",
      pattern: "zend|zendframework",
      type: FingerprintType.FRAMEWORK,
      matchTarget: MatchTarget.PAGE_CONTENT,
      description: "Zend PHP框架",
      riskLevel: 'medium',
      references: ['https://framework.zend.com/'],
      enabled: true
    },
    {
      name: "CakePHP",
      pattern: "cakephp|cake_",
      type: FingerprintType.FRAMEWORK,
      matchTarget: MatchTarget.PAGE_CONTENT,
      description: "CakePHP框架",
      riskLevel: 'medium',
      references: ['https://cakephp.org/'],
      enabled: true
    },
    // Java应用服务器
    {
      name: "WebLogic",
      pattern: "weblogic",
      type: FingerprintType.SERVER,
      matchTarget: MatchTarget.RESPONSE_HEADER,
      targetField: "server",
      description: "Oracle WebLogic服务器",
      riskLevel: 'high',
      references: ['https://oracle.com/weblogic/'],
      enabled: true
    },
    {
      name: "WebSphere",
      pattern: "websphere",
      type: FingerprintType.SERVER,
      matchTarget: MatchTarget.RESPONSE_HEADER,
      targetField: "server",
      description: "IBM WebSphere服务器",
      riskLevel: 'high',
      references: ['https://ibm.com/websphere/'],
      enabled: true
    },
    {
      name: "GlassFish",
      pattern: "glassfish",
      type: FingerprintType.SERVER,
      matchTarget: MatchTarget.RESPONSE_HEADER,
      targetField: "server",
      description: "GlassFish应用服务器",
      riskLevel: 'medium',
      references: ['https://glassfish.org/'],
      enabled: true
    },
    {
      name: "JBoss/WildFly",
      pattern: "jboss|wildfly",
      type: FingerprintType.SERVER,
      matchTarget: MatchTarget.RESPONSE_HEADER,
      targetField: "server",
      description: "JBoss/WildFly应用服务器",
      riskLevel: 'medium',
      references: ['https://wildfly.org/'],
      enabled: true
    },
    // .NET框架
    {
      name: "ASP.NET Core",
      pattern: "aspnetcore|kestrel",
      type: FingerprintType.FRAMEWORK,
      matchTarget: MatchTarget.RESPONSE_HEADER,
      targetField: "server",
      description: "ASP.NET Core框架",
      riskLevel: 'low',
      references: ['https://asp.net/'],
      enabled: true
    },
    {
      name: "Blazor",
      pattern: "blazor|_blazor",
      type: FingerprintType.FRAMEWORK,
      matchTarget: MatchTarget.PAGE_CONTENT,
      description: "Blazor Web框架",
      riskLevel: 'low',
      references: ['https://blazor.net/'],
      enabled: true
    },
    // 企业级应用
    {
      name: "SAP",
      pattern: "sap|sapgui",
      type: FingerprintType.UTILITY,
      matchTarget: MatchTarget.PAGE_CONTENT,
      description: "SAP企业软件",
      riskLevel: 'high',
      references: ['https://sap.com/'],
      enabled: true
    },
    {
      name: "Oracle E-Business Suite",
      pattern: "oracle.*ebs|ebs.*oracle",
      type: FingerprintType.UTILITY,
      matchTarget: MatchTarget.PAGE_CONTENT,
      description: "Oracle企业业务套件",
      riskLevel: 'high',
      references: ['https://oracle.com/'],
      enabled: true
    },
    // 开发工具和IDE
    {
      name: "Jupyter Notebook",
      pattern: "jupyter|ipynb",
      type: FingerprintType.UTILITY,
      matchTarget: MatchTarget.PAGE_CONTENT,
      description: "Jupyter笔记本",
      riskLevel: 'medium',
      references: ['https://jupyter.org/'],
      enabled: true
    },
    {
      name: "GitLab",
      pattern: "gitlab",
      type: FingerprintType.UTILITY,
      matchTarget: MatchTarget.PAGE_CONTENT,
      description: "GitLab代码管理平台",
      riskLevel: 'medium',
      references: ['https://gitlab.com/'],
      enabled: true
    },
    {
      name: "Jenkins",
      pattern: "jenkins",
      type: FingerprintType.UTILITY,
      matchTarget: MatchTarget.PAGE_CONTENT,
      description: "Jenkins持续集成工具",
      riskLevel: 'high',
      references: ['https://jenkins.io/'],
      enabled: true
    },
    {
      name: "SonarQube",
      pattern: "sonarqube|sonar",
      type: FingerprintType.UTILITY,
      matchTarget: MatchTarget.PAGE_CONTENT,
      description: "SonarQube代码质量管理平台",
      riskLevel: 'medium',
      references: ['https://sonarqube.org/'],
      enabled: true
    },
    // 监控和运维工具
    {
      name: "Grafana",
      pattern: "grafana",
      type: FingerprintType.UTILITY,
      matchTarget: MatchTarget.PAGE_CONTENT,
      description: "Grafana监控仪表板",
      riskLevel: 'medium',
      references: ['https://grafana.com/'],
      enabled: true
    },
    {
      name: "Prometheus",
      pattern: "prometheus",
      type: FingerprintType.UTILITY,
      matchTarget: MatchTarget.PAGE_CONTENT,
      description: "Prometheus监控系统",
      riskLevel: 'medium',
      references: ['https://prometheus.io/'],
      enabled: true
    },
    {
      name: "Zabbix",
      pattern: "zabbix",
      type: FingerprintType.UTILITY,
      matchTarget: MatchTarget.PAGE_CONTENT,
      description: "Zabbix监控解决方案",
      riskLevel: 'medium',
      references: ['https://zabbix.com/'],
      enabled: true
    },
    {
      name: "Nagios",
      pattern: "nagios",
      type: FingerprintType.UTILITY,
      matchTarget: MatchTarget.PAGE_CONTENT,
      description: "Nagios网络监控系统",
      riskLevel: 'medium',
      references: ['https://nagios.org/'],
      enabled: true
    }

  ];

  // 加载指纹规则
  async loadRules(): Promise<FingerprintRule[]> {
    try {
      const result = await browser.storage.local.get(FINGERPRINT_STORAGE_KEYS.FINGERPRINT_RULES);
      const rules = result[FINGERPRINT_STORAGE_KEYS.FINGERPRINT_RULES];
      
      // 如果没有规则，初始化预设规则
      if (!rules || !Array.isArray(rules) || rules.length === 0) {
        return this.initializePresetRules();
      }
      
      // 检查是否需要更新内置规则（如果规则数量少于预期）
      const expectedBuiltinCount = this.presetRules.length + this.generateBuiltinRules().length;
      if (rules.length < expectedBuiltinCount) {
        return this.initializePresetRules();
      }
      
      return rules;
    } catch (error) {
      return [];
    }
  }

  // 初始化预设规则
  async initializePresetRules(): Promise<FingerprintRule[]> {
    const now = Date.now();
    
    // 合并预设规则和FINGERPRINT_CONFIG生成的规则
    const allPresetRules = [
      ...this.presetRules,
      ...this.generateBuiltinRules()
    ];
    
    const rules: FingerprintRule[] = allPresetRules.map((rule, index) => ({
      id: `preset-${index}`,
      name: rule.name || `规则${index + 1}`,
      pattern: rule.pattern || '',
      type: rule.type || FingerprintType.UTILITY,
      matchTarget: rule.matchTarget || MatchTarget.PAGE_CONTENT,
      targetField: rule.targetField || '',
      versionPattern: rule.versionPattern || '',
      description: rule.description || '',
      riskLevel: rule.riskLevel || 'low',
      references: rule.references || [],
      enabled: rule.enabled !== undefined ? rule.enabled : true,
      createdAt: now,
      updatedAt: now
    }));
    
    await browser.storage.local.set({ [FINGERPRINT_STORAGE_KEYS.FINGERPRINT_RULES]: rules });
    return rules;
  }

  // 保存指纹规则
  async saveRule(rule: FingerprintRule): Promise<void> {
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
      
      await browser.storage.local.set({ [FINGERPRINT_STORAGE_KEYS.FINGERPRINT_RULES]: rules });
    } catch (error) {
      throw error;
    }
  }

  // 删除指纹规则
  async deleteRule(ruleId: string): Promise<void> {
    try {
      const rules = await this.loadRules();
      const newRules = rules.filter(rule => rule.id !== ruleId);
      await browser.storage.local.set({ [FINGERPRINT_STORAGE_KEYS.FINGERPRINT_RULES]: newRules });
    } catch (error) {
      throw error;
    }
  }

  // 加载指纹设置
  async loadSettings(): Promise<FingerprintSettings> {
    try {
      const result = await browser.storage.local.get(FINGERPRINT_STORAGE_KEYS.FINGERPRINT_SETTINGS);
      return result[FINGERPRINT_STORAGE_KEYS.FINGERPRINT_SETTINGS] || DEFAULT_FINGERPRINT_SETTINGS;
    } catch (error) {
      return DEFAULT_FINGERPRINT_SETTINGS;
    }
  }

  // 保存指纹设置
  async saveSettings(settings: FingerprintSettings): Promise<void> {
    try {
      await browser.storage.local.set({ [FINGERPRINT_STORAGE_KEYS.FINGERPRINT_SETTINGS]: settings });
    } catch (error) {
      throw error;
    }
  }

  // 检测HTTP请求指纹 - 主要检测方法
  async detectHTTPFingerprints(requestDetails: any): Promise<FingerprintInfo[]> {
    const rules = await this.loadRules();
    return detectHTTPFingerprints(requestDetails, rules);
  }

  // 生成摘要
  private generateSummary(fingerprints: FingerprintInfo[]) {
    const summary = {
      total: fingerprints.length,
      byType: {} as Record<FingerprintType, number>,
      byRisk: {} as Record<string, number>
    };

    // 初始化计数
    Object.values(FingerprintType).forEach(type => {
      summary.byType[type] = 0;
    });

    // 统计
    fingerprints.forEach(fp => {
      summary.byType[fp.type]++;
      summary.byRisk[fp.riskLevel] = (summary.byRisk[fp.riskLevel] || 0) + 1;
    });

    return summary;
  }

  // 保存指纹检测结果
  async saveFingerprintResult(result: FingerprintResult): Promise<void> {
    try {
      const key = `fingerprint_${Date.now()}`;
      await browser.storage.local.set({ [key]: result });
    } catch (error) {
      throw error;
    }
  }

  // 加载指纹检测历史（自动去重）
  async loadFingerprintHistory(): Promise<FingerprintResult[]> {
    try {
      const result = await browser.storage.local.get(null);
      const fingerprints: FingerprintResult[] = [];
      
      Object.keys(result).forEach(key => {
        if (key.startsWith('fingerprint_')) {
          fingerprints.push(result[key]);
        }
      });
      
      // 自动去重：按域名/IP分组，合并指纹
      const deduplicatedResults = this.deduplicateResults(fingerprints);
      
      return deduplicatedResults.sort((a, b) => b.timestamp - a.timestamp);
    } catch (error) {
      return [];
    }
  }

  // 从FINGERPRINT_CONFIG生成完整的内置规则
  private generateBuiltinRules(): Partial<FingerprintRule>[] {
    const builtinRules: Partial<FingerprintRule>[] = [];
    
    // 从HEADERS配置生成规则
    FINGERPRINT_CONFIG.HEADERS.forEach((header: any, index) => {
      if (header.pattern) {
        const rule: Partial<FingerprintRule> = {
          name: header.name,
          pattern: header.pattern.source || header.pattern.toString(),
          type: this.mapConfigTypeToFingerprintType(header.type),
          matchTarget: MatchTarget.RESPONSE_HEADER,
          targetField: header.header,
          versionPattern: header.value || '',
          description: `${header.name} ${header.type} 检测`,
          riskLevel: 'low',
          references: [],
          enabled: true
        };
        builtinRules.push(rule);
      }
    });
    
    // 从COOKIES配置生成规则
    FINGERPRINT_CONFIG.COOKIES.forEach((cookie: any, index) => {
      if (cookie.match) {
        const rule: Partial<FingerprintRule> = {
          name: cookie.name,
          pattern: cookie.match.source || cookie.match.toString(),
          type: this.mapConfigTypeToFingerprintType(cookie.type),
          matchTarget: MatchTarget.COOKIE,
          description: `${cookie.name} Cookie 检测`,
          riskLevel: 'low',
          references: [],
          enabled: true
        };
        builtinRules.push(rule);
      }
    });
    
    // 从WAF配置生成规则
    if (FINGERPRINT_CONFIG.WAF) {
      Object.entries(FINGERPRINT_CONFIG.WAF).forEach(([key, waf]: [string, any]) => {
      const rule: Partial<FingerprintRule> = {
          name: waf.name,
          pattern: waf.pattern,
          type: FingerprintType.SECURITY,
        matchTarget: MatchTarget.URL,
          description: waf.description,
          riskLevel: 'medium',
        references: [],
        enabled: true
      };
      builtinRules.push(rule);
    });
    }
    
    return builtinRules;
  }

  // 映射配置类型到指纹类型
  private mapConfigTypeToFingerprintType(configType: string): FingerprintType {
    const typeMap: { [key: string]: FingerprintType } = {
      'server': FingerprintType.SERVER,
      'framework': FingerprintType.FRAMEWORK,
      'technology': FingerprintType.TECHNOLOGY,
      'component': FingerprintType.COMPONENT,
      'os': FingerprintType.OS,
      'security': FingerprintType.SECURITY,
      'cdn': FingerprintType.CDN,
      'cms': FingerprintType.CMS,
      'social': FingerprintType.SOCIAL,
      'advertising': FingerprintType.ADVERTISING,
      'utility': FingerprintType.UTILITY
    };
    return typeMap[configType] || FingerprintType.TECHNOLOGY;
  }

  // 自动去重逻辑
  private deduplicateResults(results: FingerprintResult[]): FingerprintResult[] {
    const domainMap = new Map<string, FingerprintResult>();
    
    results.forEach(result => {
      const domain = this.extractDomain(result.url);
      
      if (domainMap.has(domain)) {
        // 合并指纹，避免重复
        const existing = domainMap.get(domain)!;
        const mergedFingerprints = this.mergeFingerprints(existing.fingerprints, result.fingerprints);
        
        domainMap.set(domain, {
          ...existing,
          url: domain, // 使用域名作为显示URL
          timestamp: Math.max(existing.timestamp, result.timestamp), // 使用最新时间
          fingerprints: mergedFingerprints,
          summary: {
            total: mergedFingerprints.length,
            byType: this.generateSummary(mergedFingerprints).byType,
            byRisk: this.generateSummary(mergedFingerprints).byRisk
          }
        });
      } else {
        // 新域名，直接添加
        domainMap.set(domain, {
          ...result,
          url: domain
        });
      }
    });
    
    return Array.from(domainMap.values());
  }

  // 提取域名/IP
  private extractDomain(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch {
      // 如果URL解析失败，尝试提取IP或域名
      const match = url.match(/https?:\/\/([^\/\?]+)/);
      if (match) {
        return match[1];
      }
      return url;
    }
  }

  // 合并指纹，避免重复
  private mergeFingerprints(existing: FingerprintInfo[], newFingerprints: FingerprintInfo[]): FingerprintInfo[] {
    const merged = new Map<string, FingerprintInfo>();
    
    // 添加现有指纹
    existing.forEach(fp => {
      const key = `${fp.name}-${fp.type}`;
      merged.set(key, fp);
    });
    
    // 添加新指纹，如果已存在则更新
    newFingerprints.forEach(fp => {
      const key = `${fp.name}-${fp.type}`;
      if (merged.has(key)) {
        // 如果已存在，使用最新的信息
        const existing = merged.get(key)!;
        merged.set(key, {
          ...existing,
          timestamp: Math.max(existing.timestamp, fp.timestamp),
          matchedContent: fp.matchedContent || existing.matchedContent
        });
      } else {
        merged.set(key, fp);
      }
    });
    
    return Array.from(merged.values());
  }

  // 导出指纹规则
  async exportRules(): Promise<string> {
    try {
      const rules = await this.loadRules();
      return JSON.stringify(rules, null, 2);
    } catch (error) {
      throw error;
    }
  }

  // 强制重新初始化内置规则
  async reinitializeBuiltinRules(): Promise<FingerprintRule[]> {
    try {
      const rules = await this.initializePresetRules();
      return rules;
    } catch (error) {
      throw error;
    }
  }

  // 清空所有检测结果
  async clearAllResults(): Promise<void> {
    try {
      const result = await browser.storage.local.get(null);
      const keysToRemove: string[] = [];
      
      Object.keys(result).forEach(key => {
        if (key.startsWith('fingerprint_')) {
          keysToRemove.push(key);
        }
      });
      
      if (keysToRemove.length > 0) {
        await browser.storage.local.remove(keysToRemove);
      }
    } catch (error) {
      throw error;
    }
  }

  // 导入指纹规则
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
      const normalizedRules: FingerprintRule[] = validRules.map((rule, index) => ({
        id: rule.id || `imported-${now}-${index}`,
        name: rule.name,
        pattern: rule.pattern,
        type: rule.type || FingerprintType.UTILITY,
        matchTarget: rule.matchTarget || MatchTarget.PAGE_CONTENT,
        versionPattern: rule.versionPattern || '',
        description: rule.description || '',
        riskLevel: rule.riskLevel || 'low',
        references: rule.references || [],
        enabled: rule.enabled !== undefined ? rule.enabled : true,
        createdAt: rule.createdAt || now,
        updatedAt: now
      }));
      
      await browser.storage.local.set({ [FINGERPRINT_STORAGE_KEYS.FINGERPRINT_RULES]: normalizedRules });
      return true;
    } catch (error) {
      return false;
    }
  }

  // 切换规则启用/禁用状态
  async toggleRuleEnabled(ruleId: string, enabled: boolean): Promise<void> {
    try {
      const rules = await this.loadRules();
      const ruleIndex = rules.findIndex(rule => rule.id === ruleId);
      
      if (ruleIndex >= 0) {
        rules[ruleIndex].enabled = enabled;
        rules[ruleIndex].updatedAt = Date.now();
        // 清除预编译的正则表达式缓存
        delete rules[ruleIndex].compiledRegex;
        
        await browser.storage.local.set({ [FINGERPRINT_STORAGE_KEYS.FINGERPRINT_RULES]: rules });
      } else {
        throw new Error(`规则未找到: ${ruleId}`);
      }
    } catch (error) {
      throw error;
    }
  }

  // 批量切换规则状态
  async batchToggleRules(ruleIds: string[], enabled: boolean): Promise<void> {
    try {
      const rules = await this.loadRules();
      const now = Date.now();
      let changed = false;

      ruleIds.forEach(ruleId => {
        const ruleIndex = rules.findIndex(rule => rule.id === ruleId);
        if (ruleIndex >= 0) {
          rules[ruleIndex].enabled = enabled;
          rules[ruleIndex].updatedAt = now;
          delete rules[ruleIndex].compiledRegex;
          changed = true;
        }
      });

      if (changed) {
        await browser.storage.local.set({ [FINGERPRINT_STORAGE_KEYS.FINGERPRINT_RULES]: rules });
      }
    } catch (error) {
      throw error;
    }
  }

  // 按类型切换规则状态
  async toggleRulesByType(type: FingerprintType, enabled: boolean): Promise<void> {
    try {
      const rules = await this.loadRules();
      const now = Date.now();
      let changed = false;

      rules.forEach(rule => {
        if (rule.type === type) {
          rule.enabled = enabled;
          rule.updatedAt = now;
          // 清除预编译的正则表达式缓存
          delete rule.compiledRegex;
          changed = true;
        }
      });

      if (changed) {
        await browser.storage.local.set({ [FINGERPRINT_STORAGE_KEYS.FINGERPRINT_RULES]: rules });
      }
    } catch (error) {
      throw error;
    }
  }
}

export const fingerprintService = new FingerprintService();
