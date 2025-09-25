import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Layout, Menu, Spin, Tag, Popover } from '@arco-design/web-react';

const Sider = Layout.Sider;

// 定义类型接口 - 从 useSidebar 集成
export interface Task {
  task_id: string;
  keyword: string;
  platform: string;
  analysis_state?: string;
  market_state?: string;
  progress?: number;
  market_progress?: number; // 私信进度
}

interface TaskSidebarProps {
  tasks: Task[];
  loading: boolean;
  selectedTaskId: string | null;
  onTaskSelect: (taskId: string) => void;
  pageType?: 'analysis' | 'privateCustomer';
  hasMoreTasks?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
}

// 从 AnalysisComponents 集成的 StatusIcon 组件
function StatusIcon({ status, progress = 0 }: {
  status?: 'success' | 'processing' | 'pending' | 'error';
  progress?: number;
}) {
  // 优先根据progress判断，如果progress为100%，显示绿色完成图标
  if (progress === 100) {
    return (
      <svg width="20" height="20" viewBox="0 0 20 20">
        <circle cx="10" cy="10" r="8" fill="#fff" stroke="#52c41a" strokeWidth="2" />
        <path d="M7 10l2 2 4-4" stroke="#52c41a" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    );
  }
  
  // 如果进度在0-100之间，显示黄色进度弧线
  if (progress > 0 && progress < 100) {
    // 计算弧线角度，progress百分比转换为角度（0-360度）
    const angle = (progress / 100) * 360;
    const radians = (angle - 90) * (Math.PI / 180); // -90度是为了从顶部开始
    const x = 10 + 8 * Math.cos(radians);
    const y = 10 + 8 * Math.sin(radians);
    const largeArcFlag = angle > 180 ? 1 : 0;
    
    return (
      <svg width="20" height="20" viewBox="0 0 20 20">
        <circle cx="10" cy="10" r="8" fill="#fff" stroke="#faad14" strokeWidth="2" opacity="0.3"/>
        <path
          d={`M10 2 A8 8 0 ${largeArcFlag} 1 ${x} ${y}`}
          stroke="#faad14"
          strokeWidth="2.5"
          fill="none"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  
  // 如果没有progress数据，则根据status判断
  if (status === 'success') {
    return (
      <svg width="20" height="20" viewBox="0 0 20 20">
        <circle cx="10" cy="10" r="8" fill="#fff" stroke="#52c41a" strokeWidth="2" />
        <path d="M7 10l2 2 4-4" stroke="#52c41a" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    );
  }
  
  // 默认状态（进度为0或pending状态）
  if (status === 'pending' || progress === 0) {
    return (
      <svg width="20" height="20" viewBox="0 0 20 20">
        <circle cx="10" cy="10" r="8" fill="#fff" stroke="#1890ff" strokeWidth="2" />
        <polygon points="8,7 14,10 8,13" fill="#1890ff"/>
      </svg>
    );
  }
  
  // 兜底处理
  if (status === 'processing') {
    return (
      <svg width="20" height="20" viewBox="0 0 20 20">
        <circle cx="10" cy="10" r="8" fill="#fff" stroke="#faad14" strokeWidth="2" opacity="0.3"/>
        <path
          d="M10 2 a8 8 0 0 1 0 16"
          stroke="#faad14"
          strokeWidth="2.5"
          fill="none"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  
  return null;
}

// 从 AnalysisComponents 集成的 PlatformIcon 组件
function PlatformIcon({ platform, style = {} }: {
  platform?: string;
  style?: React.CSSProperties;
}) {
  // 支持多种平台值格式
  if (platform === 'douyin' || platform === 'dy' || platform === '抖音') {
    return <img src="/dy.svg" alt="抖音" style={{ width: 24, ...style }} />;
  }
  if (platform === 'xiaohongshu' || platform === 'xhs' || platform === '小红书') {
    return <img src="/xhs.svg" alt="小红书" style={{ width: 24, ...style }} />;
  }
  
  // 如果没有匹配的平台，显示默认图标或文本
  return <span style={{ fontSize: 12, color: '#999', ...style }}>{platform || '未知'}</span>;
}

// 从 AnalysisComponents 集成的 StatusTag 组件
function StatusTag({ 
  value, 
  options, 
  onChange, 
  record 
}: {
  value: string;
  options: { value: string; label: string; color: string; }[];
  onChange: (value: string, record: any) => void;
  record: any;
}) {
  // 找到当前状态对应的配置
  const current = options.find(opt => opt.value === value) || options[0];
  
  // 弹出菜单的内容
  const content = (
    <div>
      {options.map(opt => (
        <div
          key={opt.value}
          style={{
            padding: '6px 16px',
            cursor: 'pointer',
            color: opt.color,
            fontWeight: current.value === opt.value ? 'bold' : '300',
            background: current.value === opt.value ? '#f2f3f5' : 'transparent',
            borderRadius: 4
          }}
          onClick={() => onChange(opt.value, record)}
        >
          {opt.label}
        </div>
      ))}
    </div>
  );
  
  // 根据状态颜色决定 Tag 的颜色
  const getTagColor = (color: string): string => {
    if (color === '#52c41a') return 'green';
    if (color === '#faad14') return 'orange';
    return 'default';
  };
  
  return (
    <Popover content={content} trigger="hover" position="br">
      <Tag 
        color={getTagColor(current.color)}
        style={{ cursor: 'pointer', minWidth: '80px' }}
      >
        {current.label}
      </Tag>
    </Popover>
  );
}

// 从 SidebarMenu 集成的滚动进度条组件
const ScrollProgressBar = ({ scrollTop, scrollHeight, clientHeight }: {
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
}) => {
  const progress = scrollHeight > clientHeight ? (scrollTop / (scrollHeight - clientHeight)) * 100 : 0;
  
  return (
    <div style={{
      position: 'absolute',
      right: 0,
      top: 0,
      width: 3,
      height: '100%',
      background: '#f0f0f0',
      borderRadius: '2px',
      overflow: 'hidden',
      opacity: 0.6
    }}>
      <div style={{
        position: 'absolute',
        top: 0,
        right: 0,
        width: '100%',
        height: `${progress}%`,
        background: '#1890ff',
        borderRadius: '2px',
        transition: 'height 0.2s ease-out'
      }} />
    </div>
  );
};

// 从 useSidebar 集成的逻辑
function useTaskSidebarLogic(options: TaskSidebarProps) {
  const { 
        // tasks,
    // selectedTaskId, 
    onTaskSelect, 
    pageType = 'analysis',
    hasMoreTasks = false,
    isLoadingMore = false,
    onLoadMore = () => {}
  } = options;

  // 滚动相关的ref
  const menuRef = useRef<HTMLDivElement>(null);
  
  // 滚动进度状态
  const [scrollProgress, setScrollProgress] = useState({
    scrollTop: 0,
    scrollHeight: 0,
    clientHeight: 0
  });

  // 监听滚动，接近底部触发加载更多
  const handleScroll = useCallback((e: Event) => {
    const target = e.target as HTMLElement;
    const threshold = 200; // 距底部200px以内触发，让加载更早开始
    const distanceToBottom = target.scrollHeight - target.scrollTop - target.clientHeight;

    // 更新滚动进度
    setScrollProgress({
      scrollTop: target.scrollTop,
      scrollHeight: target.scrollHeight,
      clientHeight: target.clientHeight
    });

    if (distanceToBottom <= threshold && hasMoreTasks && !isLoadingMore) {
      onLoadMore();
    }
  }, [hasMoreTasks, isLoadingMore, onLoadMore]);

  // 处理任务点击事件
  const handleTaskClick = useCallback((taskId: string) => {
    // console.log('TaskSidebar handleTaskClick called with:', taskId);
    if (taskId) {
              // console.log('Calling onTaskSelect with:', taskId);
      onTaskSelect(taskId);
    } else {
      console.warn('TaskSidebar: taskId is empty or undefined');
    }
  }, [onTaskSelect]);

  // 根据页面类型获取任务状态
  const getStatus = useCallback((task: Task) => {
    if (pageType === 'privateCustomer') {
      // PrivateCustomer页面：根据 market_state 和 analysis_state 判断状态
      if (task.market_state === 'finish') {
        return 'success'; // 绿色 - 已私信
      } else if (task.market_state === 'processing') {
        return 'processing'; // 黄色 - 私信中
      } else if (task.analysis_state === 'initial') {
        return 'pending'; // 蓝色 - 未分析
      } else {
        return 'pending'; // 蓝色 - 未开始私信
      }
    } else {
      // Analysis页面：使用analysis_state
      if (task.analysis_state === 'finish') {
        return 'success'; // 绿色
      } else if (task.analysis_state === 'running') {
        return 'processing'; // 黄色
      } else if (task.analysis_state === 'initial') {
        return 'pending'; // 灰色
      }
    }
    return 'pending'; // 兜底，映射为pending状态
  }, [pageType]);

  // 初始化滚动进度
  useEffect(() => {
    const menuElement = menuRef.current;
    if (menuElement) {
      // 查找实际的滚动容器（Menu组件内部的滚动容器）
      const scrollContainer = menuElement.querySelector('.arco-menu') || menuElement;
      
      // 初始化滚动进度
      setScrollProgress({
        scrollTop: scrollContainer.scrollTop,
        scrollHeight: scrollContainer.scrollHeight,
        clientHeight: scrollContainer.clientHeight
      });
    }
  }, []);

  return {
    menuRef,
    scrollProgress,
    handleScroll,
    handleTaskClick,
    getStatus
  };
}

// 任务菜单组件 - 从 SidebarMenu 集成
const TaskMenu: React.FC<TaskSidebarProps> = (props) => {
  const { 
    tasks, 
    loading, 
    selectedTaskId = null,
    onTaskSelect = () => {},
    pageType = 'analysis',
    hasMoreTasks = false,
    isLoadingMore = false,
    onLoadMore = () => {}
  } = props;

  // 使用集成的逻辑
  const { menuRef, scrollProgress, handleScroll, handleTaskClick, getStatus } = useTaskSidebarLogic({
    tasks,
    loading,
    selectedTaskId,
    onTaskSelect,
    pageType,
    hasMoreTasks,
    isLoadingMore,
    onLoadMore
  });

  // 添加滚动事件监听
  useEffect(() => {
    const menuElement = document.querySelector('.arco-menu');
    if (menuElement) {
      menuElement.addEventListener('scroll', handleScroll, { passive: true });
      
      return () => {
        menuElement.removeEventListener('scroll', handleScroll);
      };
    }
  }, [handleScroll]);

  if (loading) {
    return (
      <div style={{ padding: '32px 0', textAlign: 'center' }}>
        <Spin tip="加载中..." />
      </div>
    );
  }

  return (
    <div ref={menuRef} style={{ 
      height: 'calc(100vh - 80px)', 
      maxHeight: 'calc(100vh - 80px)',
      display: 'flex', 
      flexDirection: 'column', 
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* 滚动进度条 */}
      <ScrollProgressBar 
        scrollTop={scrollProgress.scrollTop}
        scrollHeight={scrollProgress.scrollHeight}
        clientHeight={scrollProgress.clientHeight}
      />
      
      <Menu
        style={{
          flex: 1,
          border: 'none',
          background: 'transparent',
          overflow: 'auto',
          height: '100%',
          maxHeight: '100%',
          // 强制隐藏滚动条
          scrollbarWidth: 'none', // Firefox
          msOverflowStyle: 'none', // IE/Edge
          // 禁止左右滚动，只允许上下滚动
          overflowX: 'hidden',
          overflowY: 'auto'
        }}
        selectedKeys={selectedTaskId ? [selectedTaskId] : []}
        defaultSelectedKeys={[]}
        mode="vertical"
        // 添加触摸事件处理，禁止左右滑动
        onTouchStart={(e) => {
          // 记录触摸起始位置
          e.currentTarget.dataset.touchStartX = e.touches[0].clientX.toString();
          e.currentTarget.dataset.touchStartY = e.touches[0].clientY.toString();
        }}
        onTouchMove={(e) => {
          // 只允许垂直滚动，阻止水平滑动
          const touch = e.touches[0];
          const startX = parseInt(e.currentTarget.dataset.touchStartX || '0');
          const startY = parseInt(e.currentTarget.dataset.touchStartY || '0');
          
          // 如果水平移动距离大于垂直移动距离，则阻止默认行为
          if (Math.abs(touch.clientX - startX) > Math.abs(touch.clientY - startY)) {
            // 使用 stopPropagation 而不是 preventDefault
            e.stopPropagation();
            return false;
          }
        }}
      >
        {tasks.map((item, index) => {
          const taskId = item.task_id;
          return (
            <Menu.Item
              key={`${taskId}-${index}`}
              onClick={() => handleTaskClick(taskId)}
              style={{
                height: 'auto',
                        padding: '8px 12px',
        margin: '1px 4px',
                borderRadius: '6px',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              className={selectedTaskId === taskId ? 'selected-task' : ''}
            >
              <div 
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                {/* 状态图标 */}
                <span 
                  style={{
                    width: 20,
                    height: 20,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}
                >
                  <StatusIcon 
                    status={getStatus(item)} 
                    progress={pageType === 'privateCustomer' ? 
                      (item.market_progress && item.market_progress > 0 ? Math.min(item.market_progress, 100) : 0) : 
                      (item.progress || 0)
                    } 
                  />
                </span>
                                 {/* 任务关键词 */}
                 <span
                   style={{
                     flex: 1,
                     fontSize: 14,
                     height: 20,
                     display: 'flex',
                     alignItems: 'center',
                     fontWeight: selectedTaskId === taskId ? 'bold' : 'normal',
                     color: selectedTaskId === taskId ? '#1890ff' : '#333',
                     minWidth: 0,
                     overflow: 'hidden',
                     textOverflow: 'ellipsis',
                     whiteSpace: 'nowrap',
                   }}
                   title={item.keyword}
                 >
                   {(() => {
                     if (pageType === 'privateCustomer') {
                       // 私信页面：只有当analysis_state为'initial'时才显示"未分析"
                       if (item.analysis_state === 'initial') {
                         return `(未分析) ${item.keyword}`;
                       } else {
                         return item.keyword;
                       }
                     } else {
                       // 分析页面：不显示"未分析"字样，直接显示关键词
                       return item.keyword;
                     }
                   })()}
                 </span>
                {/* 平台logo */}
                <span 
                  style={{
                    width: 22,
                    height: 22,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginLeft: 6,
                    flexShrink: 0
                  }}
                >
                  <PlatformIcon platform={item.platform} style={{ width: 20, height: 20, display: 'block' }} />
                </span>
              </div>
            </Menu.Item>
          );
        })}
      </Menu>
      

    </div>
  );
};

/**
 * 统一的任务侧边栏组件
 * 完全集成了AnalysisComponents、SidebarMenu和useSidebar的功能
 * 可以被私信页面和分析页面共同使用
 */
const TaskSidebar: React.FC<TaskSidebarProps> = ({ 
  tasks, 
  loading, 
  selectedTaskId = null,
  onTaskSelect = () => {},
  pageType = 'analysis',
  hasMoreTasks = false,
  isLoadingMore = false,
  onLoadMore = () => {}
}) => {
  return (
    <>
      <style>
        {`
          .selected-task {
            background-color: #e6f7ff !important;
            border: 1px solid #91d5ff !important;
          }
          .arco-menu-item {
            transition: all 0.2s ease;
          }
          .arco-menu-item:hover {
            background-color: #f5f5f5;
          }
          
          /* 强制隐藏所有滚动条 - 使用更高优先级 */
          .arco-menu::-webkit-scrollbar,
          .arco-menu *::-webkit-scrollbar {
            width: 0 !important;
            height: 0 !important;
            display: none !important;
          }
          
          .arco-menu::-webkit-scrollbar-track,
          .arco-menu *::-webkit-scrollbar-track {
            display: none !important;
          }
          
          .arco-menu::-webkit-scrollbar-thumb,
          .arco-menu *::-webkit-scrollbar-thumb {
            display: none !important;
            width: 0 !important;
            height: 0 !important;
          }
          
          .arco-menu::-webkit-scrollbar-corner,
          .arco-menu *::-webkit-scrollbar-corner {
            display: none !important;
          }
          
          /* Firefox 滚动条隐藏 */
          .arco-menu,
          .arco-menu * {
            scrollbar-width: none !important;
            -ms-overflow-style: none !important;
          }
          
          /* 隐藏所有滚动条但保持滚动功能 */
          .arco-menu {
            /* 禁止左右滚动，只允许上下滚动 */
            overflow-x: hidden !important;
            overflow-y: auto !important;
            /* 禁止用户选择文本，防止意外拖动 */
            user-select: none !important;
            -webkit-user-select: none !important;
            -moz-user-select: none !important;
            -ms-user-select: none !important;
            /* 禁止触摸操作中的拖拽 */
            touch-action: pan-y !important;
            /* 确保内容不会超出容器 */
            max-width: 100% !important;
            width: 100% !important;
          }
          
          /* 确保任务项不会超出容器宽度 */
          .arco-menu-item {
            max-width: 100% !important;
            overflow: hidden !important;
            /* 禁止拖拽 */
            -webkit-user-drag: none !important;
            -khtml-user-drag: none !important;
            -moz-user-drag: none !important;
            -o-user-drag: none !important;
            user-drag: none !important;
          }
          
          /* 禁止触摸拖拽 */
          .arco-menu * {
            -webkit-touch-callout: none !important;
            -webkit-user-select: none !important;
            -khtml-user-select: none !important;
            -moz-user-select: none !important;
            -ms-user-select: none !important;
            user-select: none !important;
          }
          
          /* 针对可能的嵌套滚动容器 */
          .arco-menu .arco-menu-inner,
          .arco-menu .arco-menu-list {
            overflow-x: hidden !important;
            overflow-y: auto !important;
            scrollbar-width: none !important;
            -ms-overflow-style: none !important;
          }
          
          .arco-menu .arco-menu-inner::-webkit-scrollbar,
          .arco-menu .arco-menu-list::-webkit-scrollbar {
            width: 0 !important;
            height: 0 !important;
            display: none !important;
          }
          
          /* 去掉Sider组件的边框和阴影 */
          .arco-layout-sider {
            border: none !important;
            box-shadow: none !important;
            border-right: none !important;
            border-left: none !important;
          }
          
          /* 去掉可能的内部边框，但保留选中状态的边框 */
          .arco-layout-sider * {
            border: none !important;
            outline: none !important;
          }
          
          /* 恢复选中任务的蓝色边框 */
          .selected-task {
            background-color: #e6f7ff !important;
            border: 1px solid #91d5ff !important;
            border-radius: 6px !important;
          }
          
          /* 确保选中状态的文字颜色 */
          .selected-task .arco-menu-item-title {
            color: #1890ff !important;
            font-weight: bold !important;
          }
        `}
      </style>
      <Sider
        width={260}
        style={{
          height: 'calc(100vh - 40px)',
          maxHeight: 'calc(100vh - 40px)',
          borderRadius: 8,
          background: "white",
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          border: 'none',
          boxShadow: 'none',
          position: 'relative'
        }}
      >
        {loading ? (
          <Spin tip="加载中..." style={{ width: "100%" }} />
        ) : (
          <TaskMenu 
            tasks={tasks}
            loading={loading}
            selectedTaskId={selectedTaskId}
            onTaskSelect={onTaskSelect}
            pageType={pageType}
            hasMoreTasks={hasMoreTasks}
            isLoadingMore={isLoadingMore}
            onLoadMore={onLoadMore}
          />
        )}
      </Sider>
    </>
  );
};

export default TaskSidebar;
export { PlatformIcon, StatusTag, StatusIcon };
