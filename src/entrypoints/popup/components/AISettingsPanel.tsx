import React, { useState, useEffect, useRef } from 'react';
import { FiSave, FiAlertCircle, FiList, FiDownload, FiUpload } from 'react-icons/fi';
import { aiService, AISettings } from '../services/ai-service';
import '../styles/AISettingsPanel.css';

interface AISettingsPanelProps {
  darkMode?: boolean;
  onSaved?: () => void;
}

// 提示词模板类型定义
interface PromptTemplate {
  name: string;
  prompt: string;
}

const AISettingsPanel: React.FC<AISettingsPanelProps> = ({ 
  darkMode = true,
  onSaved
}) => {
  const [settings, setSettings] = useState<AISettings>({
    apiEndpoint: '',
    apiKey: '',
    apiModel: '',
    systemPrompt: '',
    requiresApiKey: true,
    maxResponseSize: 50000
  });
  
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{text: string, isError: boolean} | null>(null);
  const [showPromptTemplates, setShowPromptTemplates] = useState(false);
  const [includeHistory, setIncludeHistory] = useState(false);
  const [promptTemplates, setPromptTemplates] = useState<PromptTemplate[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // 加载设置和提示词模板
  useEffect(() => {
    const loadData = async () => {
      try {
        // 加载设置
        const savedSettings = await aiService.loadSettings();
        setSettings(savedSettings);
        
        // 加载提示词模板
        const templates = await aiService.loadPromptTemplates();
        console.log('加载的提示词模板:', templates);
        setPromptTemplates(templates);
      } catch (err) {
        console.error('加载设置或提示词模板失败:', err);
      }
    };
    
    loadData();
  }, []);
  
  // 处理输入变化
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setSettings(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // 处理数字输入变化
  const handleNumberInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const numValue = parseInt(value, 10);
    if (!isNaN(numValue) && numValue > 0) {
      setSettings(prev => ({
        ...prev,
        [name]: numValue
      }));
    }
  };

  // 处理复选框变化
  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setSettings(prev => ({
      ...prev,
      [name]: checked
    }));
  };
  
  // 应用提示词模板
  const applyPromptTemplate = (template: PromptTemplate) => {
    setSettings(prev => ({
      ...prev,
      systemPrompt: template.prompt
    }));
    setShowPromptTemplates(false);
  };
  
  // 保存设置
  const handleSaveSettings = async () => {
    setIsSaving(true);
    setSaveMessage(null);
    
    try {
      await aiService.saveSettings(settings);
      setSaveMessage({ text: '设置已保存', isError: false });
      if (onSaved) onSaved();
    } catch (err) {
      setSaveMessage({ 
        text: `保存失败: ${err instanceof Error ? err.message : String(err)}`, 
        isError: true 
      });
    } finally {
      setIsSaving(false);
      
      // 3秒后清除消息
      setTimeout(() => {
        setSaveMessage(null);
      }, 3000);
    }
  };

  // 导出配置
  const handleExportConfig = async () => {
    try {
      const configData = await aiService.exportConfig(includeHistory);
      const jsonString = JSON.stringify(configData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      // 创建下载链接并点击
      const a = document.createElement('a');
      a.href = url;
      a.download = `fastburp-config-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      setSaveMessage({ text: '配置已导出', isError: false });
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (err) {
      setSaveMessage({ 
        text: `导出失败: ${err instanceof Error ? err.message : String(err)}`, 
        isError: true 
      });
      setTimeout(() => setSaveMessage(null), 3000);
    }
  };

  // 触发文件选择
  const triggerFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // 导入配置
  const handleImportConfig = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setSaveMessage({ text: '正在导入配置...', isError: false });
      const reader = new FileReader();
      reader.onload = async (event) => {
        if (event.target?.result) {
          try {
            await aiService.importConfig(event.target.result as string);
            
            // 重新加载设置以更新UI
            const savedSettings = await aiService.loadSettings();
            setSettings(savedSettings);
            
            // 重新加载提示词模板并更新UI
            const templates = await aiService.loadPromptTemplates();
            console.log('重新加载的提示词模板:', templates);
            setPromptTemplates(templates);
            
            // 强制重新渲染组件以显示新的提示词模板
            setShowPromptTemplates(false);
            
            setSaveMessage({ text: '配置已导入', isError: false });
          } catch (err) {
            console.error('导入配置失败:', err);
            setSaveMessage({ 
              text: `导入失败: ${err instanceof Error ? err.message : String(err)}`, 
              isError: true 
            });
          }
          setTimeout(() => setSaveMessage(null), 3000);
        }
      };
      reader.readAsText(file);
    } catch (err) {
      console.error('读取文件失败:', err);
      setSaveMessage({ 
        text: `读取文件失败: ${err instanceof Error ? err.message : String(err)}`, 
        isError: true 
      });
      setTimeout(() => setSaveMessage(null), 3000);
    }
    
    // 清除文件输入，以便于下次选择同一文件也能触发事件
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
  
  // 渲染提示词模板下拉菜单
  const renderPromptTemplates = () => {
    if (!showPromptTemplates) return null;
    
    return (
      <div className="prompt-templates-dropdown">
        {promptTemplates.length > 0 ? (
          promptTemplates.map((template, index) => (
            <button
              key={index}
              className="prompt-template-item"
              onClick={() => applyPromptTemplate(template)}
            >
              {template.name}
            </button>
          ))
        ) : (
          <div className="prompt-template-empty">没有可用的提示词模板</div>
        )}
      </div>
    );
  };
  
  return (
    <div className={`ai-settings-panel ${darkMode ? 'dark' : 'light'}`}>
      <h2>AI 分析设置</h2>
      
      <div className="ai-settings-form">
        <div className="ai-form-group">
          <label htmlFor="apiEndpoint">API端点</label>
          <input
            type="text"
            id="apiEndpoint"
            name="apiEndpoint"
            value={settings.apiEndpoint}
            onChange={handleInputChange}
            placeholder="https://api.openai.com/v1/chat/completions"
            className={darkMode ? 'dark' : 'light'}
          />
          <p className="ai-help-text">兼容OpenAI API的端点URL</p>
        </div>
        
        <div className="ai-form-group">
          <div className="api-key-header">
            <label htmlFor="apiKey">API密钥</label>
            <div className="api-key-checkbox">
              <input
                type="checkbox"
                id="requiresApiKey"
                name="requiresApiKey"
                checked={settings.requiresApiKey}
                onChange={handleCheckboxChange}
              />
              <label htmlFor="requiresApiKey" className="checkbox-label">需要API密钥</label>
            </div>
          </div>
          <input
            type="password"
            id="apiKey"
            name="apiKey"
            value={settings.apiKey}
            onChange={handleInputChange}
            placeholder={settings.requiresApiKey ? "sk-..." : "本地模型无需API密钥"}
            className={darkMode ? 'dark' : 'light'}
            disabled={!settings.requiresApiKey}
          />
          <p className="ai-help-text">
            {settings.requiresApiKey 
              ? "您的OpenAI API密钥或兼容API密钥" 
              : "使用本地模型如Ollama时无需API密钥"}
          </p>
        </div>
        
        <div className="ai-form-group">
          <label htmlFor="apiModel">模型名称</label>
          <input
            type="text"
            id="apiModel"
            name="apiModel"
            value={settings.apiModel}
            onChange={handleInputChange}
            placeholder="gpt-3.5-turbo"
            className={darkMode ? 'dark' : 'light'}
          />
          <p className="ai-help-text">要使用的模型名称，例如gpt-3.5-turbo或gpt-4</p>
        </div>

        <div className="ai-form-group">
          <label htmlFor="maxResponseSize">最大响应大小 (字符数)</label>
          <input
            type="number"
            id="maxResponseSize"
            name="maxResponseSize"
            value={settings.maxResponseSize}
            onChange={handleNumberInputChange}
            min="1000"
            step="1000"
            className={darkMode ? 'dark' : 'light'}
          />
          <p className="ai-help-text">AI分析支持的最大响应字符数，超过此限制将无法进行AI分析</p>
        </div>
        
        <div className="ai-form-group">
          <div className="system-prompt-header">
            <label htmlFor="systemPrompt">系统提示词</label>
            <button 
              type="button" 
              className="prompt-templates-button"
              onClick={() => setShowPromptTemplates(!showPromptTemplates)}
              title="选择提示词模板"
            >
              <FiList size={16} />
              <span>提示词模板</span>
            </button>
          </div>
          
          {renderPromptTemplates()}
          
          <textarea
            id="systemPrompt"
            name="systemPrompt"
            value={settings.systemPrompt}
            onChange={handleInputChange}
            rows={5}
            placeholder="你是一个网络安全专家，请分析以下HTTP请求和响应..."
            className={darkMode ? 'dark' : 'light'}
          />
          <p className="ai-help-text">设置AI的角色和分析指令，可使用提示词模板快速选择</p>
        </div>
        
        {/* 导入导出配置区域 */}
        <div className="ai-form-group import-export-section">
          <h3>配置导入导出</h3>
          
          <div className="import-export-controls">
            <div className="export-controls">
              <div className="export-checkbox">
                <input
                  type="checkbox"
                  id="includeHistory"
                  checked={includeHistory}
                  onChange={(e) => setIncludeHistory(e.target.checked)}
                />
                <label htmlFor="includeHistory" className="checkbox-label">包含聊天历史</label>
              </div>
              
              <button 
                onClick={handleExportConfig}
                className={`ai-export-button ${darkMode ? 'dark' : 'light'}`}
                title="导出配置"
              >
                <FiDownload size={20} />
                <span>导出配置</span>
              </button>
            </div>
            
            <div className="import-controls">
              <div className="import-placeholder">
                {/* 占位元素，保持与导出按钮上方的复选框对齐 */}
              </div>
              
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                style={{ display: 'none' }}
                onChange={handleImportConfig}
              />
              
              <button 
                onClick={triggerFileInput}
                className={`ai-import-button ${darkMode ? 'dark' : 'light'}`}
                title="导入配置"
              >
                <FiUpload size={20} />
                <span>导入配置</span>
              </button>
            </div>
          </div>
          
          <p className="ai-help-text">导出或导入所有AI配置，包括API设置、提示词模板等</p>
        </div>
        
        <div className="ai-form-actions">
          {saveMessage && (
            <div className={`ai-save-message ${saveMessage.isError ? 'error' : 'success'}`}>
              {saveMessage.isError ? <FiAlertCircle /> : null}
              <span>{saveMessage.text}</span>
            </div>
          )}
          
          <button 
            onClick={handleSaveSettings} 
            disabled={isSaving}
            className={`ai-save-button ${darkMode ? 'dark' : 'light'}`}
          >
            <FiSave size={20} />
            <span>{isSaving ? '保存中...' : '保存设置'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default AISettingsPanel; 