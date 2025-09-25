import { useState, useCallback, useEffect, useRef } from 'react';
import TaskService from '../api/api';
import type { Task, TaskListState } from '../api/api';

// 全局缓存，避免多个页面同时使用时产生重复请求
const globalTaskCache = {
  tasks: [] as Task[],
  loading: false,
  lastFetchTime: 0,
  cacheExpiry: 30 * 1000, // 缓存有效期改为30秒
  fetchPromise: null as Promise<{ tasks: Task[], total: number } | undefined> | null,
  // 添加请求去重机制
  pendingRequests: new Map<string, Promise<{ tasks: Task[], total: number } | undefined>>(),
  // 添加已请求的offset跟踪，避免重复请求
  requestedOffsets: new Set<number>(),
  // 添加自动加载状态跟踪
  autoLoadLastTime: 0,
  autoLoadInterval: 30 * 1000, // 自动加载间隔改为30秒
  // 添加请求频率限制
  lastRequestTime: 0,
  minRequestInterval: 2000 // 最小请求间隔2秒
};

export interface UseTaskListOptions {
  pageType: 'analysis' | 'privateCustomer';
  initialSelectedTaskId?: string | null;
  onTaskSelect?: (taskId: string) => void;
}

export interface UseTaskListReturn extends TaskListState {
  selectTask: (taskId: string) => void;
  loadMoreTasks: () => Promise<void>;
  refreshTasks: () => Promise<void>;
  updateTaskStatus: (taskId: string, updates: Partial<Task>) => void;
  getCurrentTask: () => Task | null;
}

