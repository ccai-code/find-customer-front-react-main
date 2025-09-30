import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Layout, Progress, Pagination } from '@arco-design/web-react';
import { useLocation } from 'react-router-dom';
import { TaskSidebar } from '../hooks';
import { getAnalysisProgressApi } from '../api/api';
import { useTaskList } from '../hooks/useTaskList';
import { getCommentListByTaskIdApi } from '../api/api';
import { 
  AnalysisHeader,
  SummaryCards,
  CommentTable,
  debounce
} from '../components';
import type { Comment, Filters } from '../components';


interface CommentAnalysisProps {
  taskId?: string;
}

// 在组件顶部添加导入
import useGlobalTaskState from '../hooks/useGlobalTaskState';

const CommentAnalysis: React.FC<CommentAnalysisProps> = ({ taskId }) => {
  const location = useLocation();
  
  // 使用 useRef 来存储渲染计数，避免无限循环
  const renderCountRef = useRef(0);
  
  // 添加调试日志，但限制打印次数
  useEffect(() => {
    if (renderCountRef.current < 3) { // 只打印前3次渲染
      console.log('🔄 CommentAnalysis组件渲染:', { 
        taskId, 
        pathname: location.pathname,
        timestamp: new Date().toISOString(),
        renderCount: renderCountRef.current + 1
      });
      renderCountRef.current += 1;
    }
  }, [taskId, location.pathname]);
  
  // 使用统一的任务列表Hook
  const {
    tasks,
    loading: taskLoading,
    hasMoreTasks,
    isLoadingMore,
    selectedTaskId,
    selectTask,
    loadMoreTasks,
  } = useTaskList({
    pageType: 'analysis',
    initialSelectedTaskId: null,
    onTaskSelect: useCallback((taskId: string) => {
      localStorage.setItem('analysis_selectedTaskId', taskId);
      localStorage.setItem('privateMessage_selectedTaskId', taskId);
    }, [])
  });
  
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);
  
  // 服务介绍和客户需求状态
  const [serviceIntro, setServiceIntro] = useState('');
  const [targetCustomer, setTargetCustomer] = useState('');
  
  // 跟踪用户是否已经手动选择了任务
  const [userHasManuallySelectedTask, setUserHasManuallySelectedTask] = useState(false);
  
  // 进度条状态
  const [analysisProgress, setAnalysisProgress] = useState(0);
  // const [progressLoading, setProgressLoading] = useState(false);
  const [progressData, setProgressData] = useState<{
    num: number;
    sum: number;
    state: number;
    ic_num: number;
  } | null>(null);
  

  
  // 添加请求状态管理，避免重复请求
  const requestRef = useRef<{ [key: string]: boolean }>({});
  
  // 获取当前选中任务的平台信息
  const currentTask = useMemo(() => {
    const task = tasks.find(task => task.task_id === selectedTaskId);
    return task;
  }, [tasks, selectedTaskId]);

  // 处理从私信页面返回时的任务选择状态 - 优化逻辑，不阻止用户选择其他任务
  useEffect(() => {
    if (location.state?.selectedTaskId && tasks.length > 0 && !taskLoading) {
      const targetTaskId = location.state.selectedTaskId;
      const taskExists = tasks.find(task => task.task_id === targetTaskId);
      
      // 如果用户已经手动选择了任务，则跳过自动选择
      if (userHasManuallySelectedTask) {
        // 仍然清除路由状态
        setTimeout(() => {
          window.history.replaceState({}, document.title);
        }, 100);
        return;
      }
      
      // 只在没有选中任务时才自动选择，避免覆盖用户的选择
      if (taskExists && !selectedTaskId) {
        selectTask(targetTaskId);
        // 同步localStorage
        localStorage.setItem('analysis_selectedTaskId', targetTaskId);
        localStorage.setItem('privateMessage_selectedTaskId', targetTaskId);
        
        // 延迟清除路由状态，确保任务选择完成后再清除
        setTimeout(() => {
          window.history.replaceState({}, document.title);
        }, 100);
      } else {
        // 清除路由状态
        setTimeout(() => {
          window.history.replaceState({}, document.title);
        }, 100);
      }
    }
  }, [location.state?.selectedTaskId, tasks, selectedTaskId, selectTask, taskLoading, userHasManuallySelectedTask]);

  // 处理传入的taskId参数，自动选择对应的任务
  useEffect(() => {
    if (taskId && tasks.length > 0 && !taskLoading) {
      const targetTask = tasks.find(task => task.task_id === taskId);
      
      // 如果用户已经手动选择了任务，则跳过URL参数自动选择
      if (userHasManuallySelectedTask) {
        return;
      }
      
      if (targetTask && !selectedTaskId) {
        selectTask(taskId);
        // 保存到localStorage
        localStorage.setItem('analysis_selectedTaskId', taskId);
        localStorage.setItem('privateMessage_selectedTaskId', taskId);
      }
    }
  }, [taskId, tasks, selectedTaskId, selectTask, taskLoading, userHasManuallySelectedTask]);

  // 当任务列表加载完成后，处理localStorage中保存的任务ID
  useEffect(() => {
    if (!taskLoading && tasks.length > 0 && !selectedTaskId) {
      // 如果用户已经手动选择了任务，则跳过localStorage恢复
      if (userHasManuallySelectedTask) {
        return;
      }
      
      // 只有在没有选中任务时，才尝试从localStorage恢复
      const savedTaskId = localStorage.getItem('analysis_selectedTaskId');
      if (savedTaskId) {
        const targetTask = tasks.find(task => task.task_id === savedTaskId);
        if (targetTask) {
          selectTask(savedTaskId);
        }
      }
    }
  }, [taskLoading, tasks, selectedTaskId, selectTask, userHasManuallySelectedTask]);

  // 当页面刷新或重新加载时，重置用户手动选择状态
  useEffect(() => {
    const handleBeforeUnload = () => {
      setUserHasManuallySelectedTask(false);
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  // 添加额外的保护：当用户手动选择任务后，禁用所有自动选择逻辑
  useEffect(() => {
    // 用户已手动选择任务，所有自动选择逻辑已禁用
  }, [userHasManuallySelectedTask]);

  // 本地管理分页状态
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [total, setTotal] = useState(0);

  // 计算分页数据
  const pagination = useMemo(() => {
    const totalPages = Math.ceil(total / pageSize);
    const hasNextPage = currentPage < totalPages;
    const hasPrevPage = currentPage > 1;
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, total);

    return {
      current: currentPage,
      pageSize,
      total,
      totalPages,
      hasNextPage,
      hasPrevPage,
      startIndex,
      endIndex
    };
  }, [currentPage, pageSize, total]);

  // 筛选器状态 - 使用useMemo避免每次渲染都创建新对象
  const filters = useMemo(() => ({
    nickname: '',
    province: '',
    content: '',
    intent: ''
  }), []);

  // 获取评论数据 - 完全重构，移除所有依赖
  const fetchComments = useCallback(async (taskId: string, page: number, size: number, filterParams?: Filters) => {
    if (!taskId) return;
  
    // 检查是否有正在进行的请求
    const requestKey = `comments_${taskId}_${page}_${size}`;
    if (requestRef.current[requestKey]) {
      return;
    }
  
    setLoading(true);
    
    try {
      // 标记请求开始
      requestRef.current[requestKey] = true;
      
      // 构建缓存键
      const cacheKey = `comments_${taskId}_${page}_${size}_${JSON.stringify(filterParams || {})}`;
      
      // 检查缓存是否有效
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        try {
          const { comments, total, timestamp } = JSON.parse(cached);
          const now = Date.now();
          // 缓存有效期5分钟
          if (now - timestamp < 5 * 60 * 1000) {
            setComments(comments);
            setTotal(total);
            setLoading(false);
            return;
          }
        } catch (error) {
          // 缓存解析失败，继续获取新数据
        }
      }
      
      const response = await getCommentListByTaskIdApi(taskId, page, size, filterParams || {});
      
      if (response.status === 200 && response.data?.comment_list) {
        const mappedComments = response.data.comment_list.map((comment: any) => {
          // 通用字段获取函数
          const getFieldValue = (targetField: string, possibleFields: string[]) => {
            // 如果 targetField 直接存在于 comment 中，优先使用它
            if (comment[targetField] !== undefined && comment[targetField] !== null) {
              return comment[targetField];
            }
            // 否则尝试使用可能的字段名
            for (const field of possibleFields) {
              if (comment[field] !== undefined && comment[field] !== null) {
                return comment[field];
              }
            }
            return '';
          };

          return {
            comment_id: comment.comment_id || comment.id || `comment_${Math.random().toString(36).substr(2, 6)}`,
            id: comment.id || comment.comment_id || `id_${Math.random().toString(36).substr(2, 6)}`,
            '评论时间': getFieldValue('评论时间', ['comment_time', 'time', 'created_at']),
            '用户昵称': getFieldValue('用户昵称', ['user_name', 'nickname', 'author_name', 'username']),
            'IP地址': getFieldValue('IP地址', ['user_region', 'province', 'region', 'location']),
            '评论内容': getFieldValue('评论内容', ['comment_content', 'content', 'text']),
            '用户链接': getFieldValue('用户链接', ['user_link', 'author_link', 'profile_url']),
            '内容链接': getFieldValue('内容链接', ['content_link', 'post_link', 'url']),
            'intent_customer': comment.intent_customer || comment.intent || '待分析',
            '分析理由': getFieldValue('分析理由', ['analysis_reason', 'reason', 'intent_reason'])
          };
        });
        
        // 更新总数
        const totalCount = response.data.total || mappedComments.length;
        setTotal(totalCount);
        
        setComments(mappedComments);
        
        // 缓存结果
        sessionStorage.setItem(cacheKey, JSON.stringify({
          comments: mappedComments,
          total: totalCount,
          timestamp: Date.now()
        }));
      } else if (response.status === 400) {
        setComments([]);
        setTotal(0);
      }
    } catch (error) {
      setComments([]);
      setTotal(0);
    } finally {
      setLoading(false);
      // 标记请求完成
      delete requestRef.current[requestKey];
    }
  }, []); // 空依赖数组
  
  // 添加防抖机制，避免频繁请求
  const debouncedFetchComments = useCallback(
    debounce((taskId: string, page: number, size: number, filterParams?: Filters) => {
      fetchComments(taskId, page, size, filterParams);
    }, 500), // 增加到500ms，给用户操作留出更多时间
    [fetchComments]
  );
  
  // 监听分析进度变化，当达到100%时刷新任务列表状态
  useEffect(() => {
    let refreshTimer: NodeJS.Timeout | null = null;
  
    if (analysisProgress === 100 && selectedTaskId) {
      refreshTimer = setTimeout(() => {
        if (typeof loadMoreTasks === 'function') {
          loadMoreTasks();
        }
        // 刷新评论列表
        fetchComments(selectedTaskId, currentPage, pageSize);
      }, 1000);
    }
  
    return () => {
      if (refreshTimer) {
        clearTimeout(refreshTimer);
      }
    };
  }, [analysisProgress, selectedTaskId, loadMoreTasks, currentPage, pageSize, fetchComments]);

  // 旧版进度轮询已移除，统一使用带 autoRefreshEnabled 开关的优化逻辑
  
  // 监听分析进度变化，当达到100%时刷新数据 - 合并重复的效果
  useEffect(() => {
    let refreshTimer: NodeJS.Timeout | null = null;
  
    if (analysisProgress === 100 && selectedTaskId) {
      refreshTimer = setTimeout(() => {
        if (typeof loadMoreTasks === 'function') {
          loadMoreTasks();
        }
        // 刷新评论列表
        fetchComments(selectedTaskId, currentPage, pageSize);
      }, 1000);
    }

    // 统一的清理函数
    return () => {
      if (refreshTimer) {
        clearTimeout(refreshTimer);
      }
    };
  }, [analysisProgress, selectedTaskId, loadMoreTasks, currentPage, pageSize, fetchComments]);

  // 获取分析进度
  // 添加自动刷新状态管理
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(false);
  const [lastRefreshTime, setLastRefreshTime] = useState<number>(0);
  const [nextRefreshTime, setNextRefreshTime] = useState<number>(0);
  const [refreshTimerId, setRefreshTimerId] = useState<NodeJS.Timeout | null>(null);
  const MIN_REFRESH_INTERVAL = 3000; // 最小刷新间隔3秒
  
  // 获取分析进度 - 优化性能
  const fetchAnalysisProgress = useCallback(async (taskId: string) => {
    if (!taskId) return;
    
    // 检查是否有正在进行的请求
    const requestKey = `analysis_progress_${taskId}`;
    if (requestRef.current[requestKey]) {
      return;
    }
    
    // 检查刷新间隔
    const now = Date.now();
    if (now - lastRefreshTime < MIN_REFRESH_INTERVAL) {
      return;
    }
    
    try {
      // 标记请求开始
      requestRef.current[requestKey] = true;
      setLastRefreshTime(now);
      
      const response = await getAnalysisProgressApi(taskId);
      
      if (response && (response.status === 200 || typeof (response as any).progress === 'number' || (response as any).data)) {
        // 兼容两种响应结构：data(num/sum/state) 或 progress 字段
        let progress = 0;
        let stateVal: number | undefined = undefined;
        if (response.data) {
          setProgressData(response.data);
          const { num, sum, state } = response.data;
          stateVal = state;
          // 确保 sum 大于 0 且 num 不超过 sum
          if (sum > 0) {
            const validNum = Math.min(num, sum);
            progress = Math.round((validNum / sum) * 100);
          } else if (state === 2) { // 如果 state 为 2（完成状态）但 sum 为 0，设置进度为 100%
            progress = 100;
          }
        } else if (typeof response.progress === 'number') {
          progress = Math.max(0, Math.min(100, Math.round(response.progress)));
        }

        // 确保进度在有效范围内
        progress = Math.max(0, Math.min(100, progress));
        setAnalysisProgress(progress);
        
        // 如果分析已完成，停止自动刷新
        const isCompleted = progress === 100 || stateVal === 2;
        if (isCompleted) {
          setAutoRefreshEnabled(false);
          if (refreshTimerId) {
            clearInterval(refreshTimerId);
            setRefreshTimerId(null);
          }
          // 分析完成后立即刷新评论列表
          fetchComments(taskId, currentPage, pageSize);
        }
        
        // 返回是否完成
        return isCompleted;
      }
    } catch (error) {
      console.error('获取分析进度失败:', error);
    } finally {
      // 标记请求完成
      delete requestRef.current[requestKey];
    }
    
    return false;
  }, [lastRefreshTime, currentPage, pageSize, fetchComments]);
  
  // 定时获取分析进度 - 优化定时器逻辑
  useEffect(() => {
    const NORMAL_INTERVAL = 5000; // 5秒
    const RETRY_DELAY = 5000; // 5秒
    const MAX_RETRIES = 3;
    let retryCount = 0;
    let intervalId: NodeJS.Timeout | null = null;
    
    // 清理定时器
    const clearTimer = () => {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };
    
    const startProgressCheck = async () => {
      // 如果任务已完成或未启用自动刷新，不启动定时器
      if (!selectedTaskId || !autoRefreshEnabled || analysisProgress >= 100) {
        clearTimer();
        return;
      }
      
      try {
        const isCompleted = await fetchAnalysisProgress(selectedTaskId);
        
        if (isCompleted) {
          clearTimer();
          fetchComments(selectedTaskId, currentPage, pageSize);
          retryCount = 0;
        } else {
          // 只在没有定时器时创建新的定时器
          if (!intervalId) {
            intervalId = setInterval(async () => {
              if (!autoRefreshEnabled || !selectedTaskId) {
                clearTimer();
                return;
              }
              
              try {
                const completed = await fetchAnalysisProgress(selectedTaskId);
                if (completed) {
                  clearTimer();
                  fetchComments(selectedTaskId, currentPage, pageSize);
                  retryCount = 0;
                }
              } catch (error) {
                retryCount++;
                if (retryCount >= MAX_RETRIES) {
                  clearTimer();
                  setAutoRefreshEnabled(false);
                }
              }
            }, NORMAL_INTERVAL);
          }
        }
      } catch (error) {
        console.error('初始化进度检查失败:', error);
        clearTimer();
      }
    };
    
    startProgressCheck();
    
    // 组件卸载时清理
    return () => {
      clearTimer();
    };
  }, [
    selectedTaskId,
    analysisProgress,
    currentPage,
    pageSize,
    fetchComments,
    autoRefreshEnabled,
    fetchAnalysisProgress
  ]);
  
  // 监听任务切换，重置自动刷新状态
  useEffect(() => {
    if (selectedTaskId) {
      // 分析界面不自动开启刷新，保持为手动触发
      setAutoRefreshEnabled(false);
      setLastRefreshTime(0);
      // 重置倒计时，但不自动启用
      const nextTime = Date.now() + MIN_REFRESH_INTERVAL;
      setNextRefreshTime(nextTime);
    }
  }, [selectedTaskId, MIN_REFRESH_INTERVAL]);
  
  // 添加倒计时显示
  const getRefreshCountdown = useCallback(() => {
    if (!autoRefreshEnabled || !nextRefreshTime) return null;
    const now = Date.now();
    const remaining = Math.max(0, nextRefreshTime - now);
    return Math.ceil(remaining / 1000);
  }, [autoRefreshEnabled, nextRefreshTime]);
  
  // 检查任务是否准备就绪（有评论数据且状态正确）
  // const checkTaskReadiness = useCallback(async (taskId: string) => {
  //   // 添加缓存机制，避免重复检查同一个任务
  //   const cacheKey = `task_readiness_${taskId}`;
  //   const cached = sessionStorage.getItem(cacheKey);
  //   if (cached) {
  //     try {
  //       const cachedData = JSON.parse(cached);
  //       const cacheTime = cachedData.timestamp;
  //       const now = Date.now();
  //       // 缓存5分钟
  //       if (now - cacheTime < 5 * 60 * 1000) {
  //         return cachedData.result;
  //       }
  //     } catch (error) {
  //       // 缓存解析失败，继续执行
  //     }
  //   }

  //   try {
  //     // 先检查评论数据
  //     const commentsResponse = await getCommentListByTaskIdApi(taskId, 1, 15, {});
      
  //     if (commentsResponse.status === 200) {
  //       const commentCount = commentsResponse.data?.comment_list?.length || 0;
        
  //       const result = {
  //         ready: commentCount > 0,
  //         reason: commentCount > 0 ? '任务准备就绪' : '评论数据为空，请等待爬虫完成',
  //         commentCount: commentCount
  //       };

  //       // 缓存结果
  //       sessionStorage.setItem(cacheKey, JSON.stringify({
  //         result,
  //         timestamp: Date.now()
  //       }));

  //       return result;
  //     } else {
  //       const result = {
  //         ready: false,
  //         reason: `获取评论数据失败: ${commentsResponse.msg || '未知错误'}`,
  //         commentCount: 0
  //       };

  //       // 缓存结果
  //       sessionStorage.setItem(cacheKey, JSON.stringify({
  //         result,
  //         timestamp: Date.now()
  //       }));

  //       return result;
  //     }
  //   } catch (error) {
  //     const result = {
  //       ready: false,
  //       reason: '检查任务状态失败',
  //       commentCount: 0
  //     };

  //     // 缓存结果
  //       sessionStorage.setItem(cacheKey, JSON.stringify({
  //         result,
  //         timestamp: Date.now()
  //       }));

  //       return result;
  //     }
  //   }, []); // 空依赖数组

  // 任务更新处理函数
  const handleTaskUpdate = useCallback(() => {
    // 只刷新进度数据，不重新获取任务列表，避免影响分析状态
    if (selectedTaskId) {
      console.log('🔄 任务更新，只刷新进度数据，不重新获取任务列表');
      // 只刷新进度数据
      fetchAnalysisProgress(selectedTaskId);
    }
  }, [selectedTaskId, fetchAnalysisProgress]);

  // 清理任务相关的缓存
  const clearTaskCache = useCallback((taskId: string) => {
    // 清理评论缓存
    const keysToRemove = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && (key.startsWith(`comments_${taskId}_`) || key.startsWith(`task_readiness_${taskId}`))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => sessionStorage.removeItem(key));
    console.log('🧹 清理任务缓存:', taskId);
  }, []);

  // 当任务ID变化时，获取评论数据和分析进度 - 简化逻辑
  useEffect(() => {
    if (selectedTaskId) {
      // 清理之前任务的缓存
      if (selectedTaskId) {
        clearTaskCache(selectedTaskId);
      }
      
      // 重置分页状态
      setCurrentPage(1);
      setTotal(0);
      setComments([]);
      
      // 立即获取数据
      fetchComments(selectedTaskId, 1, pageSize);
      fetchAnalysisProgress(selectedTaskId);
    }
  }, [selectedTaskId]); // 移除pageSize, fetchComments, fetchAnalysisProgress依赖

  // 分页变化时获取数据 - 简化逻辑
  useEffect(() => {
    if (selectedTaskId && currentPage >= 1) {
      // 避免在任务切换时重复请求第一页数据
      if (currentPage === 1 && comments.length === 0) {
        return; // 第一页数据已经在任务切换时获取过了
      }
      // 使用防抖，避免频繁请求
      debouncedFetchComments(selectedTaskId, currentPage, pageSize);
    }
  }, [currentPage, pageSize, selectedTaskId]); // 移除debouncedFetchComments依赖

  // 清理函数，组件卸载时清理请求状态
  useEffect(() => {
    return () => {
      // 清理所有进行中的请求
      requestRef.current = {};
    };
  }, []);

  // 定时获取分析进度
  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    
    if (selectedTaskId && analysisProgress < 100) {
      intervalId = setInterval(() => {
        fetchAnalysisProgress(selectedTaskId);
      }, 5000); // 每5秒获取一次进度
    }
    
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [selectedTaskId, analysisProgress, fetchAnalysisProgress]);

  // 监听分析进度变化，当达到100%时刷新任务列表状态
  useEffect(() => {
    if (analysisProgress === 100 && selectedTaskId) {
      // 延迟一下再刷新，确保进度数据已稳定
      const refreshTimer = setTimeout(() => {
        if (typeof loadMoreTasks === 'function') {
          loadMoreTasks();
        }
        // 刷新评论列表
        fetchComments(selectedTaskId, currentPage, pageSize);
      }, 1000);
      
      return () => clearTimeout(refreshTimer);
    }
  }, [analysisProgress, selectedTaskId, loadMoreTasks]);

  const handleTaskSelect = async (taskId: string) => {
    // 检查任务是否存在
    const targetTask = tasks.find(task => task.task_id === taskId);
    if (!targetTask) {
      return;
    }
    
    // 如果选择的是当前已选中的任务，则跳过
    if (selectedTaskId === taskId) {
      return;
    }
    
    // 标记用户已手动选择任务
    setUserHasManuallySelectedTask(true);
    
    // 调用selectTask - 这会触发useEffect，自动处理分页状态重置和数据加载
    selectTask(taskId);
    
    // 同步localStorage
    localStorage.setItem('analysis_selectedTaskId', taskId);
    localStorage.setItem('privateMessage_selectedTaskId', taskId);
    
    // 移除checkTaskReadiness调用，因为任务切换时的useEffect已经处理了数据获取
    // 避免重复的API调用
  };

  // 处理分页变化 - 简化逻辑
  const handlePaginationChange = useCallback((page: number, size: number) => {
    // 更新分页状态
    setCurrentPage(page);
    setPageSize(size);
    
    // 重新获取数据
    if (selectedTaskId) {
      fetchComments(selectedTaskId, page, size, filters);
    }
  }, [selectedTaskId, filters, fetchComments]);

  // 处理页大小变化 - 简化逻辑
  const handlePageSizeChange = useCallback((newSize: number) => {
    // 更新页大小并重置到第一页
    setPageSize(newSize);
    setCurrentPage(1);
    
    // 重新获取第一页数据
    if (selectedTaskId) {
      fetchComments(selectedTaskId, 1, newSize, filters);
    }
  }, [selectedTaskId, filters, fetchComments]);

  return (
    <Layout style={{ height: 'calc(100vh - 56px)', background: '#ffffff' }}>
      
      
      <Layout.Sider
        width={260}
        style={{
          background: 'transparent'
        }}
      >
         <TaskSidebar
            tasks={tasks}
            loading={taskLoading}
            selectedTaskId={selectedTaskId}
            onTaskSelect={handleTaskSelect}
            pageType="analysis"
            hasMoreTasks={hasMoreTasks}
            isLoadingMore={isLoadingMore}
            onLoadMore={loadMoreTasks}
          />
      </Layout.Sider>

      <Layout.Content style={{ overflow: 'auto', background: '#ffffff' }}>
                 {/* 添加CSS样式来隐藏滚动条和自定义进度条 */}
         <style>
           {`             /* 隐藏Layout.Content的滚动条 */
             .arco-layout-content::-webkit-scrollbar {
               width: 0 !important;
               height: 0 !important;
               display: none !important;
             }
             
             .arco-layout-content::-webkit-scrollbar-track {
               display: none !important;
             }
             
             .arco-layout-content::-webkit-scrollbar-thumb {
               display: none !important;
             }
             
             /* 隐藏所有可能的滚动条 */
             .arco-layout-content,
             .arco-layout-content *,
             .arco-card,
             .arco-card *,
             .arco-table,
             .arco-table * {
               scrollbar-width: none !important;
               -ms-overflow-style: none !important;
             }
             
             .arco-layout-content::-webkit-scrollbar,
             .arco-layout-content *::-webkit-scrollbar,
             .arco-card::-webkit-scrollbar,
             .arco-card *::-webkit-scrollbar,
             .arco-table::-webkit-scrollbar,
             .arco-table *::-webkit-scrollbar {
               width: 0 !important;
               height: 0 !important;
               display: none !important;
             }
             
             /* 自定义进度条样式 */
             .arco-progress-line .arco-progress-line-inner {
               border-radius: 12px !important;
               height: 8px !important;
               background-color:rgb(144, 207, 255) !important;
             }
             
             .arco-progress-line .arco-progress-line-outer {
               border-radius: 12px !important;
               height: 8px !important;
               background-color: #f0f0f0 !important;
             }
           `}
         </style>
        
        {currentTask ? (
          <>
            {/* 顶部标题区域 */}
            <AnalysisHeader 
              currentTask={currentTask} 
              onTaskUpdate={handleTaskUpdate}
              onStartAutoRefresh={() => {
                setAutoRefreshEnabled(true);
                setLastRefreshTime(0);
                setNextRefreshTime(Date.now() + MIN_REFRESH_INTERVAL);
                // 立即尝试获取一次进度，避免等待首个定时器触发
                if (selectedTaskId) {
                  setTimeout(() => {
                    fetchAnalysisProgress(selectedTaskId);
                  }, 300);
                }
              }}
              onStopAutoRefresh={() => {
                setAutoRefreshEnabled(false);
              }}
              serviceIntro={serviceIntro}
              targetCustomer={targetCustomer}
              analysisProgress={analysisProgress}
              progressData={progressData}
            />
     
            {/* 服务介绍和客户需求卡片 */}
            <SummaryCards 
              currentTask={currentTask} 
              onServiceIntroChange={setServiceIntro}
              onTargetCustomerChange={setTargetCustomer}
            />
                         {/* 分页器和进度条 */}
             <div style={{
               display: 'flex',
               justifyContent: 'space-between',
               alignItems: 'center',
               marginBottom: 16,
               height: 32,
               marginLeft: '20px',
               marginRight: '20px'
             }}>
               {/* 左侧：评论总数和进度条 */}
               <div style={{ 
                 display: 'flex', 
                 alignItems: 'center',
                 gap: '20px'
               }}>
                 {/* 评论总数 */}
                 <div style={{ 
                   color: '#888',
                   fontSize: 15,
                   display: 'flex',
                   alignItems: 'center'
                 }}>
                   共 {pagination.total} 条评论
                 </div>
                 
                 {/* 分析进度条 */}
                 {selectedTaskId && (
                   <div style={{ 
                     display: 'flex', 
                     alignItems: 'center', 
                     gap: '10px',
                     minWidth: '200px'
                   }}>
                     <span style={{ fontSize: '15px', color: '#666' }}>分析进度:</span>
                     <Progress
                       percent={analysisProgress}
                       size="default"
                       style={{ 
                         flex: 1, 
                         minWidth: '120px'
                       }}
                       showText={false}
                       status="normal"
                     />
                     <span style={{ 
                       minWidth: '40px', 
                       textAlign: 'right',
                       fontWeight: '500',
                       color: '#1890ff',
                       fontSize: '14px'
                     }}>
                       {Math.round(analysisProgress)}%
                     </span>
                     {progressData && (
                       <span style={{ 
                         fontSize: '15px',
                         color: '#666',
                         marginLeft: '10px'
                       }}>
                         意向客户: {progressData.ic_num}
                       </span>
                     )}
                   </div>
                 )}
               </div>
               
               {/* 右侧：分页器 */}
               <div style={{ display: 'flex', alignItems: 'center', height: '100%' }}>
                 {total > 0 && (
                   <Pagination
                     current={currentPage}
                     pageSize={pageSize}
                     total={total}
                     onChange={(page, size) => handlePaginationChange(page, size)}
                     onPageSizeChange={handlePageSizeChange}
                     showTotal
                     showJumper
                     size="default"
                     style={{ 
                       minWidth: '300px',
                       backgroundColor: '#fff',
                       padding: '8px 16px',
                       borderRadius: '6px'
                     }}
                   />
                 )}
               </div>
             </div>

                         {/* 评论列表 */}
             <div style={{ margin: '0 20px 20px 20px' }}>
               <CommentTable
                 comments={comments}
                 loading={loading}
                 pagination={pagination}
               />
             </div>
          </>
        ) : (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            textAlign: 'center',
            color: '#86909c',
            fontSize: '15px'
          }}>
          </div>
        )}
      </Layout.Content>
    </Layout>
  );
};

export default CommentAnalysis;

