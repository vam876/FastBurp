import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { encoderDecoderService, EncoderDecoderMethod } from '../services/encoder-decoder-service';
import { FiCode, FiCopy, FiTrash2, FiRefreshCw, FiInfo, FiEye, FiShield, FiGlobe, FiX, FiSave } from 'react-icons/fi';
import '../styles/EncoderDecoder.css';

interface EncoderDecoderProps {
  className?: string;
}

// 缓存接口
interface CacheEntry {
  input: string;
  method: string;
  isEncoding: boolean;
  output: string;
  timestamp: number;
}



const EncoderDecoder: React.FC<EncoderDecoderProps> = ({ className = '' }) => {
  const [inputText, setInputText] = useState('');
  const [outputText, setOutputText] = useState('');
  const [selectedMethod, setSelectedMethod] = useState('url');
  const [isEncoding, setIsEncoding] = useState(true);
  const [methods, setMethods] = useState<EncoderDecoderMethod[]>([]);
  const [detectedEncodings, setDetectedEncodings] = useState<string[]>([]);
  const [multipleResults, setMultipleResults] = useState<{method: string, result: string}[]>([]);
  const [showInfo, setShowInfo] = useState(false);
  const [leftPanelWidth, setLeftPanelWidth] = useState(50); // 左侧面板宽度百分比
  const [isDragging, setIsDragging] = useState(false);
  const [cache, setCache] = useState<Map<string, CacheEntry>>(new Map());
  const [autoSave, setAutoSave] = useState(true);
  
  // 引用元素用于更精确的拖动处理
  const containerRef = useRef<HTMLDivElement>(null);
  const resizeHandleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const allMethods = encoderDecoderService.getAllMethods();
    setMethods(allMethods);
    
    // 从本地存储加载数据
    loadFromStorage();
  }, []);

  // 本地存储功能
  const saveToStorage = useCallback(() => {
    if (!autoSave) return;
    
    const data = {
      inputText,
      outputText,
      selectedMethod,
      isEncoding,
      leftPanelWidth,
      timestamp: Date.now()
    };
    
    try {
      localStorage.setItem('fastburp-encoder-decoder', JSON.stringify(data));
    } catch (error) {
      // 静默处理
    }
  }, [inputText, outputText, selectedMethod, isEncoding, leftPanelWidth, autoSave]);

  const loadFromStorage = useCallback(() => {
    try {
      const saved = localStorage.getItem('fastburp-encoder-decoder');
      if (saved) {
        const data = JSON.parse(saved);
        // 检查数据是否过期（24小时）
        if (Date.now() - data.timestamp < 24 * 60 * 60 * 1000) {
          setInputText(data.inputText || '');
          setOutputText(data.outputText || '');
          setSelectedMethod(data.selectedMethod || 'url');
          setIsEncoding(data.isEncoding !== undefined ? data.isEncoding : true);
          setLeftPanelWidth(data.leftPanelWidth || 50);
        }
      }
    } catch (error) {
      // 静默处理
    }
  }, []);

  const clearStorage = useCallback(() => {
    try {
      localStorage.removeItem('fastburp-encoder-decoder');
      setInputText('');
      setOutputText('');
      setSelectedMethod('url');
      setIsEncoding(true);
      setLeftPanelWidth(50);
    } catch (error) {
      // 静默处理
    }
  }, []);

  // 自动保存
  useEffect(() => {
    if (autoSave && (inputText || outputText)) {
      const timer = setTimeout(saveToStorage, 1000); // 1秒后保存
      return () => clearTimeout(timer);
    }
  }, [inputText, outputText, selectedMethod, isEncoding, leftPanelWidth, saveToStorage, autoSave]);

  // 使用useMemo优化检测逻辑，避免重复计算
  const detectedMemo = useMemo(() => {
    if (!inputText.trim()) return [];
    return encoderDecoderService.detectEncoding(inputText);
  }, [inputText]);

  useEffect(() => {
    setDetectedEncodings(detectedMemo);
    
    // 自动解码：如果检测到编码且不是正在编码模式,自动解码
    if (detectedMemo.length > 0 && !isEncoding && inputText.trim()) {
      // 延迟执行解码,避免过于频繁
      const timer = setTimeout(() => {
        // 如果检测到多个编码,尝试解码所有
        const results: {method: string, result: string}[] = [];
        
        detectedMemo.forEach(methodId => {
          try {
            const result = encoderDecoderService.batchDecode(inputText, methodId);
            // 只添加有效的解码结果(与输入不同)
            if (result && result !== inputText && !result.startsWith('Invalid') && !result.startsWith('Error')) {
              results.push({ method: methodId, result });
            }
          } catch (error) {
            // 解码失败,跳过
          }
        });
        
        // 设置第一个结果为主输出
        if (results.length > 0) {
          setSelectedMethod(detectedMemo[0]);
          setOutputText(results[0].result);
          addToCache(inputText, detectedMemo[0], false, results[0].result);
          
          // 保存所有结果
          setMultipleResults(results);
        }
      }, 300);
      
      return () => clearTimeout(timer);
    } else {
      setMultipleResults([]);
    }
  }, [detectedMemo, inputText, isEncoding]);

  // 缓存键生成
  const getCacheKey = useCallback((input: string, method: string, isEnc: boolean) => {
    return `${method}-${isEnc ? 'enc' : 'dec'}-${input.substring(0, 100)}`;
  }, []);

  // 从缓存获取结果
  const getCachedResult = useCallback((input: string, method: string, isEnc: boolean): string | null => {
    const key = getCacheKey(input, method, isEnc);
    const cached = cache.get(key);
    if (cached && Date.now() - cached.timestamp < 5 * 60 * 1000) { // 5分钟缓存
      return cached.output;
    }
    return null;
  }, [cache, getCacheKey]);

  // 添加到缓存
  const addToCache = useCallback((input: string, method: string, isEnc: boolean, output: string) => {
    const key = getCacheKey(input, method, isEnc);
    const newCache = new Map(cache);
    newCache.set(key, {
      input,
      method,
      isEncoding: isEnc,
      output,
      timestamp: Date.now()
    });
    
    // 限制缓存大小
    if (newCache.size > 100) {
      const oldestKey = Array.from(newCache.keys())[0];
      newCache.delete(oldestKey);
    }
    
    setCache(newCache);
  }, [cache, getCacheKey]);



  // 简化的拖动处理函数
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    
    const startX = e.clientX;
    const startWidth = leftPanelWidth;
    
    const handleGlobalMouseMove = (moveEvent: MouseEvent) => {
      if (!containerRef.current) return;
      
      const containerRect = containerRef.current.getBoundingClientRect();
      const deltaX = moveEvent.clientX - startX;
      const deltaPercent = (deltaX / containerRect.width) * 100;
      const newWidth = startWidth + deltaPercent;
      
      // 限制最小和最大宽度
      const clampedWidth = Math.max(20, Math.min(80, newWidth));
      setLeftPanelWidth(clampedWidth);
    };
    
    const handleGlobalMouseUp = () => {
      setIsDragging(false);
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
    };
    
    document.addEventListener('mousemove', handleGlobalMouseMove);
    document.addEventListener('mouseup', handleGlobalMouseUp);
  }, [leftPanelWidth]);

  const handleDoubleClick = useCallback(() => {
    // 双击重置到默认宽度
    setLeftPanelWidth(50);
  }, []);



  const handleProcess = useCallback(() => {
    if (!inputText.trim()) {
      setOutputText('');
      return;
    }

    // 检查缓存
    const cachedResult = getCachedResult(inputText, selectedMethod, isEncoding);
    if (cachedResult) {
      setOutputText(cachedResult);
      return;
    }

    try {
      let result: string;
      if (isEncoding) {
        result = encoderDecoderService.batchEncode(inputText, selectedMethod);
      } else {
        result = encoderDecoderService.batchDecode(inputText, selectedMethod);
      }
      
      setOutputText(result);
      
      // 添加到缓存
      addToCache(inputText, selectedMethod, isEncoding, result);
      
    } catch (error) {
      const errorMessage = `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
      setOutputText(errorMessage);
    }
  }, [inputText, selectedMethod, isEncoding, getCachedResult, addToCache]);

  const handleClear = () => {
    setInputText('');
    setOutputText('');
    setDetectedEncodings([]);
  };

  const handleSwap = () => {
    const temp = inputText;
    setInputText(outputText);
    setOutputText(temp);
    setIsEncoding(!isEncoding);
  };

  const handleFormat = () => {
    if (!inputText.trim()) return;
    
    try {
      // 尝试格式化JSON
      if (inputText.trim().startsWith('{') || inputText.trim().startsWith('[')) {
        const parsed = JSON.parse(inputText);
        const formatted = JSON.stringify(parsed, null, 2);
        setInputText(formatted);
        return;
      }
      
      // 尝试格式化XML
      if (inputText.trim().startsWith('<')) {
        // 简单的XML格式化（移除多余空格，添加换行）
        const formatted = inputText
          .replace(/>\s+</g, '>\n<')
          .replace(/\n\s+/g, '\n')
          .trim();
        setInputText(formatted);
        return;
      }
      
      // 尝试格式化SQL
      if (inputText.toLowerCase().includes('select') || 
          inputText.toLowerCase().includes('insert') || 
          inputText.toLowerCase().includes('update') || 
          inputText.toLowerCase().includes('delete')) {
        const formatted = inputText
          .replace(/\s+/g, ' ')
          .replace(/\s*,\s*/g, ',\n  ')
          .replace(/\s*=\s*/g, ' = ')
          .replace(/\s*\(\s*/g, '(\n  ')
          .replace(/\s*\)\s*/g, '\n)')
          .trim();
        setInputText(formatted);
        return;
      }
      
      // 通用格式化：移除多余空格，规范化换行
      const formatted = inputText
        .replace(/\s+/g, ' ')
        .replace(/\n\s+/g, '\n')
        .trim();
      setInputText(formatted);
      
    } catch (error) {
      // 如果格式化失败，尝试通用格式化
      const formatted = inputText
        .replace(/\s+/g, ' ')
        .replace(/\n\s+/g, '\n')
        .trim();
      setInputText(formatted);
    }
  };

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (error) {
      // 静默处理
    }
  };

  const handleDetectedClick = (methodId: string) => {
    setSelectedMethod(methodId);
    setIsEncoding(false);
    setTimeout(handleProcess, 100);
  };

  const selectedMethodInfo = methods.find(m => m.id === selectedMethod);

  // 获取方法图标
  const getMethodIcon = (methodId: string) => {
    const iconMap: { [key: string]: React.ReactNode } = {
      'url': <FiGlobe size={14} />,
      'url-unicode': <FiGlobe size={14} />,
      'base64': <FiCode size={14} />,
      'base64url': <FiCode size={14} />,
      'html-entity': <FiCode size={14} />,
      'unicode': <FiCode size={14} />,
      'utf8-bytes': <FiCode size={14} />,
      'quoted-printable': <FiCode size={14} />,
      'hex': <FiCode size={14} />,
      'hex-spaced': <FiCode size={14} />,
      'binary': <FiCode size={14} />,
      'octal': <FiCode size={14} />
    };
    return iconMap[methodId] || <FiCode size={14} />;
  };

  return (
    <div className={`encoder-decoder ${className}`} ref={containerRef}>
      {/* 紧凑的顶部控制栏 */}
      <div className="top-controls">
        <div className="control-row">
          <div className="method-section">
            <div className="method-label">
              <FiCode size={14} />
              <span>方法:</span>
            </div>
            <select
              id="method-select"
              value={selectedMethod}
              onChange={(e) => setSelectedMethod(e.target.value)}
              className="method-select"
            >
              {methods.map(method => (
                <option key={method.id} value={method.id}>
                  {method.name}
                </option>
              ))}
            </select>
          </div>
          
          <div className="mode-section">
            <div className="mode-toggle">
              <button
                className={`mode-button ${isEncoding ? 'active' : ''}`}
                onClick={() => setIsEncoding(true)}
              >
                <FiShield size={14} />
                编码
              </button>
              <button
                className={`mode-button ${!isEncoding ? 'active' : ''}`}
                onClick={() => setIsEncoding(false)}
              >
                <FiEye size={14} />
                解码
              </button>
            </div>
          </div>
          
          <div className="action-section">
            <button className="process-button primary" onClick={handleProcess}>
              {isEncoding ? (
                <>
                  <FiShield size={14} />
                  执行
                </>
              ) : (
                <>
                  <FiEye size={14} />
                  执行
                </>
              )}
            </button>
            <button className="format-button" onClick={handleFormat} title="格式化文本">
              <FiCode size={14} />
            </button>
            <button className="swap-button" onClick={handleSwap} title="交换输入输出">
              <FiRefreshCw size={14} />
            </button>
            <button 
              className={`autosave-button ${autoSave ? 'active' : ''}`}
              onClick={() => setAutoSave(!autoSave)}
              title={autoSave ? "关闭自动保存" : "开启自动保存"}
            >
              <FiSave size={14} />
            </button>
            <button 
              className="clear-storage-button"
              onClick={clearStorage}
              title="清除保存的数据"
            >
              <FiTrash2 size={14} />
            </button>
            <button 
              className="info-button"
              onClick={() => setShowInfo(!showInfo)}
              title="使用说明"
            >
              <FiInfo size={14} />
            </button>
          </div>
        </div>
        
        {selectedMethodInfo && (
          <div className="method-description">
            {getMethodIcon(selectedMethodInfo.id)}
            <span>{selectedMethodInfo.description}</span>
            {/* 检测到的编码类型 - 移到方法描述右边 */}
            {detectedEncodings.length > 0 && (
              <div className="detected-inline">
                <span className="detected-label">检测到:</span>
                <div className="detected-buttons">
                  {detectedEncodings.map(encoding => {
                    const method = methods.find(m => m.id === encoding);
                    return method ? (
                      <button
                        key={encoding}
                        className="detected-button"
                        onClick={() => handleDetectedClick(encoding)}
                        title={`点击使用${method.name}解码`}
                      >
                        {getMethodIcon(encoding)}
                        <span>{method.name}</span>
                      </button>
                    ) : null;
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 主要内容区域 - 左右布局 */}
      <div className="encoder-content">
        {/* 左侧输入区域 */}
        <div 
          className="input-section"
          style={{ width: `${leftPanelWidth}%` }}
        >
          <div className="section-header">
            <div className="section-title">
              <FiEye size={14} />
              <span>输入 {isEncoding ? '(原文)' : '(编码)'}:</span>
            </div>
            <div className="section-actions">
              <button 
                onClick={handleClear} 
                title="清空"
                className="action-button"
              >
                <FiTrash2 size={12} />
              </button>
              <button 
                onClick={() => handleCopy(inputText)} 
                title="复制输入"
                className="action-button"
              >
                <FiCopy size={12} />
              </button>
            </div>
          </div>
          <textarea
            id="input-text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={isEncoding ? "输入要编码的文本..." : "输入要解码的文本..."}
            className="encoder-textarea"
          />
        </div>

        {/* 可拖动的分隔线 */}
        <div 
          ref={resizeHandleRef}
          className={`resize-handle ${isDragging ? 'dragging' : ''}`}
          onMouseDown={handleMouseDown}
          onDoubleClick={handleDoubleClick}
          title="拖动调整宽度，双击重置"
        />

        {/* 右侧输出区域 */}
        <div 
          className="output-section"
          style={{ width: `${100 - leftPanelWidth}%` }}
        >
          <div className="section-header">
            <div className="section-title">
              <FiCode size={14} />
              <span>输出 {isEncoding ? '(编码)' : '(原文)'}:</span>
            </div>
            <div className="section-actions">
              <button 
                onClick={() => handleCopy(outputText)} 
                title="复制输出"
                className="action-button"
              >
                <FiCopy size={12} />
              </button>
            </div>
          </div>
          <textarea
            id="output-text"
            value={outputText}
            onChange={(e) => setOutputText(e.target.value)}
            placeholder="处理结果将显示在这里..."
            className="encoder-textarea output"
          />
          
          {/* 多个解码结果展示 */}
          {multipleResults.length > 1 && (
            <div className="multiple-results">
              <div className="multiple-results-header">
                检测到 {multipleResults.length} 种可能的编码:
              </div>
              <div className="multiple-results-list">
                {multipleResults.map(({method, result}, index) => {
                  const methodInfo = methods.find(m => m.id === method);
                  return (
                    <div 
                      key={method} 
                      className={`result-item ${method === selectedMethod ? 'active' : ''}`}
                      onClick={() => {
                        setSelectedMethod(method);
                        setOutputText(result);
                      }}
                    >
                      <div className="result-method">
                        {getMethodIcon(method)}
                        <span>{methodInfo?.name || method}</span>
                      </div>
                      <div className="result-preview" title={result}>
                        {result.substring(0, 50)}{result.length > 50 ? '...' : ''}
                      </div>
                      <button 
                        className="result-copy"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopy(result);
                        }}
                        title="复制此结果"
                      >
                        <FiCopy size={12} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>





      {/* 使用说明 */}
      {showInfo && (
        <div className="info-section">
          <div className="info-header">
            <FiInfo size={14} />
            <h3>使用说明</h3>
            <button 
              className="close-info"
              onClick={() => setShowInfo(false)}
            >
              <FiX size={14} />
            </button>
          </div>
          <div className="info-content">
            <ul>
              <li>支持单行和多行文本处理</li>
              <li>系统会自动检测可能的编码类型</li>
              <li>点击检测到的编码类型可快速解码</li>
              <li>使用交换按钮可交换输入输出内容</li>
              <li>支持一键复制结果到剪贴板</li>
              <li>拖动中间分隔线可调整左右面板宽度</li>
              <li>自动保存功能会保存输入状态</li>
              <li>缓存机制提升重复操作性能</li>
              <li>格式化功能支持JSON、XML、SQL等</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default EncoderDecoder;