export function useTaskList({
  pageType,
  initialSelectedTaskId,
  onTaskSelect
}: UseTaskListOptions): UseTaskListReturn {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMoreTasks, setHasMoreTasks] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  
  // 使用 ref 存储回调函数，避免闭包问题
  const onTaskSelectRef = useRef(onTaskSelect);
  onTaskSelectRef.current = onTaskSelect;
  
  // 使用 ref 存储 TaskService 实例，避免重复创建
  const taskServiceRef = useRef(TaskService.getInstance());
  
  // 使用 ref 存储 AbortController，用于取消请求
  const abortControllerRef = useRef<AbortController | null>(null);
  
  // 使用 ref 存储定时器ID
  const autoRefreshTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // 使用 ref 存储是否有分析中的任务
  const hasAnalyzingTaskRef = useRef(false);
  
  // 获取任务列表
  const fetchTasks = useCallback(async (offset: number = 0, count: number = 50) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    abortControllerRef.current = new AbortController();
    
    // 限制最多加载500个任务
    const maxTasks = 500;
    if (offset >= maxTasks) {
      setHasMoreTasks(false);
      return;
    }

    // 计算本次请求的数量，确保不超过500个任务
    const actualCount = Math.min(count, maxTasks - offset);
    
    // 检查全局缓存
    const now = Date.now();
    if (globalTaskCache.tasks.length > 0 && 
        now - globalTaskCache.lastFetchTime < globalTaskCache.cacheExpiry &&
        offset === 0) {
      // 使用缓存数据
      setTasks(globalTaskCache.tasks);
      setHasMoreTasks(globalTaskCache.tasks.length === actualCount && globalTaskCache.tasks.length < maxTasks);
      return;
    }
    
    // 检查是否已经请求过这个offset，避免重复请求
    if (globalTaskCache.requestedOffsets.has(offset)) {
      if (globalTaskCache.tasks.length > 0) {
        setTasks(globalTaskCache.tasks);
        setHasMoreTasks(globalTaskCache.tasks.length < maxTasks);
      }
      return;
    }
    
    // 检查请求频率限制
    if (now - globalTaskCache.lastRequestTime < globalTaskCache.minRequestInterval) {
      // 延迟重试
      setTimeout(() => {
        fetchTasks(offset, count);
      }, globalTaskCache.minRequestInterval - (now - globalTaskCache.lastRequestTime));
      return;
    }
    
    // 更新最后请求时间
    globalTaskCache.lastRequestTime = now;
    
    // 请求去重：检查是否有相同的请求正在进行
    const requestKey = `tasks_${offset}_${actualCount}`;
    if (globalTaskCache.pendingRequests.has(requestKey)) {
      try {
        const result = await globalTaskCache.pendingRequests.get(requestKey);
        if (result && result.tasks) {
          setTasks(result.tasks);
          setHasMoreTasks(result.tasks.length === actualCount && (offset + result.tasks.length) < maxTasks);
        }
        return;
      } catch (error) {
        console.warn('等待的请求失败，继续发起新请求:', error);
      }
    }
    
    // 如果有正在进行的请求，等待它完成
    if (globalTaskCache.fetchPromise) {
      await globalTaskCache.fetchPromise;
      if (globalTaskCache.tasks.length > 0) {
        setTasks(globalTaskCache.tasks);
        setHasMoreTasks(globalTaskCache.tasks.length === actualCount && globalTaskCache.tasks.length < maxTasks);
      }
      return;
    }
    
    // 开始新的请求
    globalTaskCache.loading = true;
    setLoading(true);
    
    const fetchPromise = (async (): Promise<{ tasks: Task[], total: number } | undefined> => {
      try {
        const result = await taskServiceRef.current.getTaskList(offset, actualCount);
        const newTasks = result.tasks;
        
        if (offset === 0) {
          // 首次加载或刷新
          setTasks(newTasks);
          // 更新全局缓存
          globalTaskCache.tasks = newTasks;
          globalTaskCache.lastFetchTime = now;
          
          // 检查是否有分析中的任务
          hasAnalyzingTaskRef.current = newTasks.some(task => task.analysis_state === 'running');
        } else {
          // 加载更多 - 使用函数式更新，避免依赖tasks
          setTasks(prevTasks => {
            const updatedTasks = [...prevTasks, ...newTasks];
            // 更新全局缓存
            globalTaskCache.tasks = updatedTasks;
            globalTaskCache.lastFetchTime = now;
            
            // 检查是否有分析中的任务
            hasAnalyzingTaskRef.current = updatedTasks.some(task => task.analysis_state === 'running');
            
            return updatedTasks;
          });
        }
        
        // 检查是否还有更多任务可以加载（未达到120个限制）
        setHasMoreTasks(newTasks.length === actualCount && (offset + newTasks.length) < maxTasks);
        
        // 标记这个offset已经被成功请求
        globalTaskCache.requestedOffsets.add(offset);
        
        // 返回结果供其他等待的请求使用
        return { tasks: newTasks, total: result.total };
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          return undefined; // 请求被取消
        }
        
        console.error('获取任务列表失败:', error);
        
        // 如果是503错误或其他服务器错误，标记为已请求并返回缓存数据
        if (error instanceof Error && error.message.includes('503')) {
          console.warn('🛑 服务器503错误，使用缓存数据并标记offset为已请求');
          globalTaskCache.requestedOffsets.add(offset);
          
          // 如果有缓存数据，使用缓存数据
          if (globalTaskCache.tasks.length > 0) {
            setTasks(globalTaskCache.tasks);
            setHasMoreTasks(globalTaskCache.tasks.length < maxTasks);
            return { tasks: globalTaskCache.tasks, total: globalTaskCache.tasks.length };
          }
        }
        
        throw error;
      } finally {
        globalTaskCache.loading = false;
        globalTaskCache.fetchPromise = null;
        // 清理请求记录
        globalTaskCache.pendingRequests.delete(requestKey);
        setLoading(false);
      }
    })();
    
    // 记录正在进行的请求
    globalTaskCache.pendingRequests.set(requestKey, fetchPromise);
    globalTaskCache.fetchPromise = fetchPromise;
    
    try {
      await fetchPromise;
    } catch (error) {
      // 请求失败时清理记录
      globalTaskCache.pendingRequests.delete(requestKey);
      throw error;
    }
  }, []); // 移除tasks依赖，避免循环依赖
  
  // 静默获取任务列表 - 不显示加载状态，避免UI跳动
  const silentFetchTasks = useCallback(async (offset: number = 0, count: number = 50) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    abortControllerRef.current = new AbortController();
    
    // 限制最多加载500个任务
    const maxTasks = 500;
    if (offset >= maxTasks) {
      setHasMoreTasks(false);
      return;
    }

    // 计算本次请求的数量，确保不超过500个任务
    const actualCount = Math.min(count, maxTasks - offset);
    
    try {
      const result = await taskServiceRef.current.getTaskList(offset, actualCount);
      const newTasks = result.tasks;
      
      if (offset === 0) {
        // 首次加载或刷新
        setTasks(newTasks);
        // 更新全局缓存
        globalTaskCache.tasks = newTasks;
        globalTaskCache.lastFetchTime = Date.now();
        
        // 检查是否有分析中的任务
        hasAnalyzingTaskRef.current = newTasks.some(task => task.analysis_state === 'running');
      }
      
      // 检查是否还有更多任务可以加载
      setHasMoreTasks(newTasks.length === actualCount && (offset + newTasks.length) < maxTasks);
      
      // 标记这个offset已经被成功请求
      globalTaskCache.requestedOffsets.add(offset);
    } catch (error) {
      console.error('静默获取任务列表失败:', error);
    }
  }, []);
  
  // 自动加载更多任务
  const autoLoadMoreTasks = useCallback(async () => {
    if (isLoadingMore || !hasMoreTasks) return;
    
    setIsLoadingMore(true);
    try {
      const currentTime = Date.now();
      
      // 检查是否需要自动加载（每10分钟检查一次）
      if (currentTime - globalTaskCache.autoLoadLastTime < globalTaskCache.autoLoadInterval) {
        return;
      }
      
      setTasks(prevTasks => {
        // 检查是否已达到500个任务的限制
        if (prevTasks.length >= 500) {
          setHasMoreTasks(false);
          return prevTasks;
        }
        
        // 检查是否已经加载了足够的数据，避免重复请求
        if (prevTasks.length >= 200) {
          setHasMoreTasks(false);
          return prevTasks;
        }
        
        // 静默调用fetchTasks，不显示加载状态
        // 使用智能的offset策略，避免重复请求
        const nextOffset = Math.floor(prevTasks.length / 50) * 50;
        
        // 检查是否已经请求过这个offset，避免重复请求
        if (globalTaskCache.requestedOffsets.has(nextOffset)) {
          return prevTasks;
        }
        
        // 检查是否已经有足够的数据覆盖这个offset范围
        if (prevTasks.length >= nextOffset + 50) {
          globalTaskCache.requestedOffsets.add(nextOffset);
          return prevTasks;
        }
        
        // 标记这个offset已经被请求
        globalTaskCache.requestedOffsets.add(nextOffset);
        globalTaskCache.autoLoadLastTime = currentTime;
        
        silentFetchTasks(nextOffset, 50);
        return prevTasks;
      });
    } catch (error) {
      console.error('自动加载更多任务失败:', error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, hasMoreTasks, silentFetchTasks]);
  
  // 刷新任务列表
  const refreshTasks = useCallback(async () => {
    setLoading(true);
    try {
      // 清除全局缓存，强制重新获取
      globalTaskCache.tasks = [];
      globalTaskCache.lastFetchTime = 0;
      globalTaskCache.fetchPromise = null;
      
      // 清除已请求的offset记录，允许重新请求
      globalTaskCache.requestedOffsets.clear();
      
      // 清除TaskService的缓存
      taskServiceRef.current.clearTaskListCache();
      
      await fetchTasks(0, 50);
    } finally {
      setLoading(false);
    }
  }, [fetchTasks]);
  
  // 更新任务状态
  const updateTaskStatus = useCallback((taskId: string, updates: Partial<Task>) => {
    taskServiceRef.current.updateTaskStatus(taskId, updates);
    setTasks(prevTasks => {
      const updatedTasks = prevTasks.map(task => 
        task.task_id === taskId ? { ...task, ...updates } : task
      );
      
      // 更新全局缓存
      globalTaskCache.tasks = updatedTasks;
      globalTaskCache.lastFetchTime = Date.now();
      
      // 检查是否有分析中的任务
      const hasRunningTasks = updatedTasks.some(task => task.analysis_state === 'running');
      hasAnalyzingTaskRef.current = hasRunningTasks;
      
      // 如果没有运行中的任务，并且定时器存在，则停止自动刷新
      if (!hasRunningTasks && autoRefreshTimerRef.current) {
        clearInterval(autoRefreshTimerRef.current);
        autoRefreshTimerRef.current = null;
      }
      
      // 如果有运行中的任务，但没有定时器，则启动自动刷新
      if (hasRunningTasks && !autoRefreshTimerRef.current) {
        autoRefreshTimerRef.current = setInterval(() => {
          refreshTasks().catch(error => {
            console.error('自动刷新任务列表失败:', error);
          });
        }, 30000);
      }
      
      return updatedTasks;
    });
  }, [refreshTasks]);
  
  // 获取当前选中的任务
  const getCurrentTask = useCallback(() => {
    return tasks.find(task => task.task_id === selectedTaskId) || null;
  }, [tasks, selectedTaskId]);
  
  // 自动刷新任务列表
  useEffect(() => {
    // 清理现有定时器
    if (autoRefreshTimerRef.current) {
      clearInterval(autoRefreshTimerRef.current);
      autoRefreshTimerRef.current = null;
    }
    
    // 创建新的定时器，每30秒刷新一次
    autoRefreshTimerRef.current = setInterval(() => {
      // 如果有分析中的任务，或者是分析页面，就刷新任务列表
      if (hasAnalyzingTaskRef.current || pageType === 'analysis') {
        refreshTasks().then(() => {
          // 检查任务状态，如果所有任务都完成了，停止自动刷新
          const allTasksCompleted = tasks.every(task => task.analysis_state !== 'running');
          if (allTasksCompleted) {
            hasAnalyzingTaskRef.current = false;
            if (autoRefreshTimerRef.current) {
              clearInterval(autoRefreshTimerRef.current);
              autoRefreshTimerRef.current = null;
            }
          }
        }).catch(error => {
          console.error('自动刷新任务列表失败:', error);
        });
      }
    }, 30000);
    
    // 组件卸载时清理定时器
    return () => {
      if (autoRefreshTimerRef.current) {
        clearInterval(autoRefreshTimerRef.current);
        autoRefreshTimerRef.current = null;
      }
    };
  }, [refreshTasks, pageType, tasks]);
  
  // 初始化加载 - 只在组件挂载时执行一次
  useEffect(() => {
    let isMounted = true;
    
    const initializeTasks = async () => {
      try {
        await fetchTasks(0, 50);
      } catch (error) {
        console.error('初始化任务列表失败:', error);
      }
    };
    
    if (isMounted) {
      initializeTasks();
    }
    
    return () => {
      isMounted = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchTasks]);
  
  // 处理初始选中的任务
  useEffect(() => {
    if (initialSelectedTaskId && !loading) {
      const targetTask = tasks.find(task => task.task_id === initialSelectedTaskId);
      if (targetTask && !selectedTaskId) {
        setSelectedTaskId(initialSelectedTaskId);
      }
    }
  }, [initialSelectedTaskId, selectedTaskId, tasks, loading]);
  
  // 选择任务
  const selectTask = useCallback((taskId: string) => {
    // 使用函数式更新，避免闭包问题
    setSelectedTaskId(prevSelectedTaskId => {
      if (taskId !== prevSelectedTaskId) {
        // 调用回调函数
        onTaskSelectRef.current?.(taskId);
        return taskId;
      }
      return prevSelectedTaskId;
    });
  }, []); // 移除 onTaskSelect 依赖，避免闭包问题
  
  return {
    tasks,
    loading,
    hasMoreTasks,
    isLoadingMore,
    selectedTaskId,
    selectTask,
    loadMoreTasks: autoLoadMoreTasks,
    refreshTasks,
    updateTaskStatus,
    getCurrentTask
  };
}
