// 编码解码服务
export interface EncoderDecoderMethod {
  id: string;
  name: string;
  description: string;
  encode: (input: string) => string;
  decode: (input: string) => string;
}

export class EncoderDecoderService {
  private methods: EncoderDecoderMethod[] = [
    // URL编码
    {
      id: 'url',
      name: 'URL (%xx)',
      description: 'URL百分号编码',
      encode: (input: string) => encodeURIComponent(input),
      decode: (input: string) => {
        try {
          return decodeURIComponent(input);
        } catch {
          return 'Invalid URL encoding';
        }
      }
    },
    // URL Unicode编码
    {
      id: 'url-unicode',
      name: 'URL Unicode (%uXXXX)',
      description: 'URL Unicode编码',
      encode: (input: string) => {
        return input.replace(/[\u0080-\uFFFF]/g, match => {
          return '%u' + ('0000' + match.charCodeAt(0).toString(16).toUpperCase()).slice(-4);
        });
      },
      decode: (input: string) => {
        try {
          return input.replace(/%u([0-9a-fA-F]{4})/g, (match, hex) => {
            return String.fromCharCode(parseInt(hex, 16));
          });
        } catch {
          return 'Invalid URL Unicode encoding';
        }
      }
    },
    // Base64编码
    {
      id: 'base64',
      name: 'Base64',
      description: 'Base64编码',
      encode: (input: string) => btoa(unescape(encodeURIComponent(input))),
      decode: (input: string) => {
        try {
          return decodeURIComponent(escape(atob(input)));
        } catch {
          return 'Invalid Base64 encoding';
        }
      }
    },
    // Base64 URL Safe
    {
      id: 'base64url',
      name: 'Base64 URL Safe',
      description: 'Base64 URL安全编码',
      encode: (input: string) => {
        const base64 = btoa(unescape(encodeURIComponent(input)));
        return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
      },
      decode: (input: string) => {
        try {
          let base64 = input.replace(/-/g, '+').replace(/_/g, '/');
          // 补齐padding
          while (base64.length % 4) {
            base64 += '=';
          }
          return decodeURIComponent(escape(atob(base64)));
        } catch {
          return 'Invalid Base64 URL Safe encoding';
        }
      }
    },
    // HTML实体编码
    {
      id: 'html-entity',
      name: 'HTML Entity',
      description: 'HTML实体编码',
      encode: (input: string) => {
        return input.split('').map(char => {
          const code = char.charCodeAt(0);
          // 对非ASCII字符进行数字实体编码
          if (code > 127) {
            return `&#${code};`;
          }
          // 对特殊HTML字符进行命名实体编码
          const entityMap: { [key: string]: string } = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;',
            '/': '&#x2F;'
          };
          return entityMap[char] || char;
        }).join('');
      },
      decode: (input: string) => {
        // 先处理数字实体 &#数字;
        let result = input.replace(/&#(\d+);/g, (match, num) => {
          try {
            return String.fromCharCode(parseInt(num, 10));
          } catch {
            return match;
          }
        });
        
        // 再处理十六进制实体 &#xHEX;
        result = result.replace(/&#x([0-9a-fA-F]+);/g, (match, hex) => {
          try {
            return String.fromCharCode(parseInt(hex, 16));
          } catch {
            return match;
          }
        });
        
        // 最后处理命名实体
        const entityMap: { [key: string]: string } = {
          '&amp;': '&',
          '&lt;': '<',
          '&gt;': '>',
          '&quot;': '"',
          '&#39;': "'",
          '&#x2F;': '/',
          '&apos;': "'",
          '&nbsp;': ' ',
          '&copy;': '©',
          '&reg;': '®',
          '&trade;': '™'
        };
        
        result = result.replace(/&[a-zA-Z]+;/g, match => entityMap[match] || match);
        
