import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Table, Button, Modal, InputNumber, Message, Tag, Slider, Drawer, Space } from '@arco-design/web-react';
import { IconSettings } from '@arco-design/web-react/icon';
import { 
  getDouyinAccounts, 
  getSimpleTimeGap, 
  setSimpleTimeGap,
  checkLocalServiceAvailability,
  postStartMarketByTaskIdApi,
  postStopMarketByTaskIdApi
} from '../../api/privateMessageApi';
import { getMarketProgressApi } from '../../api/api';
import type { StartMarketingParams, StopMarketingParams } from '../../api/privateMessageApi';

// 定义类型接口
interface Task {
  task_id: string;
  keyword: string;
  intent_count?: number;
  market_state?: string;
  analysis_state?: string; // 添加分析状态字段
}

interface DouyinAccount {
  user_id: string;
  account: string;
  task_id?: string;
  state: number | string;
  currentTask?: string;
  nickname?: string;
  avatar?: string;
  is_logged_in?: boolean;
  marketing_count?: number; // 新增：私信数量字段
  update_timestamp?: number; // 新增：更新时间戳字段
}



interface DouyinAccountTableProps {
  douyinAccounts: DouyinAccount[];
  accountsLoading: boolean;
  tasks: Task[];
  messagingAccounts: Set<string>;
  handleAddDouyinAccount: () => void;
  handleStartMessaging: (record: DouyinAccount) => void;
  handleStopMessaging: (record: DouyinAccount) => void;
  handleLoginDouyinAccount: (record: DouyinAccount) => void;
  currentTaskId?: string;
  onAccountsUpdate?: (accounts: DouyinAccount[]) => void;
  // 新增筛选相关props
  onlyMessageFilteredUsers: boolean;
  onOnlyMessageFilteredUsersChange: (value: boolean) => void;
  filteredUserRegions: string[];
  // 新增：当前任务的输入框内容
  currentTaskMessageText?: string;
  // 新增：筛选状态信息，用于显示筛选成功的提示
  hasFilters?: boolean;
  filterInfo?: {
    commentContent?: string;
    userNickname?: string;
    commentTime?: string;
    userRegion?: string;
  };
  // 新增：私信全部用户相关props
  messageAllUsers: boolean;
  onMessageAllUsersChange: (value: boolean) => void;
  // 新增：筛选后的用户ID列表，用于内容筛选后的私信
  filteredUserIds?: string[];
  // 新增：评论内容筛选关键词
  commentKeywordFilter?: string;
  // 新增：每日私信限制数量
  sendLimit?: number;
}

