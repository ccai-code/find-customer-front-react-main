import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import Header from '../components/Header';
import CommentCollection from './CommentCollection';
import CommentAnalysis from './CommentAnalysis';
import PrivateMessage from './PrivateMessage';

interface MainProps {
  onLogout: () => void;
}

export default function Main({ onLogout }: MainProps) {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('collection');
  
  // 从URL路径中解析taskId
  const taskId = location.pathname.startsWith('/analysis/') 
    ? location.pathname.split('/analysis/')[1] 
    : undefined;

  // 根据当前路由路径设置活动标签 - 优化避免不必要的状态更新
  const updateActiveTabFromRoute = useCallback(() => {
    const pathname = location.pathname;
    console.log('Main: 路由变化，当前路径:', pathname, 'taskId:', taskId);
    
    let newActiveTab = 'collection';
    if (pathname.startsWith('/analysis')) {
      newActiveTab = 'analysis';
    } else if (pathname.startsWith('/message')) {
      newActiveTab = 'message';
    } else if (pathname.startsWith('/collection') || pathname === '/') {
      newActiveTab = 'collection';
    }
    
    // 只有当标签真正需要改变时才更新状态
    if (newActiveTab !== activeTab) {
      console.log('Main: 设置活动标签为', newActiveTab);
      setActiveTab(newActiveTab);
    }
  }, [location.pathname, activeTab, taskId]);

  // 当路由变化时更新活动标签
  useEffect(() => {
    updateActiveTabFromRoute();
  }, [updateActiveTabFromRoute]);

  // 处理标签变化
  const handleTabChange = useCallback((key: string) => {
    // console.log('Main: 标签变化，新标签:', key);
    setActiveTab(key);
  }, []);

  // 监听 activeTab 变化
  useEffect(() => {
    // console.log('Main: activeTab 变化为:', activeTab);
  }, [activeTab]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    onLogout();
  };

  return (
    <div style={{ width: '100%' }}>
      <Header 
        onLogout={handleLogout} 
        activeTab={activeTab}
        onTabChange={handleTabChange}
      />
      <div style={{ 
        width: '100%',
      }}>
        <div style={{
          background: '#fff',
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          width: '100%'
        }}>
          {activeTab === 'collection' && (
            <div style={{ height: '100%', width: '100%' }}>
              <CommentCollection />
            </div>
          )}
          {activeTab === 'analysis' && (
            <div style={{ height: '100%', width: '100%' }}>
              <CommentAnalysis taskId={taskId} />
            </div>
          )}
          {activeTab === 'message' && (
            <div style={{ height: '100%', width: '100%' }}>
              <PrivateMessage />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
