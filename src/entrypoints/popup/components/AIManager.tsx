import React, { useState } from 'react';
import { FiSettings, FiMessageCircle, FiX } from 'react-icons/fi';
import AISettingsPanel from './AISettingsPanel';
import AIChatHistory from './AIChatHistory';
import '../styles/AIManager.css';

interface AIManagerProps {
  darkMode?: boolean;
  onSelectChat: (requestId: string) => void;
  onClose: () => void;
}

type TabType = 'settings' | 'history';

const AIManager: React.FC<AIManagerProps> = ({ 
  darkMode = true,
  onSelectChat,
  onClose
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('settings');
  
  return (
    <div className={`ai-manager ${darkMode ? 'dark' : 'light'}`}>
      <button 
        className="ai-manager-close-button" 
        onClick={onClose}
        title="关闭"
      >
        <FiX size={20} />
      </button>
      
      <div className="ai-manager-header">
        <div className="ai-manager-tabs">
          <button 
            className={`ai-tab-button ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            <FiSettings size={16} />
            <span>设置</span>
          </button>
          <button 
            className={`ai-tab-button ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            <FiMessageCircle size={16} />
            <span>历史记录</span>
          </button>
        </div>
      </div>
      
      <div className="ai-manager-content">
        {activeTab === 'settings' ? (
          <AISettingsPanel darkMode={darkMode} />
        ) : (
          <AIChatHistory 
            darkMode={darkMode} 
            onSelectChat={onSelectChat} 
          />
        )}
      </div>
    </div>
  );
};

export default AIManager; 