const DouyinAccountTable: React.FC<DouyinAccountTableProps> = ({
  douyinAccounts,
  accountsLoading,
  tasks,
  messagingAccounts,
  handleAddDouyinAccount,
  handleStartMessaging,
  handleStopMessaging,
  handleLoginDouyinAccount,
  currentTaskId,
  onAccountsUpdate,
  onlyMessageFilteredUsers,
  onOnlyMessageFilteredUsersChange,
  filteredUserRegions,
  currentTaskMessageText,
  hasFilters,
  filterInfo,
  messageAllUsers,
  onMessageAllUsersChange,
  filteredUserIds,
  commentKeywordFilter,
  sendLimit
}) => {
  const [settingsModalVisible, setSettingsModalVisible] = useState(false);
  const [privateMessageInterval, setPrivateMessageInterval] = useState(71);
  const [isUpdatingInterval, setIsUpdatingInterval] = useState(false);
  const [messageLimit, setMessageLimit] = useState(() => {
    const saved = localStorage.getItem('messageLimit');
    return saved ? parseInt(saved, 10) : 150;
  });
  const [localServiceAvailable, setLocalServiceAvailable] = useState(false);
  const [localAccounts, setLocalAccounts] = useState<DouyinAccount[]>(douyinAccounts);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date().toDateString()); // 新增：跟踪当前日期
  
  // 新增：任务私信进度状态
  const [taskMarketProgress, setTaskMarketProgress] = useState<{
    num: number;
    sum: number;
    state: number;
  }>({ num: 0, sum: 0, state: 0 });
  
  // 新增：防抖机制，避免连续刷新
  const [lastRefreshTime, setLastRefreshTime] = useState(0);
  const REFRESH_DEBOUNCE_TIME = 5000; // 5秒防抖时间，减少跳动
  
  // 新增：获取任务私信进度
  const fetchTaskMarketProgress = useCallback(async (taskId: string) => {
    if (!taskId || !localServiceAvailable) return;
    
    try {
      // 根据任务分析状态和用户选择决定isAll参数
      const currentTask = tasks.find(t => t.task_id === taskId);
      if (!currentTask) return;

      const isTaskAnalyzed = currentTask.analysis_state === 'finish';
      
      // 如果任务已分析，使用用户选择的模式；如果未分析，使用"私信全部"模式
      const isAll = isTaskAnalyzed ? messageAllUsers : true;
      
      const response = await getMarketProgressApi(taskId, isAll);
      
      if (response && response.status === 200) {
        const progressData = response.data;
        const newProgress = {
          num: progressData.num || 0,
          sum: progressData.sum || 0,
          state: progressData.state || 0
        };
        
        setTaskMarketProgress(newProgress);
      } else {
        // 设置默认值
        setTaskMarketProgress({ num: 0, sum: 0, state: 0 });
      }
    } catch (error) {
      // 设置默认值
      setTaskMarketProgress({ num: 0, sum: 0, state: 0 });
    }
  }, [tasks, messageAllUsers, localServiceAvailable]);
  
  // 防抖刷新函数 - 优化减少跳动
  const debouncedRefresh = useCallback(async () => {
    const now = Date.now();
    if (now - lastRefreshTime < REFRESH_DEBOUNCE_TIME) {
      return;
    }
    
    if (isRefreshing) {
      return;
    }
    
    setLastRefreshTime(now);
    // 延迟设置loading状态，避免频繁闪烁
    const loadingTimer = setTimeout(() => {
      setIsRefreshing(true);
    }, 100);
    
    try {
      const response = await getDouyinAccounts();
      if (response && response.status === 200 && response.data && response.data.accounts) {
        const accountsData = response.data.accounts;
        const updatedAccounts = accountsData.map((account: any) => ({
          user_id: account.user_id || account.id,
          account: account.username || account.account || account.nickname || '未知账号',
          task_id: account.task_id || currentTaskId,
          state: account.state || account.status || 0,
          currentTask: account.current_task || account.task_name || '',
          nickname: account.username || account.nickname || account.account || '',
          avatar: account.avatar || '',
          is_logged_in: account.state === 1 || account.is_logged_in || false,
          marketing_count: account.marketing_count || 0,
          update_timestamp: account.update_timestamp || 0
        }));
        
        // 深度比较数据变化，只有真正变化时才更新状态
        const currentAccountsString = JSON.stringify(localAccounts.map((acc: DouyinAccount) => ({
          user_id: acc.user_id,
          state: acc.state,
          marketing_count: acc.marketing_count,
          update_timestamp: acc.update_timestamp
        })));
        
        const newAccountsString = JSON.stringify(updatedAccounts.map((acc: any) => ({
          user_id: acc.user_id,
          state: acc.state,
          marketing_count: acc.marketing_count,
          update_timestamp: acc.update_timestamp
        })));
        
        // 只有数据真正变化时才更新状态
        if (currentAccountsString !== newAccountsString) {
          setLocalAccounts(updatedAccounts);
          if (onAccountsUpdate) {
            onAccountsUpdate(updatedAccounts);
          }
          
          // 检查是否有账号状态变化，如果有则触发进度更新事件
          const hasStateChange = updatedAccounts.some((newAccount: any) => {
            const oldAccount = localAccounts.find(old => old.user_id === newAccount.user_id);
            return oldAccount && (
              oldAccount.state !== newAccount.state ||
              oldAccount.marketing_count !== newAccount.marketing_count
            );
          });
          
          // 如果有状态变化且当前任务ID存在，触发进度更新事件
          if (hasStateChange && currentTaskId) {
            // 触发私信进度更新事件
            const progressEvent = new CustomEvent('privateMessageProgress', {
              detail: {
                taskId: currentTaskId,
                timestamp: Date.now(),
                source: 'accountStateChange'
              }
            });
            window.dispatchEvent(progressEvent);
          }
        }
      }
    } catch (error) {
      // 静默处理错误
    } finally {
      clearTimeout(loadingTimer);
      setIsRefreshing(false);
    }
  }, [lastRefreshTime, isRefreshing, currentTaskId, onAccountsUpdate, localAccounts]);
  
  // 新增：倒计时状态管理
  const [countdownStates, setCountdownStates] = useState<{[userId: string]: {startTime: number, duration: number, remaining: number}}>({});
  
  // 当外部accounts更新时，同步本地状态 - 修复循环依赖
  useEffect(() => {
    if (douyinAccounts && Array.isArray(douyinAccounts)) {
      // 确保数据格式一致
      const normalizedAccounts = douyinAccounts.map((account: any) => ({
        user_id: account.user_id || account.id,
        account: account.username || account.account || account.nickname || '未知账号',
        task_id: account.task_id || currentTaskId,
        state: account.state || account.status || 0,
        currentTask: account.current_task || account.task_name || '',
        nickname: account.username || account.nickname || account.account || '',
        avatar: account.avatar || '',
        is_logged_in: account.state === 1 || account.is_logged_in || false,
        marketing_count: account.marketing_count || 0,
        update_timestamp: account.update_timestamp || 0
      }));
      
      // 只有当数据真正发生变化时才更新，避免无限循环
      const currentAccountsString = JSON.stringify(localAccounts);
      const newAccountsString = JSON.stringify(normalizedAccounts);
      
      if (currentAccountsString !== newAccountsString) {
        setLocalAccounts(normalizedAccounts);
      }
    } else {
      setLocalAccounts([]);
    }
  }, [douyinAccounts, currentTaskId]); // 移除localAccounts依赖，避免循环

  // 统一的自动刷新逻辑
  useEffect(() => {
    if (!currentTaskId || !localServiceAvailable) return;

    // 立即执行一次初始刷新
    debouncedRefresh();
    fetchTaskMarketProgress(currentTaskId);

    // 创建统一的定时器，每45秒执行一次刷新
    const refreshInterval = setInterval(() => {
      const hasActiveMessaging = localAccounts.some(account => 
        account.state === 2 && account.task_id === currentTaskId
      );

      // 只在有活跃私信任务或强制刷新时执行
      if (hasActiveMessaging) {
        debouncedRefresh();
        fetchTaskMarketProgress(currentTaskId);
      }
    }, 45000); // 45秒刷新一次，平衡实时性和性能

    // 清理定时器
    return () => {
      clearInterval(refreshInterval);
    };
  }, [currentTaskId, localServiceAvailable, localAccounts, debouncedRefresh, fetchTaskMarketProgress]);

  // 检测状态异常并启动55分钟倒计时 - 只添加计时器，不刷新页面
  useEffect(() => {
    const checkAndStartCountdown = () => {
      const now = Date.now();
      setCountdownStates(prevCountdownStates => {
        const newCountdownStates = { ...prevCountdownStates };
        let hasChanges = false;

        localAccounts.forEach(account => {
          const state = account.state;
          const userId = account.user_id;
          
          // 检查是否为异常状态（不是0、1、2、'not_logged_in'、null、undefined）
          const isAbnormalState = state !== 0 && state !== 1 && state !== 2 && 
                                 state !== 'not_logged_in' && 
                                 state !== null && state !== undefined;
          
          // 如果状态异常且没有倒计时，启动55分钟倒计时
          if (isAbnormalState && !prevCountdownStates[userId]) {
            newCountdownStates[userId] = {
              startTime: now,
              duration: 55 * 60 * 1000, // 55分钟，单位毫秒
              remaining: 55 * 60 * 1000
            };
            hasChanges = true;
          }
          
          // 如果状态恢复正常且还有倒计时，清除倒计时
          if (!isAbnormalState && prevCountdownStates[userId]) {
            delete newCountdownStates[userId];
            hasChanges = true;
          }
        });

        return hasChanges ? newCountdownStates : prevCountdownStates;
      });
    };

    // 统一的状态检查定时器
    const statusCheckInterval = setInterval(() => {
      // 检查并启动倒计时
      checkAndStartCountdown();
      
      // 检查账号状态异常
      const abnormalAccounts = localAccounts.filter(account => {
        const state = account.state;
        return state !== 0 && state !== 1 && state !== 2 && 
               state !== 'not_logged_in' && 
               state !== null && state !== undefined;
      });
      
      if (abnormalAccounts.length > 0) {
        console.log('检测到异常状态账号:', abnormalAccounts.length);
      }
      
      // 检查日期变化
      const now = new Date();
      const today = now.toDateString();
      if (today !== currentDate) {
        setCurrentDate(today);
        if (localServiceAvailable) {
          setTimeout(() => {
            debouncedRefresh();
          }, 3000);
        }
      }
    }, 45000); // 每45秒检查一次所有状态
    
    // 立即执行一次检查
    checkAndStartCountdown();
    
    return () => clearInterval(statusCheckInterval);
  }, [localAccounts, currentDate, localServiceAvailable, debouncedRefresh]); // 添加必要的依赖

  // 处理开始私信
  const handleStartMessagingLocal = useCallback(async (record: DouyinAccount) => {
    if (!currentTaskId) {
      Message.error('请先选择任务');
      return;
    }

    // 检查私信数量限制
    const marketingCount = record.marketing_count || 0;
    if (marketingCount >= messageLimit) {
      Message.warning(`账号 ${record.account} 今日私信数量已达上限(${marketingCount}/${messageLimit})，无法开始私信`);
      return;
    }

    // 检查本地私信服务是否可用
    if (!localServiceAvailable) {
      setDrawerVisible(true);
      return;
    }

    try {
      // 使用传入的当前任务输入框内容，如果没有则使用默认内容
      const currentTask = tasks.find(t => t.task_id === currentTaskId);
      const messageText = currentTaskMessageText || (currentTask?.keyword ? `有${currentTask.keyword}需求吗？` : '有短视频代剪辑需求吗？');
      
      // 构建筛选参数 - 优先使用内容筛选，其次使用地区筛选
      let ipLocation = '';
      let targetUserIds: string[] | undefined;
      console.log('筛选参数调试:', {
        onlyMessageFilteredUsers,
        filteredUserIds: filteredUserIds?.length || 0,
        filteredUserRegions: filteredUserRegions.length,
        filteredUserRegionsList: filteredUserRegions
      });
      
      if (onlyMessageFilteredUsers) {
        // 如果有内容筛选的用户ID列表，使用内容筛选
        if (filteredUserIds && filteredUserIds.length > 0) {
          targetUserIds = filteredUserIds;
          console.log('使用内容筛选，用户ID数量:', filteredUserIds.length);
        }
        
        // 同时检查地区筛选，允许两种筛选同时进行
        if (filteredUserRegions.length > 0) {
          ipLocation = filteredUserRegions.join(',');
          console.log('同时使用地区筛选，地区:', ipLocation);
        }
      } else {
        // 如果onlyMessageFilteredUsers为false，但用户选择了地区筛选，也应该传递地区信息
        if (filteredUserRegions.length > 0) {
          ipLocation = filteredUserRegions.join(',');
          console.log('非筛选模式但使用地区筛选，地区:', ipLocation);
        }
      }
      
      const startParams: StartMarketingParams = {
        task_id: currentTaskId,
        user_id: record.user_id,
        message_text: messageText,
        ip_location: ipLocation || '', // 确保ip_location字段总是存在，空字符串而不是undefined
        target_user_ids: targetUserIds, // 新增：传递筛选后的用户ID列表
        is_all: messageAllUsers ? 1 : 0, // 添加私信全部用户参数：0表示少选，1表示选择全部
        comment_keyword_filter: commentKeywordFilter, // 新增：评论内容筛选关键词
        send_limit: sendLimit || 150 // 新增：每日私信限制数量，默认150
      };
      
      // 添加最终请求参数的调试信息
      console.log('最终请求参数:', startParams);
      
      const response = await postStartMarketByTaskIdApi('dy', startParams);
      
      if (response && response.success !== false) {
        Message.success('私信已启动');
        
        // 先调用父组件的开始私信函数，立即更新本地状态
        handleStartMessaging(record);
        
        // 启动成功后刷新账号列表
        debouncedRefresh();
      } else {
        Message.error(`启动私信失败: ${response?.message || '未知错误'}`);
      }
    } catch (error) {
      Message.error('启动私信失败');
    }
  }, [currentTaskId, tasks, onlyMessageFilteredUsers, filteredUserRegions, filteredUserIds, localServiceAvailable, handleStartMessaging, messageAllUsers, commentKeywordFilter, messageLimit]); // 添加filteredUserIds、commentKeywordFilter和messageLimit依赖

  // 倒计时更新逻辑 - 只更新显示，不刷新页面，优化减少跳动
  useEffect(() => {
    const updateCountdowns = () => {
      const now = Date.now();
      setCountdownStates(prevCountdownStates => {
        const newCountdownStates = { ...prevCountdownStates };
        let hasChanges = false;

        Object.keys(newCountdownStates).forEach(userId => {
          const countdown = newCountdownStates[userId];
          const elapsed = now - countdown.startTime;
          const remaining = Math.max(0, countdown.duration - elapsed);
          
          // 只有当剩余时间变化超过30秒时才更新，进一步减少频繁渲染
          if (Math.abs(remaining - countdown.remaining) >= 30000) {
            newCountdownStates[userId] = {
              ...countdown,
              remaining
            };
            hasChanges = true;
          }
          
          // 如果倒计时结束，清除状态并自动开始私信
          if (remaining <= 0) {
            delete newCountdownStates[userId];
            hasChanges = true;
            
            // 自动开始私信
            const account = localAccounts.find(acc => acc.user_id === userId);
            if (account && account.state === 1) {
              console.log(`🔄 倒计时结束，自动开始私信: 账号 ${account.account}`);
              // 延迟1秒执行，确保状态更新完成
              setTimeout(() => {
                handleStartMessagingLocal(account);
              }, 1000);
            }
          }
        });

        return hasChanges ? newCountdownStates : prevCountdownStates;
      });
    };

    // 每45秒更新倒计时显示
    const interval = setInterval(updateCountdowns, 45000);
    
    return () => clearInterval(interval);
  }, [localAccounts, handleStartMessagingLocal]); // 添加必要的依赖

  // 新增：格式化倒计时显示 - 使用useCallback避免重复创建
  const formatCountdown = useCallback((remaining: number) => {
    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }, []);

  // 新增：倒计时显示组件 - 使用useMemo避免重复渲染
  const CountdownDisplay = useMemo(() => {
    return React.memo(({ countdown }: { countdown: { remaining: number } }) => (
      <div style={{ textAlign: 'center' }}>
        <span style={{ color: '#ff4d4f', fontSize: '12px', display: 'block' }}>
          暂停私信
        </span>
        <span style={{ color: '#1890ff', fontSize: '14px', fontWeight: 'bold', display: 'block' }}>
          {formatCountdown(countdown.remaining)}
        </span>
        <span style={{ color: '#666', fontSize: '10px', display: 'block' }}>
          倒计时结束后可继续私信
        </span>
      </div>
    ));
  }, [formatCountdown]);



  // 处理Drawer关闭
  const handleDrawerClose = () => {
    setDrawerVisible(false);
  };



  // 检查本地服务可用性
  useEffect(() => {
    const checkService = async () => {
      try {
        const isAvailable = await checkLocalServiceAvailability();
        setLocalServiceAvailable(isAvailable);
        if (!isAvailable) {
          // 本地私信服务不可用
        }
      } catch (error) {
        setLocalServiceAvailable(false);
      }
    };
    checkService();
  }, []);

  // 获取私信间隔设置
  useEffect(() => {
    const fetchTimeGap = async () => {
      try {
        const response = await getSimpleTimeGap();
        if (response && typeof response === 'object' && response.time_gap !== undefined) {
          setPrivateMessageInterval(response.time_gap);
        }
              } catch (error) {
          // 静默处理错误
        }
    };
    fetchTimeGap();
  }, []);

  // 组件挂载时自动刷新账号数据
  useEffect(() => {
    if (localServiceAvailable) {
      // 使用防抖机制进行初始刷新
      debouncedRefresh();
    }
  }, [localServiceAvailable, debouncedRefresh]);

  // 优化：使用useCallback缓存事件处理函数
  const handleSettingsClick = useCallback(() => {
    setSettingsModalVisible(true);
  }, []);
  
  const handleModalCancel = useCallback(() => {
    setSettingsModalVisible(false);
  }, []);
  
  const handleModalConfirm = useCallback(async () => {
    setIsUpdatingInterval(true);
    try {
      await setSimpleTimeGap(privateMessageInterval);
      // 保存私信数量限制到localStorage
      localStorage.setItem('messageLimit', messageLimit.toString());
      
      // 设置完成后，重新获取服务器的最新间隔时间
      try {
        const response = await getSimpleTimeGap();
        if (response && typeof response === 'object' && response.time_gap !== undefined) {
          setPrivateMessageInterval(response.time_gap);
          console.log('✅ 间隔时间已同步更新为:', response.time_gap);
        }
      } catch (fetchError) {
        console.warn('重新获取间隔时间失败:', fetchError);
      }
      
      Message.success('设置已保存');
      setSettingsModalVisible(false);
          } catch (error) {
        Message.error('保存设置失败');
      } finally {
      setIsUpdatingInterval(false);
    }
  }, [privateMessageInterval, messageLimit]);
  
  const handleIntervalDecrease = useCallback(() => {
    setPrivateMessageInterval(prev => Math.max(0, prev - 1));
  }, []);
  
  const handleIntervalIncrease = useCallback(() => {
    setPrivateMessageInterval(prev => Math.min(300, prev + 1));
  }, []);

  // 私信数量限制处理函数
  const handleLimitDecrease = useCallback(() => {
    setMessageLimit(prev => Math.max(50, prev - 1));
  }, []);
  
  const handleLimitIncrease = useCallback(() => {
    setMessageLimit(prev => Math.min(150, prev + 1));
  }, []);

  // 下载安装程序（优先尝试EXE，失败则回退到ZIP）
  const handleDownloadInstaller = useCallback(async () => {
    const zipUrl = 'https://iry-1256349444.cos.ap-guangzhou.myqcloud.com/%E6%8A%96%E9%9F%B3%E7%A7%81%E4%BF%A1%E6%8F%92%E4%BB%B6.zip';
    // 尝试将ZIP地址替换为EXE地址
    const exeUrl = zipUrl.replace('.zip', '.exe');

    try {
      const response = await fetch(exeUrl, { method: 'GET', credentials: 'omit' });
      if (!response.ok) {
        throw new Error('EXE not available');
      }
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = '抖音私信插件安装包.exe';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      // 若EXE不可用或CORS限制，回退到直接打开ZIP链接
      window.open(zipUrl, '_blank');
    }
  }, []);

  // 删除未使用的refreshAccounts函数，避免循环依赖和持续刷新问题

  // 监听日期变化，每天凌晨十二点重置上限 - 优化减少闪动
  useEffect(() => {
    const checkDateChange = () => {
      const now = new Date();
      const today = now.toDateString();
      
      // 如果日期发生变化，说明已经过了凌晨十二点
      if (today !== currentDate) {
        setCurrentDate(today);
        
        // 日期变化时刷新账号数据
        if (localServiceAvailable) {
          debouncedRefresh();
        }
      }
    };

    // 每45秒检查一次日期变化
    const interval = setInterval(checkDateChange, 45000);
    
    // 立即检查一次
    checkDateChange();
    
    return () => clearInterval(interval);
  }, [currentDate, localServiceAvailable, debouncedRefresh]); // 添加必要的依赖

  // 处理停止私信
  const handleStopMessagingLocal = useCallback(async (record: DouyinAccount) => {
    if (!currentTaskId) {
      Message.error('请先选择任务');
      return;
    }

    try {
      const stopParams: StopMarketingParams = {
        task_id: currentTaskId,
        user_id: record.user_id
      };
      
      // 先调用父组件的停止私信函数，立即更新本地状态
      handleStopMessaging(record);
      
      // 调用停止私信API
      const response = await postStopMarketByTaskIdApi('dy', stopParams);
      
      if (response && response.success !== false) {
        Message.success(`账号 ${record.account} 私信已停止`);
        
        // 停止成功后刷新账号列表
        debouncedRefresh();
      } else {
        Message.error(`停止私信失败: ${response?.message || '未知错误'}`);
        
        // 如果API失败，显示警告信息
        Message.warning('API调用失败，但本地状态已更新，请检查私信服务状态');
      }
    } catch (error) {
      Message.error(`停止私信失败: ${error instanceof Error ? error.message : '网络错误'}`);
      
      // 如果发生异常，显示警告信息
      Message.warning('网络异常，但本地状态已更新，请检查私信服务状态');
    }
  }, [currentTaskId, handleStopMessaging]); // 移除debouncedRefresh依赖，避免循环

  // 监控私信数量，超过限制时自动停止私信 - 优化减少闪动
  useEffect(() => {
    const checkMarketingLimit = async () => {
      // 检查所有正在私信中的账号
      for (const account of localAccounts) {
        const marketingCount = account.marketing_count || 0;
        
        // 如果正在私信中且私信数量超过限制，自动停止
        if (messagingAccounts.has(account.user_id) && marketingCount >= messageLimit) {
          try {
            // 自动停止私信
            await handleStopMessagingLocal(account);
            
            // 显示提示信息
            Message.warning(`账号 ${account.account} 私信数量已达上限(${marketingCount}/${messageLimit})，已自动停止私信`);
          } catch (error) {
            Message.error(`自动停止账号 ${account.account} 私信失败`);
          }
        }
      }
    };

    // 每45秒检查一次私信数量限制
    const interval = setInterval(checkMarketingLimit, 45000);
    
    // 立即检查一次
    checkMarketingLimit();
    
    return () => clearInterval(interval);
  }, [localAccounts, messagingAccounts, messageLimit, handleStopMessagingLocal]); // 添加必要的依赖

  // 新增：当用户调高限制后，自动检查并恢复被限制的账号私信
  useEffect(() => {
    const checkAndResumeMessaging = async () => {
      // 检查所有账号，看是否有因为限制被停止但实际可以继续私信的账号
      for (const account of localAccounts) {
        const marketingCount = account.marketing_count || 0;
        
        // 如果账号当前私信数量小于新限制，且之前可能因为限制被停止
        if (marketingCount < messageLimit && !messagingAccounts.has(account.user_id)) {
          // 检查账号状态是否正常（已登录且状态为1）
          if (account.state === 1 && account.is_logged_in) {
            // 这里可以添加自动恢复逻辑，但为了安全起见，我们只显示提示
            console.log(`账号 ${account.account} 可以继续私信 (${marketingCount}/${messageLimit})`);
          }
        }
      }
    };

    // 当messageLimit变化时检查
    checkAndResumeMessaging();
  }, [messageLimit, localAccounts, messagingAccounts]);

  // 检查是否有异常状态的账号
  const abnormalAccounts = useMemo(() => {
    return localAccounts.filter(account => {
      const state = account.state;
      return state !== 0 && state !== 1 && state !== 2 && 
             state !== 'not_logged_in' && 
             state !== null && state !== undefined;
    });
  }, [localAccounts]);

  // 当检测到异常状态时，记录日志
  useEffect(() => {
    if (abnormalAccounts.length > 0) {
      console.log('检测到异常状态账号:', abnormalAccounts.length);
    }
  }, [abnormalAccounts.length]);

  // 优化：使用useMemo缓存columns定义，避免每次渲染都重新创建
  const columns = useMemo(() => [
    {
      title: (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: '32px', width: '100%' }}>
          <span>抖音账号</span>
          <div style={{ display: 'flex', gap: '8px', flexDirection: 'column', alignItems: 'flex-start' }}>
            <label style={{ display: 'flex', alignItems: 'center', fontSize: '14px', fontWeight: 'normal' }}>
              <input 
                type="checkbox" 
                checked={onlyMessageFilteredUsers}
                onChange={(e) => {
                  const checked = e.target.checked;
                  if (checked && messageAllUsers) {
                    // 如果选中"只私信筛选用户"，先取消"私信全部用户"
                    onMessageAllUsersChange(false);
                  }
                  onOnlyMessageFilteredUsersChange(checked);
                }}
                style={{ marginRight: '4px' }} 
              />
              只私信筛选用户
            </label>
            <label style={{ display: 'flex', alignItems: 'center', fontSize: '14px', fontWeight: 'normal' }}>
              <input 
                type="checkbox" 
                checked={messageAllUsers}
                onChange={(e) => {
                  const checked = e.target.checked;
                  if (checked && onlyMessageFilteredUsers) {
                    // 如果选中"私信全部用户"，先取消"只私信筛选用户"
                    onOnlyMessageFilteredUsersChange(false);
                  }
                  onMessageAllUsersChange(checked);
                }}
                style={{ marginRight: '4px' }} 
              />
              私信全部用户
            </label>
          </div>
        </div>
      ),
      dataIndex: 'account',
      key: 'account',
      render: (text: string, record: DouyinAccount) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {record.avatar && (
            <img 
              src={record.avatar} 
              alt="头像" 
              style={{ width: '24px', height: '24px', borderRadius: '50%' }}
            />
          )}
          <span>{text}</span>
          {record.nickname && record.nickname !== text && (
            <span style={{ color: '#999', fontSize: '12px' }}>({record.nickname})</span>
          )}
        </div>
      )
    },
    {
      title: '当前私信任务',
      dataIndex: 'currentTask',
      key: 'currentTask',
      render: (_: any, record: DouyinAccount) => {
        // 如果选择了"只私信筛选用户"，则显示筛选后的任务信息
        if (onlyMessageFilteredUsers && (filteredUserRegions.length > 0 || hasFilters || (filteredUserIds && filteredUserIds.length > 0))) {
          // 根据筛选的条件显示对应的任务信息
          const currentTask = tasks.find(t => t.task_id === currentTaskId);
          if (currentTask) {
            // 构建筛选信息提示
            let filterTips = [];
            
            // 优先显示内容筛选信息
            if (filteredUserIds && filteredUserIds.length > 0) {
              filterTips.push(`内容筛选用户(${filteredUserIds.length}人)`);
            }
            
            if (filteredUserRegions.length > 0) {
              filterTips.push(`${filteredUserRegions.join(', ')} 地区用户`);
            }
            
            if (filterInfo?.commentContent) {
              filterTips.push(`评论内容包含"${filterInfo.commentContent}"`);
            }
            
            if (filterInfo?.userNickname) {
              filterTips.push(`用户昵称包含"${filterInfo.userNickname}"`);
            }
            
            if (filterInfo?.commentTime) {
              filterTips.push(`评论时间包含"${filterInfo.commentTime}"`);
            }
            
            const filterDisplay = filterTips.length > 0 ? filterTips.join(' + ') : '筛选用户';
            
            return (
              <div>
                <div style={{ fontWeight: 'bold', color: '#1890ff' }}>
                  {currentTask.keyword}
                </div>
                <div style={{ fontSize: '12px', color: '#52c41a', marginTop: '2px', fontWeight: '500' }}>
                筛选成功: {filterDisplay}
                </div>
                <div style={{ fontSize: '11px', color: '#666', marginTop: '2px' }}>
                  此账号将只私信筛选后的用户
                </div>
              </div>
            );
          }
        }
        
        // 如果record中有task_id，直接从tasks数组中查找对应的任务标题
        if (record.task_id) {
          const task = tasks.find(t => t.task_id === record.task_id);
          if (task) {
            // 显示任务关键词，如果有意向数量也显示
            if (typeof task.intent_count === 'number') {
              return `${task.keyword} (${task.intent_count}个意向)`;
            }
            return task.keyword;
          }
          // 如果找不到任务，显示任务ID
          return record.task_id;
        }
        return record.currentTask || '无';
      }
    },
    {
      title: (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>私信数量</span>
          <button
            onClick={handleSettingsClick}
            style={{
              padding: '4px 15px',
              background: '#1890ff',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            设置
          </button>
        </div>
      ),
      dataIndex: 'marketing_count',
      key: 'marketing_count',
      render: (value: number) => {
        // 如果正在加载或数据无效，显示加载状态
        if (typeof value !== 'number') {
          return <span style={{ color: '#999' }}>0/{messageLimit}</span>;
        }
        
        // 显示格式：已发送数量/每天上限
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {/* 账号级别的私信数量 */}
            <span style={{ 
              color: value >= messageLimit ? '#ff4d4f' : '#1890ff',
              fontWeight: '500',
              fontSize: '14px'
            }}>
              账号: {value}/{messageLimit}
            </span>
            

          </div>
        );
      }
    },
    {
      title: (
        <span>
          当前私信间隔 <span style={{ color: '#1890ff', fontWeight: 'bold' }}>{privateMessageInterval}</span> 秒
        </span>
      ),
      dataIndex: 'interval',
      key: 'interval'
    },
    {
      title: (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span>执行操作</span>
          <button
            onClick={async () => {
              if (!localServiceAvailable) {
                // 直接显示弹窗提示
                setDrawerVisible(true);
              } else {
                handleAddDouyinAccount();
              }
            }}
            disabled={accountsLoading || isRefreshing}
            style={{
              padding: '4px 15px',
              background: (accountsLoading || isRefreshing) ? '#ccc' : '#1890ff',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: (accountsLoading || isRefreshing) ? 'not-allowed' : 'pointer',
              fontSize: '14px'
            }}
          >
            {accountsLoading ? '获取中...' : isRefreshing ? '刷新中...' : '新增抖音账号'}
          </button>
        </div>
      ),
      dataIndex: 'action',
      key: 'action',
      render: (_: any, record: DouyinAccount) => {
        const isMessaging = messagingAccounts.has(record.user_id);
        const state = record.state;
        const marketingCount = record.marketing_count || 0;
        const isOverLimit = marketingCount >= messageLimit; // 检查是否超过每天上限
        
        // 移除调试日志，避免重复输出
        
        return (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            {/* 私信操作按钮 */}
            {isMessaging ? (
                  <button
                    onClick={() => handleStopMessagingLocal(record)}
                    style={{
                      padding: '4px 15px',
                      background: 'orange',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '14px'
                    }}
                  >
                    停止私信
                  </button>
                ) : state === 1 ? (
                  <button
                    onClick={() => handleStartMessagingLocal(record)}
                    disabled={isOverLimit}
                    style={{
                      padding: '4px 15px',
                      background: isOverLimit ? '#ccc' : '#3491fa',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: isOverLimit ? 'not-allowed' : 'pointer',
                      fontSize: '14px',
                      opacity: isOverLimit ? 0.6 : 1
                    }}
                    title={isOverLimit ? `今日私信数量已达上限(${messageLimit}个)，请等待凌晨12点重置` : '开始私信'}
                  >
                    {isOverLimit ? '已达上限' : '开始私信'}
                  </button>
                ) : state === 2 ? (
                  <button
                    onClick={() => handleStopMessagingLocal(record)}
                    style={{
                      padding: '4px 15px',
                      background: 'orange',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '14px'
                    }}
                  >
                    停止私信
                  </button>
                ) : (state === 0 || state === 'not_logged_in' || state === null || state === undefined) ? (
                  <button
                    onClick={() => handleLoginDouyinAccount(record)}
                    style={{
                      padding: '4px 15px',
                      background: '#1890ff',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '14px'
                    }}
                  >
                    登录抖音账号
                  </button>
                ) : (
                  // 处理所有异常状态（包括3和其他未知状态），统一显示暂停私信和倒计时
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                    {countdownStates[record.user_id] ? (
                      // 使用优化的倒计时显示组件，避免重复渲染
                      <CountdownDisplay countdown={countdownStates[record.user_id]} />
                    ) : (
                      // 倒计时结束后显示停止私信按钮
                      <button
                        onClick={() => handleStopMessagingLocal(record)}
                        style={{
                          padding: '4px 15px',
                          background: 'orange',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '14px'
                        }}
                      >
                        停止私信
                      </button>
                    )}
                  </div>
                )}
          </div>
        );
      }
    }
  ], [tasks, messagingAccounts, accountsLoading, isRefreshing, privateMessageInterval, messageLimit, handleAddDouyinAccount, handleStartMessaging, handleStopMessaging, handleSettingsClick, handleStartMessagingLocal, handleStopMessagingLocal, handleLoginDouyinAccount, countdownStates, formatCountdown, CountdownDisplay, currentTaskId, taskMarketProgress]);

  return (
    <>
      <div style={{ background: '#fff' }}>
        {/* 顶部标题区域 */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: '16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {!localServiceAvailable && (
              <Tag color="orange" icon={<IconSettings />}>
                本地私信服务不可用，请检查是否安装并运行插件
              </Tag>
            )}
            {/* 移除异常状态提示，避免用户困惑 */}
          </div>
        </div>
        

        <Table
          columns={columns}
          data={localAccounts}
          pagination={false}
          loading={accountsLoading}
          style={{ fontSize: '14px' }}
          rowKey="user_id"
        />
      </div>
      
      {/* 私信间隔设置弹窗 - 只在本地服务可用时显示 */}
      {localServiceAvailable && (
        <Modal
          title={<span style={{ fontWeight: 'bold', textAlign: 'left' }}>私信间隔设置</span>}
          visible={settingsModalVisible}
          onCancel={handleModalCancel}
          footer={[
            <Button key="cancel" onClick={handleModalCancel}>
              取消
            </Button>,
            <Button
              key="confirm"
              type="primary"
              onClick={handleModalConfirm}
              loading={isUpdatingInterval}
            >
              确认
            </Button>
          ]}
          style={{ width: 500 }}
        >
          <div style={{ padding: '10px 0' }}>
            <div style={{ marginBottom: 10, textAlign: 'left' }}>
              <span style={{ fontSize: 16, marginBottom: 10, display: 'block' }}>
                请设置私信间隔时间（0-300秒）：
              </span>
              <span style={{ fontSize: 14, color: '#666', display: 'block', marginBottom: 10 }}>
                当前间隔：<span style={{ color: '#1890ff', fontWeight: 'bold' }}>{privateMessageInterval}</span> 秒
              </span>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <Slider
                value={privateMessageInterval}
                onChange={(val: number | number[]) => {
                  if (typeof val === 'number') {
                    setPrivateMessageInterval(val);
                  }
                }}
                min={0}
                max={300}
                style={{ flex: 1 }}
              />
              <Button
                onClick={handleIntervalDecrease}
                style={{ width: 40, height: 40 }}
              >
                -
              </Button>
              <InputNumber
                value={privateMessageInterval}
                onChange={setPrivateMessageInterval}
                min={0}
                max={300}
                style={{ width: 50, textAlign: 'center', height: 40 }}
              />
              <Button
                onClick={handleIntervalIncrease}
                style={{ width: 40, height: 40 }}
              >
                +
              </Button>
            </div>

            <div style={{ marginBottom: 10, textAlign: 'left', marginTop: 20 }}>
              <span style={{ fontSize: 16, marginBottom: 10, display: 'block' }}>
                请设置每日私信数量限制（50-150个）：
              </span>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <Slider
                value={messageLimit}
                onChange={(val: number | number[]) => {
                  if (typeof val === 'number') {
                    setMessageLimit(val);
                  }
                }}
                min={50}
                max={150}
                style={{ flex: 1 }}
              />
              <Button
                onClick={handleLimitDecrease}
                style={{ width: 40, height: 40 }}
              >
                -
              </Button>
              <InputNumber
                value={messageLimit}
                onChange={setMessageLimit}
                min={50}
                max={150}
                style={{ width: 50, textAlign: 'center', height: 40 }}
              />
              <Button
                onClick={handleLimitIncrease}
                style={{ width: 40, height: 40 }}
              >
                +
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* 本地私信服务提示Drawer */}
      <Drawer
        title="友情提示"
        visible={drawerVisible}
        placement="right"
        width={500}
        onCancel={handleDrawerClose}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <Button type="default" size="default" onClick={handleDrawerClose}>
              取消
            </Button>
            <Button type="primary" size="default" onClick={handleDrawerClose}>
              我已下载并运行
            </Button>
          </div>
        }
      >
        <Space direction="vertical" align="center" style={{ width: '100%' }}>
          <div style={{ width: '100%', textAlign: 'center', fontSize: '16px' }}>
            <p>抖音私信需要Windows10及以上电脑环境</p>
            <p>8GB以上内存并安装和运行自动私信程序</p>
            <p>（如已下载请运行）</p>
          </div>
          <div style={{ width: '100%', display: 'flex', justifyContent: 'center', marginTop: '15px' }}>
            <Button type="primary" size="default"
              onClick={handleDownloadInstaller}>
              下载程序
            </Button>
          </div>
        </Space>
      </Drawer>
    </>
  );
};

// 使用React.memo优化组件，避免不必要的重渲染
export default React.memo(DouyinAccountTable);
