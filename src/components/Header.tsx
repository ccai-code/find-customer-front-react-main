import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Menu, Dropdown } from '@arco-design/web-react';
import { getUserInfo } from '../api/api';

interface HeaderProps {
  onLogout?: () => void;
  activeTab?: string;
  onTabChange?: (key: string) => void;
}

const Header: React.FC<HeaderProps> = ({ onLogout, activeTab = 'collection', onTabChange }) => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // 从localStorage获取用户名，如果没有则从URL参数中解码获取
  const getUsername = () => {
    const storedUsername = localStorage.getItem('username');
    if (storedUsername) {
      return storedUsername;
    }
    
    // 如果localStorage中没有，尝试从URL参数中获取并解码
    const urlParams = new URLSearchParams(window.location.search);
    const usernameParam = urlParams.get('username');
    if (usernameParam) {
      try {
        const decodedUsername = decodeURIComponent(usernameParam);
        // 保存到localStorage中
        localStorage.setItem('username', decodedUsername);
        return decodedUsername;
      } catch (error) {
        console.error('解码用户名失败:', error);
      }
    }
    
    return '智网识客';
  };
  
  const username = getUsername();
  
  // 用户信息状态
  const [userInfo, setUserInfo] = useState<{
    package_type: number;
    subscription_end_date: number;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  // 获取用户信息
  const fetchUserInfo = async () => {
    try {
      setLoading(true);
      const response = await getUserInfo();
      if (response.status === 200 && response.data) {
        setUserInfo(response.data);
      }
    } catch (error) {
      console.error('获取用户信息失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 格式化会员到期时间
  const formatSubscriptionDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  };

  const handleLogout = () => {
    // 清除本地存储的登录信息
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    localStorage.removeItem('userInfo');
    
    // 调用父组件的退出登录回调
    if (onLogout) {
      onLogout();
    }
    
    // 直接跳转到登录页面
    navigate('/login');
  };

  // 组件挂载时获取用户信息
  useEffect(() => {
    fetchUserInfo();
  }, []);

  const handleTabChange = (key: string) => {
    // 先更新父组件的状态
    onTabChange?.(key);
    
    // 然后进行路由导航
    switch (key) {
      case 'collection':
        if (location.pathname !== '/collection' && location.pathname !== '/') {
          navigate('/collection');
        }
        break;
      case 'analysis':
        if (!location.pathname.startsWith('/analysis')) {
          // 从私信页面跳转时，传递当前选中的任务ID
          // 优先使用私信页面的任务ID，其次使用分析页面的任务ID
          const privateMessageTaskId = localStorage.getItem('privateMessage_selectedTaskId');
          const analysisTaskId = localStorage.getItem('analysis_selectedTaskId');
          const currentSelectedTaskId = privateMessageTaskId || analysisTaskId;
          
          console.log('🔄 跳转到分析页面:', { 
            privateMessageTaskId, 
            analysisTaskId, 
            currentSelectedTaskId 
          });
          
          if (currentSelectedTaskId) {
            // 同步两个localStorage键，确保一致性
            localStorage.setItem('analysis_selectedTaskId', currentSelectedTaskId);
            localStorage.setItem('privateMessage_selectedTaskId', currentSelectedTaskId);
            console.log('🔄 跳转时同步localStorage:', currentSelectedTaskId);
            navigate('/analysis', { state: { selectedTaskId: currentSelectedTaskId } });
          } else {
            // 无任务ID时直接跳转，无需记录日志
            navigate('/analysis');
          }
        }
        break;
      case 'message':
        if (location.pathname !== '/message') {
          navigate('/message');
        }
        break;
      default:
        if (location.pathname !== '/') {
          navigate('/');
        }
    }
  };

  return (
    <div style={{ 
      background: '#fff', 
      boxShadow: '0 2px 8px rgba(0,0,0,0.05)', 
      display: 'flex', 
      alignItems: 'center', 
      padding: '0 32px', 
      height: 56 
    }}>
      <div style={{ display: 'flex', alignItems: 'center', marginRight: 32 }}>
        <img src="/favicon.svg" alt="favicon" style={{ height: 32, marginRight: 8 }} />
        <span style={{ fontWeight: 700, fontSize: 18, color: '#3491fa' }}>智网识客</span>
      </div>
      
      <Menu
        mode="horizontal"
        selectedKeys={[activeTab]}
        style={{ flex: 1, background: 'transparent' }}
        onClickMenuItem={handleTabChange}
      >
        <Menu.Item key="collection">收集内容评论</Menu.Item>
        <Menu.Item key="analysis">分析客户意向</Menu.Item>
        <Menu.Item key="message">私信意向客户</Menu.Item>
      </Menu>
      
             {/* 添加CSS样式来自定义菜单高亮样式 */}
               <style>
          {`
            /* 隐藏Arco Design的默认下划线 */
            .arco-menu-horizontal .arco-menu-item::after {
              display: none !important;
            }
            
            /* 隐藏Arco Design的选中标签下划线 */
            .arco-menu-selected-label {
              display: none !important;
            }
            
            /* 自定义菜单高亮样式 */
            .arco-menu-horizontal .arco-menu-item {
              position: relative;
              transition: all 0.3s ease;
            }
            
            .arco-menu-horizontal .arco-menu-item::before {
              content: '';
              position: absolute;
              bottom: 0;
              left: 50%;
              width: 0;
              height: 2px;
              background-color: #3491fa;
              transition: all 0.3s ease;
              transform: translateX(-50%);
            }
            
            .arco-menu-horizontal .arco-menu-item.arco-menu-selected::before {
              width: 100%;
            }
            
            .arco-menu-horizontal .arco-menu-item:hover::before {
              width: 100%;
              background-color: #3491fa;
            }
            
            /* 确保选中状态的文字颜色也是蓝色 */
            .arco-menu-horizontal .arco-menu-item.arco-menu-selected {
              color: #3491fa !important;
              font-weight: 600;
            }
            
            /* 悬停状态 */
            .arco-menu-horizontal .arco-menu-item:hover {
              color: #3491fa !important;
            }
          `}
        </style>
      
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <span 
          style={{ color: '#3491fa', fontWeight: 600, cursor: 'pointer' }}
          onClick={() => window.open('https://xcn9f50y4vw5.feishu.cn/wiki/Y26hwDUgAioiDzkx7CbcZFC5n1b', '_blank')}
        >
          使用文档
        </span>
        <span style={{ color: 'orange' }}>会员时间</span>
        <span style={{ color: '#999' }}>
          {loading ? '加载中...' : userInfo ? `至 ${formatSubscriptionDate(userInfo.subscription_end_date)}` : '获取中...'}
        </span>
        <span>
          <Dropdown droplist={
            <Menu>
              <Menu.Item key="logout" onClick={handleLogout}>退出登录</Menu.Item>
            </Menu>
          }>
            <span style={{ cursor: 'pointer' }}>
              {username} ▼
            </span>
          </Dropdown>
        </span>
      </div>
    </div>
  );
};

export default Header;
