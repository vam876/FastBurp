import React, { useState, useEffect } from 'react';
import { 
  RegexRule, 
  RegexRuleAction, 
  RegexScope, 
  RegexMatch, 
  RegexSettings,
  regexService 
} from '../services/regex-service';
import RegexEditor from './RegexEditor';
import MatchDetailsModal from './MatchDetailsModal';
import { 
  FiPlus, 
  FiEdit2, 
  FiTrash2, 
  FiDownload, 
  FiUpload, 
  FiSettings,
  FiRefreshCw,
  FiCheckCircle,
  FiAlertCircle,
  FiFilter,
  FiList,
  FiClock,
  FiEye
} from 'react-icons/fi';
import '../styles/RegexManager.css';

interface RegexManagerProps {
  darkMode?: boolean;
}

const RegexManager: React.FC<RegexManagerProps> = ({ darkMode = false }) => {
  const [rules, setRules] = useState<RegexRule[]>([]);
  const [matches, setMatches] = useState<RegexMatch[]>([]);
  const [selectedRule, setSelectedRule] = useState<RegexRule | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState<'rules' | 'matches' | 'settings'>('rules');
  const [settings, setSettings] = useState<RegexSettings>({
    enableRegexFilter: true,
    highlightMatches: true,
    logMatches: true,
    maxMatchesToStore: 1000
  });
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMatch, setSelectedMatch] = useState<RegexMatch | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  
  // 加载规则和匹配记录
  useEffect(() => {
    loadData();
  }, []);
  
  const loadData = async () => {
    setIsLoading(true);
    try {
      // 加载规则
      const loadedRules = await regexService.loadRules();
      setRules(loadedRules);
      
      // 加载匹配记录
      const loadedMatches = await regexService.loadMatches();
      setMatches(loadedMatches);
      
      // 加载设置
      const loadedSettings = await regexService.loadSettings();
      setSettings(loadedSettings);
    } catch (error) {
      console.error('加载数据失败:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  // 添加新规则
  const handleAddRule = () => {
    const newRule: RegexRule = {
      id: '',
      name: '新规则',
      pattern: '',
      description: '',
      enabled: true,
      action: RegexRuleAction.RECORD,
      replacement: '',
      scope: RegexScope.ALL,
      createdAt: 0,
      updatedAt: 0
    };
    
    setSelectedRule(newRule);
    setIsEditing(true);
  };
  
  // 编辑规则
  const handleEditRule = (rule: RegexRule) => {
    setSelectedRule(rule);
    setIsEditing(true);
  };
  
  // 删除规则
  const handleDeleteRule = async (ruleId: string) => {
    if (window.confirm('确定要删除这条规则吗？')) {
      try {
        await regexService.deleteRule(ruleId);
        // 重新加载规则
        const updatedRules = await regexService.loadRules();
        setRules(updatedRules);
      } catch (error) {
        console.error('删除规则失败:', error);
        alert('删除规则失败');
      }
    }
  };
  
  // 保存规则
  const handleSaveRule = async (rule: RegexRule) => {
    try {
      await regexService.saveRule(rule);
      setIsEditing(false);
      
      // 重新加载规则
      const updatedRules = await regexService.loadRules();
      setRules(updatedRules);
    } catch (error) {
      console.error('保存规则失败:', error);
      alert('保存规则失败');
    }
  };
  
  // 导入规则
  const handleImportRules = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      
      try {
        const reader = new FileReader();
        reader.onload = async (e) => {
          const content = e.target?.result as string;
          const success = await regexService.importRules(content);
          
          if (success) {
            alert('规则导入成功');
            // 重新加载规则
            const updatedRules = await regexService.loadRules();
            setRules(updatedRules);
          } else {
            alert('规则导入失败，请检查文件格式');
          }
        };
        reader.readAsText(file);
      } catch (error) {
        console.error('导入规则失败:', error);
        alert('导入规则失败');
      }
    };
    input.click();
  };
  
  // 导出规则
  const handleExportRules = async () => {
    try {
      const rulesJson = await regexService.exportRules();
      const blob = new Blob([rulesJson], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `regex_rules_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('导出规则失败:', error);
      alert('导出规则失败');
    }
  };
  
  // 清除匹配记录
  const handleClearMatches = async () => {
    if (window.confirm('确定要清除所有匹配记录吗？')) {
      try {
        await regexService.clearMatches();
        setMatches([]);
      } catch (error) {
        console.error('清除匹配记录失败:', error);
        alert('清除匹配记录失败');
      }
    }
  };

  // 显示匹配详情
  const showMatchDetails = (match: RegexMatch) => {
    setSelectedMatch(match);
    setIsDetailsModalOpen(true);
  };

  // 关闭详情弹窗
  const closeDetailsModal = () => {
    setIsDetailsModalOpen(false);
    setSelectedMatch(null);
  };
  
  // 保存设置
  const handleSaveSettings = async () => {
    try {
      await regexService.saveSettings(settings);
      alert('设置已保存');
    } catch (error) {
      console.error('保存设置失败:', error);
      alert('保存设置失败');
    }
  };
  
  // 切换规则启用状态
  const toggleRuleEnabled = async (rule: RegexRule) => {
    const updatedRule = { ...rule, enabled: !rule.enabled };
    try {
      await regexService.saveRule(updatedRule);
      // 更新本地规则列表
      setRules(rules.map(r => r.id === rule.id ? updatedRule : r));
    } catch (error) {
      console.error('更新规则状态失败:', error);
    }
  };
  
  // 渲染规则列表
  const renderRulesList = () => {
    if (isLoading) {
      return <div className="loading">加载中...</div>;
    }
    
    if (rules.length === 0) {
      return (
        <div className="no-rules">
          暂无规则，点击"添加规则"创建
        </div>
      );
    }
    
    return (
      <table>
        <thead>
          <tr>
            <th>启用</th>
            <th>名称</th>
            <th>正则表达式</th>
            <th>操作类型</th>
            <th>应用范围</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {rules.map(rule => (
            <tr key={rule.id} className={rule.enabled ? '' : 'disabled'}>
              <td>
                <input
                  type="checkbox"
                  checked={rule.enabled}
                  onChange={() => toggleRuleEnabled(rule)}
                />
              </td>
              <td>{rule.name}</td>
              <td className="regex-pattern" title={rule.pattern}>{rule.pattern}</td>
              <td>{rule.action === RegexRuleAction.RECORD ? '记录' : '替换'}</td>
              <td>{getScopeName(rule.scope)}</td>
              <td className="regex-actions">
                <button onClick={() => handleEditRule(rule)} title="编辑">
                  <FiEdit2 size={14} />
                </button>
                <button onClick={() => handleDeleteRule(rule.id)} title="删除">
                  <FiTrash2 size={14} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  };
  
  // 渲染匹配记录
  const renderMatchesList = () => {
    if (isLoading) {
      return <div className="loading">加载中...</div>;
    }
    
    if (matches.length === 0) {
      return (
        <div className="no-matches">
          暂无匹配记录
        </div>
      );
    }
    
    // 按时间降序排序
    const sortedMatches = [...matches].sort((a, b) => b.timestamp - a.timestamp);
    
    return (
      <>
        <div className="matches-actions">
          <span>共 {matches.length} 条记录</span>
          <button onClick={handleClearMatches} title="清除所有记录">
            <FiTrash2 size={14} /> 清除记录
          </button>
        </div>
        <table>
          <thead>
            <tr>
              <th>时间</th>
              <th>规则</th>
              <th>匹配内容</th>
              <th>URL</th>
              <th>范围</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {sortedMatches.map(match => (
              <tr key={match.id}>
                <td>{new Date(match.timestamp).toLocaleString()}</td>
                <td>{match.ruleName}</td>
                <td className="match-content" title={match.matchedContent}>
                  {match.matchedContent}
                </td>
                <td title={match.url}>
                  {truncateUrl(match.url)}
                </td>
                <td>{getScopeName(match.scope)}</td>
                <td>
                  <button 
                    onClick={() => showMatchDetails(match)} 
                    title="查看详情"
                    className="detail-button"
                  >
                    <FiEye size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </>
    );
  };
  
  // 渲染设置面板
  const renderSettings = () => {
    return (
      <div className="regex-settings-panel">
        <div className="form-group">
          <label>
            <input
              type="checkbox"
              checked={settings.enableRegexFilter}
              onChange={e => setSettings({...settings, enableRegexFilter: e.target.checked})}
            />
            启用正则过滤
          </label>
        </div>
        
        <div className="form-group">
          <label>
            <input
              type="checkbox"
              checked={settings.highlightMatches}
              onChange={e => setSettings({...settings, highlightMatches: e.target.checked})}
            />
            高亮显示匹配项
          </label>
        </div>
        
        <div className="form-group">
          <label>
            <input
              type="checkbox"
              checked={settings.logMatches}
              onChange={e => setSettings({...settings, logMatches: e.target.checked})}
            />
            记录匹配结果
          </label>
        </div>
        
        <div className="form-group">
          <label htmlFor="maxMatchesToStore">最大存储匹配数量</label>
          <input
            type="number"
            id="maxMatchesToStore"
            value={settings.maxMatchesToStore}
            onChange={e => setSettings({...settings, maxMatchesToStore: parseInt(e.target.value) || 1000})}
            min="100"
            max="10000"
          />
        </div>
        
        <div className="form-actions">
          <button className="save" onClick={handleSaveSettings}>
            <FiCheckCircle size={14} /> 保存设置
          </button>
        </div>
      </div>
    );
  };
  
  // 获取范围名称
  const getScopeName = (scope: RegexScope): string => {
    const scopeMap: Record<RegexScope, string> = {
      [RegexScope.ALL]: '全部',
      [RegexScope.REQUEST_URL]: '请求URL',
      [RegexScope.REQUEST_HEADERS]: '请求头',
      [RegexScope.REQUEST_BODY]: '请求体',
      [RegexScope.RESPONSE_HEADERS]: '响应头',
      [RegexScope.RESPONSE_BODY]: '响应体'
    };
    return scopeMap[scope] || scope;
  };
  
  // 截断URL
  const truncateUrl = (url: string, maxLength = 50): string => {
    if (url.length <= maxLength) return url;
    return url.substring(0, maxLength) + '...';
  };
  
  return (
    <div className={`regex-manager ${darkMode ? 'dark' : ''}`}>
      <div className="regex-manager-header">
        <h2>正则规则管理</h2>
        <div className="regex-manager-actions">
          {activeTab === 'rules' && (
            <>
              <button onClick={handleAddRule} title="添加规则">
                <FiPlus size={14} /> 添加规则
              </button>
              <button onClick={handleImportRules} title="导入规则">
                <FiUpload size={14} /> 导入
              </button>
              <button onClick={handleExportRules} title="导出规则">
                <FiDownload size={14} /> 导出
              </button>
            </>
          )}
          {activeTab === 'matches' && (
            <button onClick={loadData} title="刷新匹配记录">
              <FiRefreshCw size={14} /> 刷新
            </button>
          )}
        </div>
      </div>
      
      <div className="regex-tabs">
        <div 
          className={`regex-tab ${activeTab === 'rules' ? 'active' : ''}`}
          onClick={() => setActiveTab('rules')}
        >
          <FiList size={16} />
          <span>规则列表</span>
        </div>
        <div 
          className={`regex-tab ${activeTab === 'matches' ? 'active' : ''}`}
          onClick={() => setActiveTab('matches')}
        >
          <FiClock size={16} />
          <span>匹配记录</span>
        </div>
        <div 
          className={`regex-tab ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveTab('settings')}
        >
          <FiSettings size={16} />
          <span>设置</span>
        </div>
      </div>
      
      <div className="regex-content">
        {activeTab === 'rules' && (
          <div className="regex-rules-list">
            {renderRulesList()}
          </div>
        )}
        
        {activeTab === 'matches' && (
          <div className="regex-matches">
            {renderMatchesList()}
          </div>
        )}
        
        {activeTab === 'settings' && renderSettings()}
      </div>
      
      {isEditing && selectedRule && (
        <RegexEditor
          rule={selectedRule}
          onSave={handleSaveRule}
          onCancel={() => setIsEditing(false)}
          darkMode={darkMode}
        />
      )}

      {/* 匹配详情弹窗 */}
      <MatchDetailsModal
        match={selectedMatch}
        isOpen={isDetailsModalOpen}
        onClose={closeDetailsModal}
      />
    </div>
  );
};

export default RegexManager;
