import React, { useState, useEffect } from 'react';
import { 
  ProxySettings as ProxySettingsType, 
  ProxyProtocol,
  proxyService 
} from '../services/proxy-service';
import { 
  FiCheckCircle, 
  FiAlertCircle, 
  FiPlus, 
  FiTrash2, 
  FiActivity,
  FiServer,
  FiGlobe,
  FiLock,
  FiUser,
  FiKey,
  FiSlash,
  FiX
} from 'react-icons/fi';
import '../styles/ProxySettings.css';

interface ProxySettingsProps {
  darkMode?: boolean;
}

const ProxySettings: React.FC<ProxySettingsProps> = ({ darkMode = false }) => {
  const [settings, setSettings] = useState<ProxySettingsType>({
    enabled: false,
    host: '127.0.0.1',
    port: 8080,
    protocol: ProxyProtocol.HTTP,
    bypassList: ['localhost', '127.0.0.1'],
    requireAuth: false
  });
  
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    responseTime?: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // 加载设置
  useEffect(() => {
    loadSettings();
  }, []);
  
  const loadSettings = async () => {
    setIsLoading(true);
    try {
      const loadedSettings = await proxyService.loadSettings();
      setSettings(loadedSettings);
    } catch (error) {
      console.error('加载代理设置失败:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  // 更新设置字段
  const updateSetting = <K extends keyof ProxySettingsType>(
    field: K, 
    value: ProxySettingsType[K]
  ) => {
    setSettings(prev => ({ ...prev, [field]: value }));
    
    // 清除测试结果
    setTestResult(null);
  };
  
  // 添加绕过规则
  const addBypassRule = () => {
    setSettings(prev => ({
      ...prev,
      bypassList: [...prev.bypassList, '']
    }));
  };
  
  // 更新绕过规则
  const updateBypassRule = (index: number, value: string) => {
    const newBypassList = [...settings.bypassList];
    newBypassList[index] = value;
    setSettings(prev => ({
      ...prev,
      bypassList: newBypassList
    }));
    
    // 清除测试结果
    setTestResult(null);
  };
  
  // 删除绕过规则
  const removeBypassRule = (index: number) => {
    const newBypassList = [...settings.bypassList];
    newBypassList.splice(index, 1);
    setSettings(prev => ({
      ...prev,
      bypassList: newBypassList
    }));
    
    // 清除测试结果
    setTestResult(null);
  };
  
  // 保存设置
  const handleSave = async () => {
    // 验证设置
    if (settings.enabled) {
      if (!settings.host) {
        alert('请输入代理主机地址');
        return;
      }
      
      if (!settings.port || settings.port <= 0 || settings.port > 65535) {
        alert('请输入有效的代理端口（1-65535）');
        return;
      }
      
      if (settings.requireAuth && !settings.username) {
        alert('启用认证时必须提供用户名');
        return;
      }
    }
    
    // 过滤空的绕过规则
    const filteredBypassList = settings.bypassList.filter(rule => rule.trim() !== '');
    
    setIsSaving(true);
    try {
      await proxyService.saveSettings({
        ...settings,
        bypassList: filteredBypassList
      });
      alert('代理设置已保存');
    } catch (error) {
      console.error('保存代理设置失败:', error);
      alert('保存代理设置失败');
    } finally {
      setIsSaving(false);
    }
  };

  // 清除代理设置
  const handleClearProxy = async () => {
    if (window.confirm('确定要清除代理设置吗？这将禁用代理并清除所有配置。')) {
      setIsSaving(true);
      try {
        // 禁用代理
        const clearedSettings = {
          ...settings,
          enabled: false,
          host: '127.0.0.1',
          port: 8080,
          protocol: ProxyProtocol.HTTP,
          bypassList: ['localhost', '127.0.0.1'],
          requireAuth: false,
          username: '',
          password: ''
        };
        
        await proxyService.saveSettings(clearedSettings);
        setSettings(clearedSettings);
        setTestResult(null);
        alert('代理设置已清除');
      } catch (error) {
        console.error('清除代理设置失败:', error);
        alert('清除代理设置失败');
      } finally {
        setIsSaving(false);
      }
    }
  };
  
  // 测试代理连接
  const testConnection = async () => {
    if (!settings.enabled) {
      setTestResult({
        success: false,
        message: '请先启用代理'
      });
      return;
    }
    
    if (!settings.host || !settings.port) {
      setTestResult({
        success: false,
        message: '请输入代理主机和端口'
      });
      return;
    }
    
    setIsTesting(true);
    setTestResult(null);
    
    try {
      const result = await proxyService.testProxyConnection(settings);
      setTestResult(result);
    } catch (error) {
      setTestResult({
        success: false,
        message: error instanceof Error ? error.message : '测试连接失败'
      });
    } finally {
      setIsTesting(false);
    }
  };
  
  if (isLoading) {
    return <div className="loading">加载中...</div>;
  }
  
  return (
    <div className={`proxy-settings ${darkMode ? 'dark' : ''}`}>
      <h2>下游代理设置</h2>
      
      <div className="proxy-settings-form">
        <div className="form-group checkbox-group">
          <label>
            <input
              type="checkbox"
              checked={settings.enabled}
              onChange={e => updateSetting('enabled', e.target.checked)}
            />
            <FiServer size={16} />
            <span>启用下游代理</span>
          </label>
        </div>
        
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="protocol">
              <FiGlobe size={16} />
              <span>代理类型</span>
            </label>
            <select
              id="protocol"
              value={settings.protocol}
              onChange={e => updateSetting('protocol', e.target.value as ProxyProtocol)}
              disabled={!settings.enabled}
            >
              <option value={ProxyProtocol.HTTP}>HTTP</option>
              <option value={ProxyProtocol.HTTPS}>HTTPS</option>
              <option value={ProxyProtocol.SOCKS4}>SOCKS4</option>
              <option value={ProxyProtocol.SOCKS5}>SOCKS5</option>
            </select>
          </div>
          
          <div className="form-group">
            <label htmlFor="host">
              <FiServer size={16} />
              <span>主机地址</span>
            </label>
            <input
              type="text"
              id="host"
              value={settings.host}
              onChange={e => updateSetting('host', e.target.value)}
              placeholder="例如：127.0.0.1"
              disabled={!settings.enabled}
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="port">
              <FiActivity size={16} />
              <span>端口</span>
            </label>
            <input
              type="number"
              id="port"
              value={settings.port}
              onChange={e => updateSetting('port', parseInt(e.target.value) || 0)}
              min="1"
              max="65535"
              disabled={!settings.enabled}
            />
          </div>
        </div>
        
        <div className="form-group checkbox-group">
          <label>
            <input
              type="checkbox"
              checked={settings.requireAuth}
              onChange={e => updateSetting('requireAuth', e.target.checked)}
              disabled={!settings.enabled}
            />
            <FiLock size={16} />
            <span>需要认证</span>
          </label>
        </div>
        
        {settings.requireAuth && (
          <div className="proxy-auth">
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="username">
                  <FiUser size={16} />
                  <span>用户名</span>
                </label>
                <input
                  type="text"
                  id="username"
                  value={settings.username || ''}
                  onChange={e => updateSetting('username', e.target.value)}
                  disabled={!settings.enabled}
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="password">
                  <FiKey size={16} />
                  <span>密码</span>
                </label>
                <input
                  type="password"
                  id="password"
                  value={settings.password || ''}
                  onChange={e => updateSetting('password', e.target.value)}
                  disabled={!settings.enabled}
                />
              </div>
            </div>
          </div>
        )}
        
        <div className="bypass-list">
          <h3>
            <FiSlash size={18} />
            <span>代理绕过规则</span>
          </h3>
          <p>不通过代理的域名列表（支持精确匹配和通配符，如 *.example.com）</p>
          
          {settings.bypassList.map((rule, index) => (
            <div key={index} className="bypass-item">
              <input
                type="text"
                value={rule}
                onChange={e => updateBypassRule(index, e.target.value)}
                placeholder="例如：localhost 或 *.example.com"
                disabled={!settings.enabled}
              />
              <button
                onClick={() => removeBypassRule(index)}
                disabled={!settings.enabled}
                title="删除规则"
                className="icon-button"
              >
                <FiTrash2 size={16} />
              </button>
            </div>
          ))}
          
          <div className="bypass-actions">
            <button
              onClick={addBypassRule}
              disabled={!settings.enabled}
              title="添加规则"
              className="action-button"
            >
              <FiPlus size={14} /> 添加规则
            </button>
          </div>
        </div>
        
        {testResult && (
          <div className={`test-result ${testResult.success ? 'success' : 'error'}`}>
            <div className="test-result-header">
              {testResult.success ? (
                <FiCheckCircle size={18} />
              ) : (
                <FiAlertCircle size={18} />
              )}
              <span>{testResult.message}</span>
            </div>
            {testResult.success && testResult.responseTime && (
              <div className="test-result-details">
                响应时间: {testResult.responseTime} ms
              </div>
            )}
          </div>
        )}
        
        <div className="form-actions">
          <button
            className="test-button"
            onClick={testConnection}
            disabled={isTesting || !settings.enabled}
          >
            {isTesting ? '测试中...' : (
              <>
                <FiActivity size={16} /> 测试连接
              </>
            )}
          </button>
          
          <button
            className="save-button"
            onClick={handleSave}
            disabled={isSaving}
            title="保存代理设置"
          >
            {isSaving ? '保存中...' : (
              <>
                <FiCheckCircle size={16} /> 保存设置
              </>
            )}
          </button>

          {settings.enabled && (
            <button
              className="clear-proxy-button"
              onClick={handleClearProxy}
              disabled={isSaving}
              title="清除代理设置"
            >
              <FiX size={16} /> 清除代理
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProxySettings;
