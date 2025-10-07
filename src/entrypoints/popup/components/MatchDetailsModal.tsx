import React from 'react';
import { FiX, FiCopy, FiCheck } from 'react-icons/fi';
import { RegexMatch } from '../services/regex-service';
import '../styles/MatchDetailsModal.css';

interface MatchDetailsModalProps {
  match: RegexMatch | null;
  isOpen: boolean;
  onClose: () => void;
}

const MatchDetailsModal: React.FC<MatchDetailsModalProps> = ({ match, isOpen, onClose }) => {
  const [copiedField, setCopiedField] = React.useState<string | null>(null);

  if (!isOpen || !match) {
    return null;
  }

  const copyToClipboard = async (text: string, fieldName: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(fieldName);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (error) {
      console.error('复制失败:', error);
      // 回退方案
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopiedField(fieldName);
      setTimeout(() => setCopiedField(null), 2000);
    }
  };

  const CopyButton: React.FC<{ text: string; fieldName: string; label: string }> = ({ 
    text, 
    fieldName, 
    label 
  }) => (
    <div className="detail-row">
      <div className="detail-label">{label}:</div>
      <div className="detail-content">
        <span className="detail-text">{text}</span>
        <button
          className="copy-button"
          onClick={() => copyToClipboard(text, fieldName)}
          title="复制到剪贴板"
        >
          {copiedField === fieldName ? (
            <FiCheck size={14} className="copy-success" />
          ) : (
            <FiCopy size={14} />
          )}
        </button>
      </div>
    </div>
  );

  return (
    <div className="match-details-modal-overlay" onClick={onClose}>
      <div className="match-details-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>匹配详情</h3>
          <button className="close-button" onClick={onClose}>
            <FiX size={18} />
          </button>
        </div>
        
        <div className="modal-content">
          <CopyButton 
            text={match.ruleName} 
            fieldName="ruleName" 
            label="规则名称" 
          />
          
          <CopyButton 
            text={match.matchedContent} 
            fieldName="matchedContent" 
            label="匹配内容" 
          />
          
          <CopyButton 
            text={match.url} 
            fieldName="url" 
            label="完整URL" 
          />
          
          <CopyButton 
            text={match.scope} 
            fieldName="scope" 
            label="应用范围" 
          />
          
          <CopyButton 
            text={new Date(match.timestamp).toLocaleString()} 
            fieldName="timestamp" 
            label="匹配时间" 
          />
          
          <CopyButton 
            text={match.ruleId} 
            fieldName="ruleId" 
            label="规则ID" 
          />
        </div>
        
        <div className="modal-footer">
          <button className="close-modal-button" onClick={onClose}>
            关闭
          </button>
        </div>
      </div>
    </div>
  );
};

export default MatchDetailsModal;
