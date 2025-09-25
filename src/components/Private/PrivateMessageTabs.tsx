import React from 'react';
import { Tabs } from '@arco-design/web-react';
import { MarketingProgressBar } from '../index';

interface PrivateMessageTabsProps {
  activeTab: string;
  onTabChange: (key: string) => void;
  progressData: {
    num: number;
    sum: number;
    state: number;
  };
  isProgressLoading: boolean;
}

const PrivateMessageTabs: React.FC<PrivateMessageTabsProps> = React.memo(({
  activeTab,
  onTabChange,
  progressData,
  isProgressLoading
}) => {
  return (
    <div style={{ 
      display: 'flex', 
      alignItems: 'center', 
      gap: '40px',
      width: '100%'
    }}>
      <Tabs
        activeTab={activeTab}
        onChange={onTabChange}
        style={{ 
          minWidth: 200, 
          fontSize: '16px',
          fontWeight: '500'
        }}
        className="custom-tabs"
      >
        <Tabs.TabPane key="customers" title="意向客户" />
        <Tabs.TabPane key="private-message" title="前往私信" />
      </Tabs>
      
      {/* 自定义样式 */}
      <style>{`
        .custom-tabs .arco-tabs-nav-tab {
          background: #f8f9fa;
          border-radius: 12px;
          padding: 4px;
          border: none;
        }
        
        .custom-tabs .arco-tabs-nav-tab .arco-tabs-tab {
          border-radius: 8px;
          margin: 0 2px;
          padding: 8px 20px;
          font-weight: 500;
          transition: all 0.3s ease;
          border: none;
          background: transparent;
        }
        
        .custom-tabs .arco-tabs-nav-tab .arco-tabs-tab:hover {
          background: rgba(24, 144, 255, 0.1);
          color: #1890ff;
        }
        
        .custom-tabs .arco-tabs-nav-tab .arco-tabs-tab.arco-tabs-tab-active {
          background: #1890ff;
          color: white;
          box-shadow: 0 2px 8px rgba(24, 144, 255, 0.3);
        }
        
        .custom-tabs .arco-tabs-nav-tab .arco-tabs-tab.arco-tabs-tab-active:hover {
          background: #40a9ff;
          color: white;
        }
        
        .custom-tabs .arco-tabs-ink-bar {
          display: none;
        }
      `}</style>
      
      {/* 进度条放在右边 - 在所有标签页都显示 */}
      <MarketingProgressBar 
        current={progressData.num} 
        total={progressData.sum} 
        isLoading={isProgressLoading}
      />
    </div>
  );
  });

export default PrivateMessageTabs;
