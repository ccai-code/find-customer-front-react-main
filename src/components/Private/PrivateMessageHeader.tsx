import React from 'react';
import { PlatformIcon } from '../../hooks';

interface Task {
  platform: string;
  keyword: string;
  market_progress?: number;
  intent_count?: number;
}

interface ProgressData {
  num: number;
  sum: number;
  state: number;
}

interface PrivateMessageHeaderProps {
  currentTask?: Task;
  progressData?: ProgressData;
  messageAllUsers?: boolean; // 新增：传递isall状态
}

const PrivateMessageHeader: React.FC<PrivateMessageHeaderProps> = ({ currentTask, progressData, messageAllUsers }) => {
  return (
    <div style={{ 
      display: 'flex', 
      alignItems: 'center', 
      marginBottom: '20px', 
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-start',
        width: '800px'
      }}>
        <span style={{
          fontSize: '24px',
          fontWeight: '700',
          color: '#1d2129',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          {currentTask ? (
            <>
              <PlatformIcon
                platform={currentTask.platform}
                style={{
                  fontSize: '24px',
                  width: '28px',
                  height: '28px',
                  color: currentTask.platform === 'dy' ? '#000' : '#ff2442'
                }}
              />
              <span style={{ 
                color: '#1d2129', 
                fontSize: '24px',
                fontWeight: '700'
              }}>
                {currentTask.keyword}
              </span>
              
              {/* 意向客户数量紧挨着标题右边 - 同步进度条数据 */}
              {(progressData?.sum !== undefined || currentTask.intent_count !== undefined) && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '6px 12px',
                  backgroundColor: '#f6ffed',
                  border: '1px solid #b7eb8f',
                  borderRadius: '16px',
                  fontSize: '14px',
                  color: '#52c41a',
                  fontWeight: '500',
                  marginLeft: '16px'
                }}>
                  <span>{messageAllUsers ? '客户' : '意向客户'}</span>
                  <span style={{
                    fontSize: '16px',
                    fontWeight: '700',
                    color: '#389e0d'
                  }}>
                    {messageAllUsers 
                      ? (progressData?.sum !== undefined ? progressData.sum : 0)  // isall为1时显示进度条总数
                      : (currentTask.intent_count || 0)  // isall为0时显示意向客户数量
                    }
                  </span>
                  <span>位</span>
                </div>
              )}
            </>
          ) : (
            <span style={{ color: '#86909c' }}>请选择任务</span>
          )}
        </span>
      </div>
    </div>
  );
};

export default PrivateMessageHeader;