        return result;
      }
    },
    // Unicode码点
    {
      id: 'unicode',
      name: 'Unicode',
      description: 'Unicode码点编码',
      encode: (input: string) => {
        return input.split('').map(char => {
          const code = char.charCodeAt(0);
          return code > 127 ? '\\u' + ('0000' + code.toString(16)).slice(-4) : char;
        }).join('');
      },
      decode: (input: string) => {
        try {
          return input.replace(/\\u([0-9a-fA-F]{4})/g, (match, hex) => {
            return String.fromCharCode(parseInt(hex, 16));
          });
        } catch {
          return 'Invalid Unicode encoding';
        }
      }
    },
    // UTF-8字节
    {
      id: 'utf8-bytes',
      name: 'UTF-8 Bytes',
      description: 'UTF-8字节编码',
      encode: (input: string) => {
        const utf8 = unescape(encodeURIComponent(input));
        return utf8.split('').map(char => {
          const code = char.charCodeAt(0);
          return '\\x' + ('00' + code.toString(16)).slice(-2);
        }).join('');
      },
      decode: (input: string) => {
        try {
          const bytes = input.replace(/\\x([0-9a-fA-F]{2})/g, (match, hex) => {
            return String.fromCharCode(parseInt(hex, 16));
          });
          return decodeURIComponent(escape(bytes));
        } catch {
          return 'Invalid UTF-8 bytes encoding';
        }
      }
    },
    // Quoted-Printable
    {
      id: 'quoted-printable',
      name: 'Quoted-Printable',
      description: 'Quoted-Printable编码',
      encode: (input: string) => {
        return input.replace(/[^\x20-\x7E]/g, char => {
          const code = char.charCodeAt(0);
          return '=' + ('00' + code.toString(16).toUpperCase()).slice(-2);
        }).replace(/ $/gm, '=20').replace(/\t$/gm, '=09');
      },
      decode: (input: string) => {
        try {
          return input.replace(/=([0-9A-F]{2})/g, (match, hex) => {
            return String.fromCharCode(parseInt(hex, 16));
          }).replace(/=\r?\n/g, '');
        } catch {
          return 'Invalid Quoted-Printable encoding';
        }
      }
    },
    // 十六进制
    {
      id: 'hex',
      name: 'Hex',
      description: '十六进制编码',
      encode: (input: string) => {
        return input.split('').map(char => {
          return char.charCodeAt(0).toString(16).padStart(2, '0');
        }).join('');
      },
      decode: (input: string) => {
        try {
          const hex = input.replace(/\s/g, '');
          if (hex.length % 2 !== 0) {
            return 'Invalid hex length';
          }
          let result = '';
          for (let i = 0; i < hex.length; i += 2) {
            result += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
          }
          return result;
        } catch {
          return 'Invalid hex encoding';
        }
      }
    },
    // 十六进制（带分隔符）
    {
      id: 'hex-spaced',
      name: 'Hex (Spaced)',
      description: '十六进制编码（空格分隔）',
      encode: (input: string) => {
        return input.split('').map(char => {
          return char.charCodeAt(0).toString(16).padStart(2, '0');
        }).join(' ');
      },
      decode: (input: string) => {
        try {
          const hex = input.replace(/\s/g, '');
          if (hex.length % 2 !== 0) {
            return 'Invalid hex length';
          }
          let result = '';
          for (let i = 0; i < hex.length; i += 2) {
            result += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
          }
          return result;
        } catch {
          return 'Invalid hex encoding';
        }
      }
    },
    // 二进制
    {
      id: 'binary',
      name: 'Binary',
      description: '二进制编码',
      encode: (input: string) => {
        return input.split('').map(char => {
          return char.charCodeAt(0).toString(2).padStart(8, '0');
        }).join(' ');
      },
      decode: (input: string) => {
        try {
          const binary = input.replace(/\s/g, '');
          if (binary.length % 8 !== 0) {
            return 'Invalid binary length';
          }
          let result = '';
          for (let i = 0; i < binary.length; i += 8) {
            result += String.fromCharCode(parseInt(binary.substr(i, 8), 2));
          }
          return result;
        } catch {
          return 'Invalid binary encoding';
        }
      }
    },
    // 八进制
    {
      id: 'octal',
      name: 'Octal',
      description: '八进制编码',
      encode: (input: string) => {
        return input.split('').map(char => {
          return '\\' + char.charCodeAt(0).toString(8).padStart(3, '0');
        }).join('');
      },
      decode: (input: string) => {
        try {
          return input.replace(/\\([0-7]{3})/g, (match, octal) => {
            return String.fromCharCode(parseInt(octal, 8));
          });
        } catch {
          return 'Invalid octal encoding';
        }
      }
    },
    // JWT解码
    {
      id: 'jwt',
      name: 'JWT',
      description: 'JSON Web Token解析',
      encode: (input: string) => {
        return 'JWT encoding requires header, payload, and secret';
      },
      decode: (input: string) => {
        try {
          const parts = input.split('.');
          if (parts.length !== 3) {
            return 'Invalid JWT format (must have 3 parts)';
          }
          const header = JSON.parse(atob(parts[0].replace(/-/g, '+').replace(/_/g, '/')));
          const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
          return JSON.stringify({ header, payload }, null, 2);
        } catch {
          return 'Invalid JWT token';
        }
      }
    },
    // ROT13编码
    {
      id: 'rot13',
      name: 'ROT13',
      description: 'ROT13凯撒密码',
      encode: (input: string) => {
        return input.replace(/[a-zA-Z]/g, char => {
          const start = char <= 'Z' ? 65 : 97;
          return String.fromCharCode((char.charCodeAt(0) - start + 13) % 26 + start);
        });
      },
      decode: (input: string) => {
        // ROT13解码和编码是相同的
        return input.replace(/[a-zA-Z]/g, char => {
          const start = char <= 'Z' ? 65 : 97;
          return String.fromCharCode((char.charCodeAt(0) - start + 13) % 26 + start);
        });
      }
    },
    // 莫尔斯电码
    {
      id: 'morse',
      name: 'Morse Code',
      description: '莫尔斯电码',
      encode: (input: string) => {
        const morseMap: { [key: string]: string } = {
          'A': '.-', 'B': '-...', 'C': '-.-.', 'D': '-..', 'E': '.', 'F': '..-.',
          'G': '--.', 'H': '....', 'I': '..', 'J': '.---', 'K': '-.-', 'L': '.-..',
          'M': '--', 'N': '-.', 'O': '---', 'P': '.--.', 'Q': '--.-', 'R': '.-.',
          'S': '...', 'T': '-', 'U': '..-', 'V': '...-', 'W': '.--', 'X': '-..-',
          'Y': '-.--', 'Z': '--..', '0': '-----', '1': '.----', '2': '..---',
          '3': '...--', '4': '....-', '5': '.....', '6': '-....', '7': '--...',
          '8': '---..', '9': '----.', ' ': '/'
        };
        return input.toUpperCase().split('').map(char => morseMap[char] || char).join(' ');
      },
      decode: (input: string) => {
        const morseMap: { [key: string]: string } = {
          '.-': 'A', '-...': 'B', '-.-.': 'C', '-..': 'D', '.': 'E', '..-.': 'F',
          '--.': 'G', '....': 'H', '..': 'I', '.---': 'J', '-.-': 'K', '.-..': 'L',
          '--': 'M', '-.': 'N', '---': 'O', '.--.': 'P', '--.-': 'Q', '.-.': 'R',
          '...': 'S', '-': 'T', '..-': 'U', '...-': 'V', '.--': 'W', '-..-': 'X',
          '-.--': 'Y', '--..': 'Z', '-----': '0', '.----': '1', '..---': '2',
          '...--': '3', '....-': '4', '.....': '5', '-....': '6', '--...': '7',
          '---..': '8', '----.': '9', '/': ' '
        };
        return input.split(' ').map(code => morseMap[code] || code).join('');
      }
    },
    // ASCII码
    {
      id: 'ascii',
      name: 'ASCII Code',
      description: 'ASCII数字编码',
      encode: (input: string) => {
        return Array.from(input).map(char => char.charCodeAt(0)).join(' ');
      },
      decode: (input: string) => {
        try {
          return input.split(' ').map(num => String.fromCharCode(parseInt(num))).join('');
        } catch {
          return 'Invalid ASCII encoding';
        }
      }
    }
  ];

  // 获取所有编码方法
  getAllMethods(): EncoderDecoderMethod[] {
    return this.methods;
  }

  // 根据ID获取方法
  getMethodById(id: string): EncoderDecoderMethod | undefined {
    return this.methods.find(method => method.id === id);
  }

  // 编码
  encode(input: string, methodId: string): string {
    const method = this.getMethodById(methodId);
    if (!method) {
      throw new Error(`Unknown encoding method: ${methodId}`);
    }
    return method.encode(input);
  }

  // 解码
  decode(input: string, methodId: string): string {
    const method = this.getMethodById(methodId);
    if (!method) {
      throw new Error(`Unknown decoding method: ${methodId}`);
    }
    return method.decode(input);
  }

  // 批量编码（支持多行）
  batchEncode(input: string, methodId: string): string {
    const lines = input.split('\n');
    return lines.map(line => line.trim() ? this.encode(line, methodId) : '').join('\n');
  }

  // 批量解码（支持多行）
  batchDecode(input: string, methodId: string): string {
    const lines = input.split('\n');
    return lines.map(line => line.trim() ? this.decode(line, methodId) : '').join('\n');
  }

  // 增强的自动检测编码类型
  detectEncoding(input: string): string[] {
    const possibleEncodings: string[] = [];
    const trimmedInput = input.trim();

    // 检测JWT (三个部分用.分隔)
    if (/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(trimmedInput)) {
      possibleEncodings.push('jwt');
    }

    // 检测Base64 (更严格的检测)
    if (/^[A-Za-z0-9+/]*={0,2}$/.test(trimmedInput) && trimmedInput.length > 4 && trimmedInput.length % 4 === 0) {
      possibleEncodings.push('base64');
    }

    // 检测Base64URL
    if (/^[A-Za-z0-9_-]*={0,2}$/.test(trimmedInput) && trimmedInput.length > 4) {
      possibleEncodings.push('base64url');
    }

    // 检测URL编码
    if (/%[0-9A-Fa-f]{2}/.test(input)) {
      possibleEncodings.push('url');
    }

    // 检测URL Unicode编码
    if (/%u[0-9A-Fa-f]{4}/.test(input)) {
      possibleEncodings.push('url-unicode');
    }

    // 检测Unicode转义
    if (/\\u[0-9a-fA-F]{4}/.test(input)) {
      possibleEncodings.push('unicode');
    }

    // 检测十六进制
    if (/^[0-9A-Fa-f\s]+$/.test(trimmedInput) && trimmedInput.replace(/\s/g, '').length % 2 === 0 && trimmedInput.replace(/\s/g, '').length > 2) {
      possibleEncodings.push('hex');
    }

    // 检测带空格的十六进制
    if (/^([0-9A-Fa-f]{2}\s*)+$/.test(trimmedInput)) {
      possibleEncodings.push('hex-spaced');
    }

    // 检测HTML实体 (更严格的检测)
    if (/&[a-zA-Z]{2,};|&#\d{2,};|&#x[0-9a-fA-F]{2,};/.test(input)) {
      possibleEncodings.push('html-entity');
    }

    // 检测UTF-8字节序列
    if (/^(\d{1,3}\s*)+$/.test(trimmedInput)) {
      const bytes = trimmedInput.split(/\s+/).map(Number);
      if (bytes.every(b => b >= 0 && b <= 255)) {
        possibleEncodings.push('utf8-bytes');
      }
    }

    // 检测Quoted-Printable
    if (/=[0-9A-Fa-f]{2}/.test(input)) {
      possibleEncodings.push('quoted-printable');
    }

    // 检测二进制
    if (/^[01\s]+$/.test(trimmedInput) && trimmedInput.replace(/\s/g, '').length % 8 === 0 && trimmedInput.replace(/\s/g, '').length > 8) {
      possibleEncodings.push('binary');
    }

    // 检测八进制
    if (/\\[0-7]{3}/.test(input)) {
      possibleEncodings.push('octal');
    }

    // 检测ROT13 (简单启发式：如果解码后有更多常见英文单词)
    if (/^[a-zA-Z\s]+$/.test(trimmedInput) && trimmedInput.length > 10) {
      const rot13Result = this.decode(trimmedInput, 'rot13');
      if (this.hasCommonWords(rot13Result) && !this.hasCommonWords(trimmedInput)) {
        possibleEncodings.push('rot13');
      }
    }

    // 检测莫尔斯电码
    if (/^[.\-\s/]+$/.test(trimmedInput) && /[.\-]/.test(trimmedInput)) {
      possibleEncodings.push('morse');
    }

    // 检测ASCII码
    if (/^(\d{1,3}\s*)+$/.test(trimmedInput)) {
      const codes = trimmedInput.split(/\s+/).map(Number);
      if (codes.every(c => c >= 32 && c <= 126)) { // 可打印ASCII范围
        possibleEncodings.push('ascii');
      }
    }

    return possibleEncodings;
  }

  // 辅助函数：检测是否包含常见英文单词
  private hasCommonWords(text: string): boolean {
    const commonWords = ['the', 'and', 'is', 'in', 'to', 'of', 'a', 'that', 'it', 'with', 'for', 'as', 'was', 'on', 'are', 'you', 'this', 'be', 'at', 'have'];
    const words = text.toLowerCase().split(/\s+/);
    const commonWordCount = words.filter(word => commonWords.includes(word)).length;
    return commonWordCount >= Math.min(2, words.length * 0.3);
  }
}

export const encoderDecoderService = new EncoderDecoderService();

