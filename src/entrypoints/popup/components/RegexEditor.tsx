import React, { useState, useEffect } from 'react';
import { RegexRule, RegexRuleAction, RegexScope, regexService } from '../services/regex-service';
import { FiX, FiCheck } from 'react-icons/fi';

interface RegexEditorProps {
  rule: RegexRule | null;
  onSave: (rule: RegexRule) => void;
  onCancel: () => void;
  darkMode?: boolean;
}

const RegexEditor: React.FC<RegexEditorProps> = ({
  rule,
  onSave,
  onCancel,
  darkMode = false
}) => {
  const [formData, setFormData] = useState<RegexRule>({
    id: '',
    name: '',
    pattern: '',
    description: '',
    enabled: true,
    action: RegexRuleAction.RECORD,
    replacement: '',
    scope: RegexScope.ALL,
    createdAt: 0,
    updatedAt: 0
  });
  
  const [testString, setTestString] = useState('');
  const [testResult, setTestResult] = useState<{
    isValid: boolean;
    matches: { text: string; index: number }[];
    error?: string;
  } | null>(null);
  
  // 初始化表单数据
  useEffect(() => {
    if (rule) {
      setFormData({
        ...rule,
        // 确保replacement字段存在
        replacement: rule.replacement || ''
      });
    }
  }, [rule]);
  
  // 处理表单字段变化
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  // 处理复选框变化
  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: checked
    }));
  };
  
  // 处理保存
  const handleSave = () => {
    // 验证必填字段
    if (!formData.name.trim()) {
      alert('请输入规则名称');
      return;
    }
    
    if (!formData.pattern.trim()) {
      alert('请输入正则表达式');
      return;
    }
    
    // 验证正则表达式是否有效
    try {
      new RegExp(formData.pattern);
    } catch (e) {
      alert(`正则表达式无效: ${e instanceof Error ? e.message : String(e)}`);
      return;
    }
    
    // 如果是替换操作，确保有替换文本
    if (formData.action === RegexRuleAction.REPLACE && !formData.replacement) {
      alert('请输入替换文本');
      return;
    }
    
    onSave(formData);
  };
  
  // 测试正则表达式
  const testRegex = () => {
    if (!formData.pattern.trim() || !testString.trim()) {
      setTestResult(null);
      return;
    }
    
    const result = regexService.testRegex(formData.pattern, testString);
    setTestResult(result);
  };
  
  // 当正则表达式或测试字符串变化时，自动测试
  useEffect(() => {
    if (formData.pattern && testString) {
      testRegex();
    }
  }, [formData.pattern, testString]);
  
  // 渲染测试结果
  const renderTestResult = () => {
    if (!testResult) return null;
    
    if (!testResult.isValid) {
      return (
        <div className="test-result invalid">
          错误: {testResult.error}
        </div>
      );
    }
    
    if (testResult.matches.length === 0) {
      return (
        <div className="test-result valid">
          正则表达式有效，但没有匹配项。
        </div>
      );
    }
    
    // 高亮显示匹配项
    let highlightedText = testString;
    let offset = 0;
    
    // 按照索引从大到小排序，以便从后向前替换，避免索引变化
    const sortedMatches = [...testResult.matches].sort((a, b) => b.index - a.index);
    
    for (const match of sortedMatches) {
      const start = match.index;
      const end = match.index + match.text.length;
      
      highlightedText = 
        highlightedText.substring(0, start) +
        `<span class="match">${match.text}</span>` +
        highlightedText.substring(end);
    }
    
    return (
      <div className="test-result valid">
        <div>找到 {testResult.matches.length} 个匹配项:</div>
        <div dangerouslySetInnerHTML={{ __html: highlightedText }} />
      </div>
    );
  };
  
  return (
    <div className={`regex-editor ${darkMode ? 'dark' : ''}`} onClick={onCancel}>
      <div className="regex-editor-content" onClick={e => e.stopPropagation()}>
        <div className="regex-editor-header">
          <h3>{rule?.id ? '编辑规则' : '添加规则'}</h3>
          <button onClick={onCancel}><FiX size={18} /></button>
        </div>
        
        <div className="regex-editor-form">
          <div className="form-group">
            <label htmlFor="name">规则名称</label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="输入规则名称"
              required
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="pattern">正则表达式</label>
            <input
              type="text"
              id="pattern"
              name="pattern"
              value={formData.pattern}
              onChange={handleChange}
              placeholder="输入正则表达式"
              required
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="description">描述</label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="输入规则描述（可选）"
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="action">操作类型</label>
            <select
              id="action"
              name="action"
              value={formData.action}
              onChange={handleChange}
            >
              <option value={RegexRuleAction.RECORD}>记录匹配项</option>
              <option value={RegexRuleAction.REPLACE}>替换匹配内容</option>
            </select>
          </div>
          
          {formData.action === RegexRuleAction.REPLACE && (
            <div className="form-group">
              <label htmlFor="replacement">替换文本</label>
              <input
                type="text"
                id="replacement"
                name="replacement"
                value={formData.replacement}
                onChange={handleChange}
                placeholder="输入替换文本"
                required
              />
            </div>
          )}
          
          <div className="form-group">
            <label htmlFor="scope">应用范围</label>
            <select
              id="scope"
              name="scope"
              value={formData.scope}
              onChange={handleChange}
            >
              <option value={RegexScope.ALL}>全部</option>
              <option value={RegexScope.REQUEST_URL}>请求URL</option>
              <option value={RegexScope.REQUEST_HEADERS}>请求头</option>
              <option value={RegexScope.REQUEST_BODY}>请求体</option>
              <option value={RegexScope.RESPONSE_HEADERS}>响应头</option>
              <option value={RegexScope.RESPONSE_BODY}>响应体</option>
            </select>
          </div>
          
          <div className="form-group">
            <label>
              <input
                type="checkbox"
                name="enabled"
                checked={formData.enabled}
                onChange={handleCheckboxChange}
              />
              启用规则
            </label>
          </div>
          
          <div className="regex-tester">
            <h4>正则测试</h4>
            <textarea
              className="test-input"
              value={testString}
              onChange={e => setTestString(e.target.value)}
              placeholder="输入测试文本"
            />
            
            {renderTestResult()}
          </div>
          
          <div className="form-actions">
            <button className="cancel" onClick={onCancel}>取消</button>
            <button className="save" onClick={handleSave}>
              <FiCheck size={14} /> 保存
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegexEditor;
