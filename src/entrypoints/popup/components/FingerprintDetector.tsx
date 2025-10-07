import React, { useState, useEffect } from 'react';
import browser from 'webextension-polyfill';
import { fingerprintService, FingerprintResult, FingerprintType, FingerprintRule, MatchTarget } from '../services/fingerprint-service';
import { FiToggleRight, FiToggleLeft, FiPlus, FiDownload, FiUpload, FiSave, FiX, FiEdit3, FiTrash2, FiEye, FiShield, FiServer, FiDatabase, FiGlobe, FiCode, FiSettings, FiActivity, FiChevronDown, FiChevronRight, FiRefreshCw, FiSearch, FiFilter } from 'react-icons/fi';
import '../styles/FingerprintDetector.css';

interface FingerprintDetectorProps {
  darkMode: boolean;
}

export const FingerprintDetector: React.FC<FingerprintDetectorProps> = ({ darkMode }) => {
  const [activeTab, setActiveTab] = useState<'current' | 'results' | 'rules'>('current');
  const [fingerprintEnabled, setFingerprintEnabled] = useState(true);
  const [scanHistory, setScanHistory] = useState<FingerprintResult[]>([]);
  const [currentResult, setCurrentResult] = useState<FingerprintResult | null>(null);
  const [rules, setRules] = useState<FingerprintRule[]>([]);
  const [showAddRule, setShowAddRule] = useState(false);
  const [editingRule, setEditingRule] = useState<FingerprintRule | null>(null);
  const [expandedResults, setExpandedResults] = useState<Set<number>>(new Set());
  const [isImporting, setIsImporting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [ruleSearchTerm, setRuleSearchTerm] = useState('');
  const [ruleTypeFilter, setRuleTypeFilter] = useState<FingerprintType | 'all'>('all');
  const [newRule, setNewRule] = useState<Partial<FingerprintRule>>({
    name: '',
    pattern: '',
    type: FingerprintType.FRAMEWORK,
    matchTarget: MatchTarget.RESPONSE_HEADER,
    targetField: '',
    description: '',
    riskLevel: 'low',
    enabled: true
  });

  // 加载扫描历史
  const loadScanHistory = async () => {
    try {
      const history = await fingerprintService.loadFingerprintHistory();
      setScanHistory(history);
    } catch (error) {
      console.error('加载扫描历史失败:', error);
    }
  };

  // 加载指纹规则
  const loadRules = async () => {
    try {
      const loadedRules = await fingerprintService.loadRules();
      setRules(loadedRules);
    } catch (error) {
      console.error('加载规则失败:', error);
    }
  };

  // 加载指纹识别开关状态
  const loadFingerprintEnabled = async () => {
    try {
      const result = await browser.storage.local.get(['fingerprintEnabled']);
      setFingerprintEnabled(result.fingerprintEnabled !== false); // 默认为true
    } catch (error) {
      console.error('加载指纹识别开关状态失败:', error);
    }
  };

  // 保存指纹识别开关状态
  const saveFingerprintEnabled = async (enabled: boolean) => {
    try {
      await browser.storage.local.set({ fingerprintEnabled: enabled });
    } catch (error) {
      console.error('保存指纹识别开关状态失败:', error);
    }
  };

  // 切换指纹识别开关
  const toggleFingerprintEnabled = async () => {
    const newState = !fingerprintEnabled;
    setFingerprintEnabled(newState);
    await saveFingerprintEnabled(newState);
  };

  // 初始化
  useEffect(() => {
    loadScanHistory();
    loadRules();
    loadFingerprintEnabled();
  }, []);

  // 获取风险等级颜色
  const getRiskLevelColor = (riskLevel: string) => {
    const colors = {
      low: '#4CAF50',
      medium: '#FF9800',
      high: '#f44336',
      critical: '#9C27B0'
    };
    return colors[riskLevel as keyof typeof colors] || '#4CAF50';
  };

  // 获取类型图标
  const getTypeIcon = (type: FingerprintType) => {
    const icons = {
      [FingerprintType.FRAMEWORK]: <FiCode size={16} />,
      [FingerprintType.SERVER]: <FiServer size={16} />,
      [FingerprintType.CMS]: <FiGlobe size={16} />,
      [FingerprintType.CDN]: <FiGlobe size={16} />,
      [FingerprintType.SECURITY]: <FiShield size={16} />,
      [FingerprintType.SOCIAL]: <FiGlobe size={16} />,
      [FingerprintType.ADVERTISING]: <FiGlobe size={16} />,
      [FingerprintType.UTILITY]: <FiSettings size={16} />,
      [FingerprintType.TECHNOLOGY]: <FiCode size={16} />,
      [FingerprintType.COMPONENT]: <FiSettings size={16} />,
      [FingerprintType.OS]: <FiServer size={16} />
    };
    return icons[type] || <FiCode size={16} />;
  };

  // 折叠式指纹结果展示组件
  const FingerprintResultItem = ({ result, isExpanded, onToggle }: {
    result: FingerprintResult;
    isExpanded: boolean;
    onToggle: () => void;
  }) => {
    // 解析URL显示
    const parseUrlForDisplay = (url: string) => {
      try {
        const urlObj = new URL(url);
        const domain = urlObj.hostname;
        const path = urlObj.pathname;
        const hasParams = urlObj.search !== '' || urlObj.hash !== '';
        return { domain, path, hasParams };
      } catch {
        // 如果URL解析失败，使用简单匹配
        const match = url.match(/https?:\/\/([^\/\?]+)(\/[^?\#]*)?/);
        if (match) {
          const domain = match[1];
          const path = match[2] || '/';
          const hasParams = url.includes('?') || url.includes('#');
          return { domain, path, hasParams };
        }
        return { domain: url, path: '/', hasParams: false };
      }
    };

    const { domain, path, hasParams } = parseUrlForDisplay(result.url);
    
    return (
      <div className="collapsible-result-item">
        <div className="result-header-collapsible" onClick={onToggle}>
          <div className="result-url-info">
            <div className="result-domain-row">
              <div className="result-domain">{domain}</div>
              {/* 指纹标签放在URL后面 */}
              <div className="fingerprint-tags-inline">
                {result.fingerprints.map((fp, index) => (
                  <div key={index} className={`fingerprint-tag ${fp.riskLevel}`}>
                    <span className="tag-icon">{getTypeIcon(fp.type)}</span>
                    <span className="tag-name">{fp.name}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="result-path">{path}</div>
            <div className="result-time">
              {new Date(result.timestamp).toLocaleString('zh-CN')}
            </div>
          </div>
          <div className="result-stats">
            <div className="fingerprint-count">
              {result.fingerprints.length}个指纹
            </div>
            {hasParams && <div className="params-indicator">+参数</div>}
            <div className="expand-icon">
              {isExpanded ? <FiChevronDown size={16} /> : <FiChevronRight size={16} />}
            </div>
          </div>
        </div>
        
        {isExpanded && (
          <div className="result-fingerprints-expanded">
            {result.fingerprints.map((fp, fpIndex) => (
              <div key={fpIndex} className="fingerprint-detail-item">
                <div className="fingerprint-header">
                  <span className="fingerprint-icon">{getTypeIcon(fp.type)}</span>
                  <span className="fingerprint-name">{fp.name}</span>
                  <span className={`fingerprint-type ${fp.type}`}>{fp.type}</span>
                  {fp.version && <span className="fingerprint-version">v{fp.version}</span>}
                </div>
                <div className="fingerprint-info">
                  <span className="fingerprint-method">检测方法: {fp.detectionMethod}</span>
                  <span className="fingerprint-source">来源: {fp.source}</span>
                </div>
                {fp.matchedContent && (
                  <div className="fingerprint-matched">
                    匹配内容: <code>{fp.matchedContent}</code>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const handleAddRule = async () => {
    try {
      if (!newRule.name || !newRule.pattern) {
        alert('请填写规则名称和匹配模式');
        return;
      }

      const rule: FingerprintRule = {
        id: '',
        name: newRule.name,
        pattern: newRule.pattern,
        type: newRule.type || FingerprintType.FRAMEWORK,
        matchTarget: newRule.matchTarget || MatchTarget.RESPONSE_HEADER,
        targetField: newRule.targetField,
        versionPattern: newRule.versionPattern,
        description: newRule.description || '',
        riskLevel: newRule.riskLevel || 'low',
        references: newRule.references || [],
        enabled: newRule.enabled !== undefined ? newRule.enabled : true,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      await fingerprintService.saveRule(rule);
      await loadRules();
      setShowAddRule(false);
      setNewRule({
        name: '',
        pattern: '',
        type: FingerprintType.FRAMEWORK,
        matchTarget: MatchTarget.RESPONSE_HEADER,
        targetField: '',
        description: '',
        riskLevel: 'low',
        enabled: true
      });
    } catch (error) {
      console.error('添加规则失败:', error);
      alert('添加规则失败: ' + (error instanceof Error ? error.message : String(error)));
    }
  };

  const handleUpdateRule = async () => {
    if (!editingRule) return;
    
    try {
      const updatedRule = {
        ...editingRule,
        ...newRule,
        updatedAt: Date.now()
      };
      
      await fingerprintService.saveRule(updatedRule);
      await loadRules();
      setShowAddRule(false);
      setEditingRule(null);
      setNewRule({
        name: '',
        pattern: '',
        type: FingerprintType.FRAMEWORK,
        matchTarget: MatchTarget.RESPONSE_HEADER,
        targetField: '',
        description: '',
        riskLevel: 'low',
        enabled: true
      });
    } catch (error) {
      console.error('更新规则失败:', error);
      alert('更新规则失败: ' + (error instanceof Error ? error.message : String(error)));
    }
  };

  const handleEditRule = (rule: FingerprintRule) => {
    setEditingRule(rule);
    setNewRule({
      name: rule.name,
      pattern: rule.pattern,
      type: rule.type,
      matchTarget: rule.matchTarget,
      targetField: rule.targetField,
      versionPattern: rule.versionPattern,
      description: rule.description,
      riskLevel: rule.riskLevel,
      references: rule.references,
      enabled: rule.enabled
    });
    setShowAddRule(true);
  };

  const handleDeleteRule = async (ruleId: string) => {
    if (confirm('确定要删除这条规则吗？')) {
      try {
        await fingerprintService.deleteRule(ruleId);
        await loadRules();
      } catch (error) {
        console.error('删除规则失败:', error);
        alert('删除规则失败: ' + (error instanceof Error ? error.message : String(error)));
      }
    }
  };

  const toggleResultExpansion = (index: number) => {
    const newExpanded = new Set(expandedResults);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedResults(newExpanded);
  };

  const handleClearResults = async () => {
    if (confirm('确定要清空所有检测结果吗？此操作不可恢复。')) {
      try {
        await fingerprintService.clearAllResults();
        setScanHistory([]);
        setExpandedResults(new Set());
        alert('检测结果已清空！');
      } catch (error) {
        console.error('清空结果失败:', error);
        alert('清空失败: ' + (error instanceof Error ? error.message : String(error)));
      }
    }
  };

  const handleReinitializeRules = async () => {
    if (confirm('确定要重新初始化内置规则吗？这将更新所有内置规则到最新版本。')) {
      try {
        await fingerprintService.reinitializeBuiltinRules();
        await loadRules();
        alert('内置规则重新初始化完成！');
      } catch (error) {
        console.error('重新初始化规则失败:', error);
        alert('重新初始化失败: ' + (error instanceof Error ? error.message : String(error)));
      }
    }
  };

  // 过滤规则
  const filteredRules = rules.filter(rule => {
    // 搜索过滤
    const matchesSearch = ruleSearchTerm === '' || 
      rule.name.toLowerCase().includes(ruleSearchTerm.toLowerCase()) ||
      rule.pattern.toLowerCase().includes(ruleSearchTerm.toLowerCase()) ||
      rule.description.toLowerCase().includes(ruleSearchTerm.toLowerCase());
    
    // 类型过滤
    const matchesType = ruleTypeFilter === 'all' || rule.type === ruleTypeFilter;
    
    return matchesSearch && matchesType;
  });

  const handleToggleRule = async (rule: FingerprintRule) => {
    try {
      const updatedRule = { ...rule, enabled: !rule.enabled };
      await fingerprintService.saveRule(updatedRule);
      await loadRules();
    } catch (error) {
      console.error('更新规则失败:', error);
    }
  };

  const handleExportRules = async () => {
    try {
      setIsExporting(true);
      const rulesJson = await fingerprintService.exportRules();
      
      // 创建下载链接
      const blob = new Blob([rulesJson], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fingerprint-rules-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('导出规则失败:', error);
      alert('导出规则失败: ' + (error instanceof Error ? error.message : String(error)));
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportRules = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        setIsImporting(true);
        const text = await file.text();
        const success = await fingerprintService.importRules(text);
        
        if (success) {
          await loadRules();
          alert('规则导入成功！');
        } else {
          alert('规则导入失败，请检查文件格式');
        }
      } catch (error) {
        console.error('导入规则失败:', error);
        alert('导入规则失败: ' + (error instanceof Error ? error.message : String(error)));
      } finally {
        setIsImporting(false);
      }
    };
    input.click();
  };

  return (
    <div 
      className="fingerprint-detector"
      style={{
        '--bg-color': darkMode ? '#1a1a1a' : '#ffffff',
        '--text-color': darkMode ? '#ffffff' : '#333333',
        '--text-secondary': darkMode ? '#999999' : '#666666',
        '--border-color': darkMode ? '#333333' : '#e0e0e0',
        '--card-bg': darkMode ? '#2a2a2a' : '#ffffff',
        '--hover-bg': darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
        '--active-bg': darkMode ? 'rgba(33, 150, 243, 0.1)' : 'rgba(33, 150, 243, 0.1)',
        '--input-bg': darkMode ? '#333333' : '#ffffff'
      } as React.CSSProperties}
    >
      <div className="tab-selector">
        <button 
          className={`tab-button ${activeTab === 'current' ? 'active' : ''}`}
          onClick={() => setActiveTab('current')}
        >
          当前扫描
        </button>
        <button 
          className={`tab-button ${activeTab === 'results' ? 'active' : ''}`}
          onClick={() => setActiveTab('results')}
        >
          检测结果 ({scanHistory.length})
        </button>
        <button 
          className={`tab-button ${activeTab === 'rules' ? 'active' : ''}`}
          onClick={() => setActiveTab('rules')}
        >
          规则管理 ({rules.length})
        </button>
        <button
          className={`fingerprint-toggle-button ${fingerprintEnabled ? 'active' : ''}`}
          onClick={toggleFingerprintEnabled}
        >
          {fingerprintEnabled ? <FiToggleRight size={16} /> : <FiToggleLeft size={16} />}
          {fingerprintEnabled ? '开启' : '关闭'}
        </button>
      </div>

      {activeTab === 'current' && currentResult && (
        <div className="current-result">
          <div className="result-summary">
            <h3>扫描结果摘要</h3>
            <div className="summary-stats">
              <div className="stat-item">
                <span className="stat-label">总发现:</span>
                <span className="stat-value">{currentResult.summary.total}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">高风险:</span>
                <span className="stat-value high-risk">
                  {currentResult.summary.byRisk.high || 0}
                </span>
              </div>
              <div className="stat-item">
                <span className="stat-label">中风险:</span>
                <span className="stat-value medium-risk">
                  {currentResult.summary.byRisk.medium || 0}
                </span>
              </div>
            </div>
          </div>

          <div className="fingerprints-list">
            <h3>检测到的指纹</h3>
            {currentResult.fingerprints.length === 0 ? (
              <p className="no-fingerprints">未检测到指纹信息</p>
            ) : (
              currentResult.fingerprints.map((fp, index) => (
                <div key={index} className="fingerprint-item">
                  <div className="fp-header">
                    <span className="fp-icon">{getTypeIcon(fp.type)}</span>
                    <span className="fp-name">{fp.name}</span>
                    <span 
                      className="fp-risk"
                      style={{ backgroundColor: getRiskLevelColor(fp.riskLevel) }}
                    >
                      {fp.riskLevel.toUpperCase()}
                    </span>
                  </div>
                  <div className="fp-details">
                    <p className="fp-description">{fp.description}</p>
                    <p className="fp-source">来源: {fp.source}</p>
                    <p className="fp-content">匹配内容: {fp.matchedContent}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {activeTab === 'results' && (
        <div className="detection-results">
          <div className="results-header">
            <h3>检测结果</h3>
            <button 
              className="clear-results-button"
              onClick={handleClearResults}
              title="清空所有检测结果"
            >
              <FiTrash2 size={14} />
              清空结果
            </button>
          </div>
          {scanHistory.length === 0 ? (
            <div className="no-results">
              <p>暂无检测结果</p>
              <p className="no-results-tip">指纹识别功能开启后，将自动检测网络请求并记录结果</p>
            </div>
          ) : (
            <div className="results-list">
              {scanHistory.map((result, index) => (
                <FingerprintResultItem 
                  key={index} 
                  result={result} 
                  isExpanded={expandedResults.has(index)}
                  onToggle={() => toggleResultExpansion(index)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'rules' && (
        <div className="rules-management">
          <div className="rules-header">
            <h3>指纹规则管理</h3>
            <div className="rules-actions">
              <button 
                className="reinit-button"
                onClick={handleReinitializeRules}
                title="重新初始化内置规则"
              >
                <FiRefreshCw size={16} />
                重新初始化
              </button>
              <button 
                className="import-button"
                onClick={handleImportRules}
                disabled={isImporting}
              >
                <FiDownload size={16} />
                {isImporting ? '导入中...' : '导入规则'}
              </button>
              <button 
                className="export-button"
                onClick={handleExportRules}
                disabled={isExporting}
              >
                <FiUpload size={16} />
                {isExporting ? '导出中...' : '导出规则'}
              </button>
              <button 
                className="add-rule-button"
                onClick={() => setShowAddRule(true)}
              >
                <FiPlus size={16} />
                添加规则
              </button>
            </div>
          </div>

          {/* 搜索和过滤控件 */}
          <div className="rules-filters">
            <div className="search-box">
              <FiSearch size={16} className="search-icon" />
              <input
                type="text"
                placeholder="搜索规则名称、模式或描述..."
                value={ruleSearchTerm}
                onChange={(e) => setRuleSearchTerm(e.target.value)}
                className="search-input"
              />
            </div>
            <div className="filter-box">
              <FiFilter size={16} className="filter-icon" />
              <select
                value={ruleTypeFilter}
                onChange={(e) => setRuleTypeFilter(e.target.value as FingerprintType | 'all')}
                className="filter-select"
              >
                <option value="all">所有类型</option>
                <option value={FingerprintType.FRAMEWORK}>框架</option>
                <option value={FingerprintType.SERVER}>服务器</option>
                <option value={FingerprintType.SECURITY}>安全</option>
                <option value={FingerprintType.TECHNOLOGY}>技术</option>
                <option value={FingerprintType.CMS}>CMS</option>
                <option value={FingerprintType.CDN}>CDN</option>
                <option value={FingerprintType.COMPONENT}>组件</option>
                <option value={FingerprintType.OS}>操作系统</option>
              </select>
            </div>
            <div className="filter-stats">
              显示 {filteredRules.length} / {rules.length} 个规则
            </div>
          </div>

          {showAddRule && (
            <div className="add-rule-form">
              <h4>{editingRule ? '编辑规则' : '添加新规则'}</h4>
              <div className="form-group">
                <label>规则名称:</label>
                <input
                  type="text"
                  value={newRule.name}
                  onChange={(e) => setNewRule({...newRule, name: e.target.value})}
                  placeholder="输入规则名称"
                />
              </div>
              <div className="form-group">
                <label>匹配模式:</label>
                <input
                  type="text"
                  value={newRule.pattern}
                  onChange={(e) => setNewRule({...newRule, pattern: e.target.value})}
                  placeholder="输入正则表达式模式"
                />
              </div>
              <div className="form-group">
                <label>匹配目标:</label>
                <select
                  value={newRule.matchTarget}
                  onChange={(e) => setNewRule({...newRule, matchTarget: e.target.value as MatchTarget, targetField: ''})}
                >
                  <option value={MatchTarget.RESPONSE_HEADER}>响应头</option>
                  <option value={MatchTarget.REQUEST_HEADER}>请求头</option>
                  <option value={MatchTarget.RESPONSE_BODY}>响应主体</option>
                  <option value={MatchTarget.COOKIE}>Cookie</option>
                  <option value={MatchTarget.URL}>URL</option>
                  <option value={MatchTarget.PAGE_CONTENT}>页面内容</option>
                  <option value={MatchTarget.JAVASCRIPT}>JavaScript</option>
                  <option value={MatchTarget.CSS}>CSS样式</option>
                  <option value={MatchTarget.META_TAG}>Meta标签</option>
                </select>
              </div>
              {(newRule.matchTarget === MatchTarget.RESPONSE_HEADER ||
                newRule.matchTarget === MatchTarget.REQUEST_HEADER) && (
                <div className="form-group">
                  <label>具体字段:</label>
                  <input
                    type="text"
                    value={newRule.targetField || ''}
                    onChange={(e) => setNewRule({...newRule, targetField: e.target.value})}
                    placeholder="如: server, x-powered-by, content-type"
                  />
                </div>
              )}
              <div className="form-group">
                <label>风险等级:</label>
                <select
                  value={newRule.riskLevel}
                  onChange={(e) => setNewRule({...newRule, riskLevel: e.target.value as any})}
                >
                  <option value="low">低</option>
                  <option value="medium">中</option>
                  <option value="high">高</option>
                  <option value="critical">严重</option>
                </select>
              </div>
              <div className="form-group">
                <label>描述:</label>
                <textarea
                  value={newRule.description}
                  onChange={(e) => setNewRule({...newRule, description: e.target.value})}
                  placeholder="输入规则描述"
                />
              </div>
              <div className="form-actions">
                <button onClick={editingRule ? handleUpdateRule : handleAddRule}>
                  <FiSave size={16} />
                  {editingRule ? '更新' : '保存'}
                </button>
                <button onClick={() => {
                  setShowAddRule(false);
                  setEditingRule(null);
                  setNewRule({
                    name: '',
                    pattern: '',
                    type: FingerprintType.FRAMEWORK,
                    matchTarget: MatchTarget.RESPONSE_HEADER,
                    targetField: '',
                    description: '',
                    riskLevel: 'low',
                    enabled: true
                  });
                }}>取消</button>
              </div>
            </div>
          )}

          <div className="rules-list">
            {filteredRules.map((rule) => (
              <div key={rule.id} className="rule-item">
                <div className="rule-header">
                  <div className="rule-info">
                    <span className="rule-name">{rule.name}</span>
                    <span className="rule-type">{rule.type}</span>
                    <span 
                      className="rule-risk"
                      style={{ backgroundColor: getRiskLevelColor(rule.riskLevel) }}
                    >
                      {rule.riskLevel.toUpperCase()}
                    </span>
                  </div>
                  <div className="rule-actions">
                    <label className="rule-toggle">
                      <input
                        type="checkbox"
                        checked={rule.enabled}
                        onChange={() => handleToggleRule(rule)}
                      />
                      启用
                    </label>
                    <button 
                      className="edit-rule-button"
                      onClick={() => handleEditRule(rule)}
                    >
                      <FiEdit3 size={16} />
                      编辑
                    </button>
                    <button 
                      className="delete-rule-button"
                      onClick={() => handleDeleteRule(rule.id)}
                    >
                      <FiTrash2 size={16} />
                      删除
                    </button>
                  </div>
                </div>
                <div className="rule-details">
                  <p className="rule-pattern">模式: {rule.pattern}</p>
                  <p className="rule-description">{rule.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default FingerprintDetector;
