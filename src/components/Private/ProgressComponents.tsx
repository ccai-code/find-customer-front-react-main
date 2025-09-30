import React from 'react';
import { Progress, Button } from '@arco-design/web-react';
import { IconCheck, IconClose, IconClockCircle } from '@arco-design/web-react/icon';

// 基础进度条组件
export const ProgressBar: React.FC<{ current: number; total: number }> = ({ current, total }) => {
  const percentage = total > 0 ? Math.round((current / total) * 100) : 0;
  
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <Progress
        percent={percentage}
        size="small"
        style={{ width: 120 }}
        showText={false}
      />
      <span style={{ fontSize: '12px', color: '#666', minWidth: '60px' }}>
        {current}/{total}
      </span>
    </div>
  );
};

// 营销进度条组件 - 与分析页面样式保持一致
export const MarketingProgressBar: React.FC<{ 
  current: number; 
  total: number; 
  isLoading?: boolean;
}> = React.memo(({ current, total, isLoading = false }) => {
  // 修复进度条计算，确保百分比不超过100%
  const percentage = total > 0 ? Math.min(Math.round((current / total) * 100), 100) : 0;
  const isCompleted = current === total && total > 0;
  
  // 如果正在加载，显示加载状态
  if (isLoading) {
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '10px',
        minWidth: '280px'
      }}>
        <span style={{ fontSize: '15px', color: '#666' }}>私信进度:</span>
        <span style={{ 
          minWidth: '40px', 
          textAlign: 'center',
          fontWeight: '500',
          color: '#c9cdd4',
          fontSize: '12px'
        }}>
          --
        </span>
        <Progress
          percent={0}
          size="default"
          style={{ 
            flex: 1, 
            minWidth: '120px'
          }}
          showText={false}
          status="normal"
        />
        <span style={{ 
          minWidth: '60px', 
          textAlign: 'right',
          fontWeight: '500',
          color: '#c9cdd4',
          fontSize: '14px'
        }}>
          --/--
        </span>
      </div>
    );
  }
  
  return (
    <div style={{ 
      display: 'flex', 
      alignItems: 'center', 
      gap: '10px',
      minWidth: '280px'
    }}>
      <span style={{ fontSize: '15px', color: '#666' }}>私信进度:</span>
      <span style={{ 
        minWidth: '40px', 
        textAlign: 'center',
        fontWeight: '500',
        color: total === 0 ? '#c9cdd4' : isCompleted ? '#52c41a' : '#1890ff',
        fontSize: '12px'
      }}>
        {total === 0 ? '0%' : `${percentage}%`}
      </span>
      <Progress
        percent={percentage}
        size="default"
        style={{ 
          flex: 1, 
          minWidth: '120px'
        }}
        showText={false}
        status={isCompleted ? 'success' : 'normal'}
      />
      <span style={{ 
        minWidth: '60px', 
        textAlign: 'right',
        fontWeight: '500',
        color: total === 0 ? '#c9cdd4' : isCompleted ? '#52c41a' : '#1890ff',
        fontSize: '14px'
      }}>
        {total === 0 ? '0/0' : `${current}/${total}`}
      </span>
      {isCompleted && (
        <IconCheck 
          style={{ 
            color: '#52c41a',
            fontSize: '16px',
            marginLeft: '-4px'
          }} 
        />
      )}
    </div>
  );
});

// 任务状态进度条组件
export const TaskProgressBar: React.FC<{ 
  current: number; 
  total: number; 
  state: number;
  onRetry?: () => void;
}> = ({ current, total, state, onRetry }) => {
  const percentage = total > 0 ? Math.round((current / total) * 100) : 0;
  
  const getStatusColor = () => {
    switch (state) {
      case 1: return '#52c41a'; // 成功
      case 2: return '#faad14'; // 警告
      case 3: return '#ff4d4f'; // 错误
      default: return '#1890ff'; // 默认
    }
  };
  
  const getStatusIcon = () => {
    switch (state) {
      case 1: return <IconCheck style={{ color: '#52c41a' }} />;
      case 2: return <IconClockCircle style={{ color: '#faad14' }} />;
      case 3: return <IconClose style={{ color: '#ff4d4f' }} />;
      default: return null;
    }
  };
  
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <Progress
        percent={percentage}
        size="small"
        style={{ width: 120 }}
        showText={false}
        color={getStatusColor()}
      />
      <span style={{ fontSize: '12px', color: '#666', minWidth: '60px' }}>
        {current}/{total}
      </span>
      {getStatusIcon()}
      {state === 3 && onRetry && (
        <Button 
          size="mini" 
          type="text" 
          onClick={onRetry}
          style={{ padding: '0 4px', fontSize: '12px' }}
        >
          重试
        </Button>
      )}
    </div>
  );
};
