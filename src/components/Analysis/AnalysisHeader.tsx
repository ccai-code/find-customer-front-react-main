import React, { useState } from 'react';
import { PlatformIcon } from '../../hooks';
import { Button, Message } from '@arco-design/web-react';
import { IconPlayArrow, IconStop } from '@arco-design/web-react/icon';
import { useNavigate } from 'react-router-dom';
import { startAnalysisApi, stopAnalysisApi, type Task } from '../../api/api';

interface AnalysisHeaderProps {
  currentTask?: Task;
  onTaskUpdate?: () => void;
  serviceIntro?: string;
  targetCustomer?: string;
  analysisProgress?: number; // 添加分析进度参数
  progressData?: {
    num: number;
    sum: number;
    state: number;
    ic_num: number;
  } | null; // 添加进度数据参数
}

const AnalysisHeader: React.FC<AnalysisHeaderProps> = ({ 
  currentTask, 
  onTaskUpdate, 
  serviceIntro, 
  targetCustomer,
  analysisProgress = 0, // 默认值为0
  progressData // 添加progressData参数
}) => {
  const navigate = useNavigate();
  const [actionLoading, setActionLoading] = useState(false);
  
  // 本地状态管理按钮显示，确保立即响应
  // 使用Map来为每个任务单独维护状态
  const [taskAnalysisStates, setTaskAnalysisStates] = useState<Map<string, string>>(new Map());
  
  // 获取当前任务的分析状态
  const getCurrentTaskAnalysisState = () => {
    if (!currentTask?.task_id) return 'initial';
    
    // 优先使用本地状态，只有在本地没有状态时才使用服务器状态
    const localState = taskAnalysisStates.get(currentTask.task_id);
    if (localState) {
      return localState;
    }
    
    // 如果本地没有状态，使用服务器状态
    return currentTask.analysis_state || 'initial';
  };
  
  // 设置当前任务的分析状态
  const setCurrentTaskAnalysisState = (state: string) => {
    if (!currentTask?.task_id) return;
    setTaskAnalysisStates(prev => {
      const newMap = new Map(prev);
      newMap.set(currentTask.task_id, state);
      return newMap;
    });
  };
  
  // 当 currentTask 变化时，同步本地状态
  React.useEffect(() => {
    if (currentTask?.task_id) {
      const currentLocalState = getCurrentTaskAnalysisState();
      
      // 调试信息
      console.log('任务状态变化:', {
        taskId: currentTask?.task_id,
        analysis_state: currentTask?.analysis_state,
        intent_count: currentTask?.intent_count,
        currentLocalState: currentLocalState,
        analysisProgress,
        hasLocalState: taskAnalysisStates.has(currentTask.task_id)
      });
      
      // 只有在以下情况才同步服务器状态：
      // 1. 本地没有该任务的状态记录（首次加载）
      // 2. 本地状态不是 'running'（避免覆盖用户操作）
      // 3. 分析进度达到100%（分析完成）
      if (!taskAnalysisStates.has(currentTask.task_id) || 
          (currentLocalState !== 'running' && analysisProgress < 100)) {
        if (currentTask.analysis_state) {
          setCurrentTaskAnalysisState(currentTask.analysis_state);
        }
      }
    }
  }, [currentTask?.task_id, currentTask?.analysis_state, currentTask?.intent_count, analysisProgress]);

  // 操作按钮处理函数 - 添加防抖避免重复点击
  const handleGoToPrivateMessage = () => {
    if (currentTask) {
      // 防止重复点击
      if (actionLoading) return;
      
      // 将当前选中的任务ID保存到localStorage，供私信页面使用
      localStorage.setItem('analysis_selectedTaskId', currentTask.task_id);
      localStorage.setItem('privateMessage_selectedTaskId', currentTask.task_id);
      
      navigate('/message', { 
        state: { 
          selectedTaskId: currentTask.task_id,
          selectedPlatform: currentTask.platform,
          fromAnalysis: true // 添加标识，表示从分析页面跳转过来
        } 
      });
    }
  };

  const handleStartAnalysis = async () => {
    if (!currentTask) return;
    
    console.log('🚀 开始分析按钮被点击，当前数据:', {
      serviceIntro,
      targetCustomer,
      serviceIntroLength: serviceIntro?.length,
      targetCustomerLength: targetCustomer?.length
    });
    
    // 立即更新本地状态为 running，这样按钮会立即变为"停止分析"
    setCurrentTaskAnalysisState('running');
    
    // 通知父组件状态变化
    if (onTaskUpdate) {
      onTaskUpdate();
    }
    
    setActionLoading(true);
    try {
      // 使用动态生成的服务介绍和客户描述
      const dynamicServiceIntro = serviceIntro || `我是${currentTask.keyword}相关的服务提供商`;
      const dynamicTargetCustomer = targetCustomer || `需要${currentTask.keyword}相关服务的客户群体`;
      
      // 调用真实的开始分析API
      const response = await startAnalysisApi({
        comment_id: null,
        task_id: currentTask.task_id,
        platform: currentTask.platform,
        analysis_request: `背景：我们的服务介绍是：${dynamicServiceIntro}
我想要的客户描述：${dynamicTargetCustomer}
你要分析${currentTask.platform === 'dy' ? '抖音' : '小红书'}平台上关于《${currentTask.keyword}》搜索后呈现相关内容下方的评论，内容都是跟关键词对应相关的
你的任务：
1. 分析关键词背后对应的产品、服务、行业
2. 判断后面提供的评论是否是对这个关键词对应的营销视频/笔记内容感兴趣的客户
3. 对这个客户进行评级：
高意向：想了解我们的服务价格、或想学习、合作、加盟、购买以及对产品/服务有疑问或比较纠结的潜在客户
低意向：需求不确定、对产品/服务无意向或批评的客户、提供同样产品/服务的同行，直接意向判定为无意向`,
        output_fields: [
          {
            key: "意向客户",
            explanation: "用户是否为有明确意向了解/购买${currentTask.keyword}这个产品/服务的高意向客户（有明确意向填是，其他都填否)"
          },
          {
            key: "分析理由",
            explanation: "20字内简要说明这么分析的理由"
          }
        ]
      });
      
      if (response.status === 200) {
        Message.success('分析已开始');
        // 不需要再次调用 onTaskUpdate，因为我们已经提前更新了状态
      } else {
        // 如果API调用失败，回滚本地状态
        setCurrentTaskAnalysisState('initial');
        Message.error(response.msg || '开始分析失败，请稍后重试');
        if (onTaskUpdate) {
          onTaskUpdate();
        }
      }
    } catch (error) {
      console.error('开始分析失败:', error);
      Message.error('开始分析失败，请稍后重试');
      
      // 如果API调用失败，回滚本地状态
      setCurrentTaskAnalysisState('initial');
      if (onTaskUpdate) {
        onTaskUpdate();
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleStopAnalysis = async () => {
    if (!currentTask) return;
    
    console.log('🛑 停止分析按钮被点击');
    
    // 立即更新本地状态为 initial，这样按钮会立即变为"开始分析"
    setCurrentTaskAnalysisState('initial');
    
    // 通知父组件状态变化
    if (onTaskUpdate) {
      onTaskUpdate();
    }
    
    setActionLoading(true);
    try {
      // 调用真实的停止分析API
      const response = await stopAnalysisApi({
        task_id: currentTask.task_id
      });
      
      if (response.status === 200) {
        Message.success('分析已停止');
        // 不需要再次调用 onTaskUpdate，因为我们已经提前更新了状态
      } else {
        // 如果API调用失败，回滚本地状态
        setCurrentTaskAnalysisState('running');
        Message.error(response.msg || '停止分析失败，请稍后重试');
        if (onTaskUpdate) {
          onTaskUpdate();
        }
      }
    } catch (error) {
      console.error('停止分析失败:', error);
      Message.error('停止分析失败，请稍后重试');
      
      // 如果API调用失败，回滚本地状态
      setCurrentTaskAnalysisState('running');
      if (onTaskUpdate) {
        onTaskUpdate();
      }
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div style={{ margin: '15px' }}>
      {/* 任务标题区域 */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'flex-start',
        marginBottom: '20px',
        gap: '24px'
      }}>
        {/* 左侧：标题和图标 */}
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
                {currentTask.keyword}的意向
              </span>
              {/* 显示意向客户数量 */}
              <span style={{
                fontSize: '16px',
                fontWeight: '500',
                color: '#1890ff',
                backgroundColor: '#f0f9ff',
                padding: '4px 12px',
                borderRadius: '16px',
                border: '1px solid #dbeafe'
              }}>
                {currentTask.intent_count || 0} 位意向客户
              </span>
            </>
          ) : (
            <span style={{ color: '#86909c' }}>请选择任务</span>
          )}
        </span>

        {/* 右侧：操作按钮 */}
        {currentTask && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* 当分析进度为100%时显示"前往私信"按钮 */}
            {analysisProgress >= 100 && (
              <Button 
                type="primary" 
                onClick={handleGoToPrivateMessage}
                disabled={!progressData?.ic_num || progressData.ic_num === 0} // 当意向客户为0时禁用
                style={{ 
                  height: '32px',
                  borderRadius: '10px',
                  backgroundColor: (!progressData?.ic_num || progressData.ic_num === 0) ? '#d9d9d9' : '#52c41a',
                  borderColor: (!progressData?.ic_num || progressData.ic_num === 0) ? '#d9d9d9' : '#52c41a',
                  color: '#ffffff'
                }}
                title={(!progressData?.ic_num || progressData.ic_num === 0) ? '当前没有意向客户，无法前往私信' : '前往私信'}
              >
                前往私信
              </Button>
            )}
            
            {/* 当分析进度为100%时，不显示开始/停止分析按钮 */}
            {analysisProgress < 100 && (
              <>
                {/* 当分析未开始时，显示开始分析按钮 */}
                {getCurrentTaskAnalysisState() === 'initial' && (
                  <Button 
                    type="primary" 
                    icon={<IconPlayArrow />}
                    onClick={handleStartAnalysis}
                    loading={actionLoading}
                    disabled={!serviceIntro?.trim() || !targetCustomer?.trim()}
                    style={{ 
                      height: '32px',
                      borderRadius: '10px',
                      backgroundColor: (!serviceIntro?.trim() || !targetCustomer?.trim()) ? '#d9d9d9' : '#1890ff',
                      borderColor: (!serviceIntro?.trim() || !targetCustomer?.trim()) ? '#d9d9d9' : '#1890ff',
                      color: '#ffffff'
                    }}
                    title={(!serviceIntro?.trim() || !targetCustomer?.trim()) ? '请先填写"我的服务介绍"和"我想要的客户"后再开始分析' : '开始分析'}
                  >
                    开始分析
                  </Button>
                )}
                
                {/* 当分析进行中时，只显示停止分析按钮，直接替换开始分析按钮的位置 */}
                {getCurrentTaskAnalysisState() === 'running' && (
                  <Button 
                    type="primary" 
                    icon={<IconStop />}
                    onClick={handleStopAnalysis}
                    loading={actionLoading}
                    style={{ 
                      height: '32px',
                      borderRadius: '10px',
                      backgroundColor: '#ff9500',
                      borderColor: '#ff9500',
                      color: '#ffffff'
                    }}
                  >
                    停止分析
                  </Button>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AnalysisHeader;
