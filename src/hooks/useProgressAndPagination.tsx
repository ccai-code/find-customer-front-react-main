import React from 'react';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Pagination, Select } from '@arco-design/web-react';
import { getAnalysisProgressApi } from '../api/api';

// 进度数据接口
export interface ProgressData {
  ic_num: number;
  num: number;
  sum: number;
  state: number;
}

// 分页数据接口
export interface PaginationData {
  current: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  startIndex: number;
  endIndex: number;
}

// Hook选项接口
export interface UseProgressAndPaginationOptions {
  // 进度相关
  taskId: string | null;
  platform?: string; // 平台参数（可选，用于其他用途，progress接口不需要）
  onProgressUpdate?: (taskId: string, data: { progress: number; progressData: ProgressData }) => void;
  pollingInterval?: number;
  unchangedThreshold?: number;
  
  // 分页相关
  defaultPageSize?: number;
  defaultCurrent?: number;
  pageSizeOptions?: number[];
}

// Hook返回值接口
export interface UseProgressAndPaginationReturn {
  // 进度相关
  progressData: ProgressData;
  progressPercent: number;
  intentPercent: number;
  isLoading: boolean;
  refreshProgress: () => Promise<void>;
  
  // 分页相关
  pagination: PaginationData;
  setCurrent: (page: number) => void;
  setPageSize: (size: number) => void;
  nextPage: () => void;
  prevPage: () => void;
  goToPage: (page: number) => void;
  resetPagination: () => void;
  
  // 更新总数（用于分页计算）
  updateTotal: (total: number) => void;
}

export function useProgressAndPagination(options: UseProgressAndPaginationOptions): UseProgressAndPaginationReturn {
  const { 
    taskId, 
    platform = 'dy', // 重新添加默认值
    onProgressUpdate, 
    pollingInterval = 5000,
    unchangedThreshold = 4,
    defaultPageSize = 10, 
    defaultCurrent = 1,
    // pageSizeOptions = [5, 10, 20, 50]
  } = options;

  // 进度相关状态
  const [progressData, setProgressData] = useState<ProgressData>({
    ic_num: 0,
    num: 0,
    sum: 0,
    state: 0
  });
  const [isLoading, setIsLoading] = useState(false);

  // 分页相关状态
  const [current, setCurrent] = useState(defaultCurrent);
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const [total, setTotal] = useState(0);

  // 轮询控制状态
  const [shouldPoll, setShouldPoll] = useState(false);
  const [unchangedCount, setUnchangedCount] = useState(0);
  const [lastProgress, setLastProgress] = useState<number | null>(null);
  
  // 引用
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);
  
  // 添加防抖机制，避免频繁请求
  const lastRequestTimeRef = useRef(0);
  const minRequestInterval = 2000; // 最小请求间隔2秒
  
  // 计算分页数据
  const pagination = useMemo(() => {
    const totalPages = Math.ceil(total / pageSize);
    const hasNextPage = current < totalPages;
    const hasPrevPage = current > 1;
    const startIndex = (current - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, total);

    return {
      current,
      pageSize,
      total,
      totalPages,
      hasNextPage,
      hasPrevPage,
      startIndex,
      endIndex
    };
  }, [current, pageSize, total]);

  // 计算进度百分比
  const progressPercent = useMemo(() => {
    if (progressData.sum === 0) return 0;
    return Math.round((progressData.num / progressData.sum) * 100);
  }, [progressData.num, progressData.sum]);

  // 计算意向百分比
  const intentPercent = useMemo(() => {
    if (progressData.num === 0) return 0;
    return Math.round((progressData.ic_num / progressData.num) * 100);
  }, [progressData.ic_num, progressData.num]);

  // 获取进度数据的函数
  const fetchProgressData = useCallback(async (): Promise<ProgressData | null> => {
    if (!taskId) {
      return null;
    }
    
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    abortControllerRef.current = new AbortController();
    
    try {
      const response = await getAnalysisProgressApi(taskId);
      if (response.status === 200) {
        return response.data;
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
              return null; // 请求被取消
      }
      console.error('fetchProgressData: 获取进度数据失败:', error);
    }
    
    return null;
  }, [taskId, platform]);

  // 判断是否应该轮询
  const shouldContinuePolling = useCallback((data: ProgressData): boolean => {
    // 如果分析完成，停止轮询
    if (data.state === 3) {
      return false;
    }
    
    // 如果进度达到100%，停止轮询
    if (data.num >= data.sum && data.sum > 0) {
      return false;
    }
    
    // 如果连续多次进度无变化，停止轮询
    if (lastProgress !== null && lastProgress === data.num) {
      const newUnchangedCount = unchangedCount + 1;
      setUnchangedCount(newUnchangedCount);
      
      if (newUnchangedCount >= unchangedThreshold) {
        return false;
      }
    } else {
      // 进度有变化，重置计数器
      setUnchangedCount(0);
      setLastProgress(data.num);
    }
    
    // 默认继续轮询，除非明确停止
    return true;
  }, [lastProgress, unchangedCount, unchangedThreshold]);

  // 处理进度数据更新
  const handleProgressUpdate = useCallback(async (data: ProgressData) => {
    if (!isMountedRef.current) return;
    

    
    // 更新进度数据状态
    setProgressData(data);
    
    // 通知父组件进度更新
    if (onProgressUpdate && taskId) {
      const progress = data.sum > 0 ? Math.round((data.num / data.sum) * 100) : 0;
      onProgressUpdate(taskId, { progress, progressData: data });
    }
    
    // 判断是否应该继续轮询
    const shouldContinue = shouldContinuePolling(data);
    setShouldPoll(shouldContinue);
    
    if (!shouldContinue) {

    }
  }, [onProgressUpdate, taskId, shouldContinuePolling, unchangedCount]);

  // 统一的轮询处理函数
  const pollProgress = useCallback(async () => {
    if (!shouldPoll || !taskId) {
      return;
    }
    
    // 防抖：检查是否距离上次请求时间太短
    const now = Date.now();
    if (now - lastRequestTimeRef.current < minRequestInterval) {
      return;
    }
    
    try {
      lastRequestTimeRef.current = now;
      const data = await fetchProgressData();
      if (data) {
        // 更新进度数据状态
        setProgressData(data);
        
        // 更新分页总数 - 使用进度数据中的总数
        if (data.sum > 0) {
          setTotal(data.sum);
        }
        
        // 通知父组件进度更新
        if (onProgressUpdate && taskId) {
          const progress = data.sum > 0 ? Math.round((data.num / data.sum) * 100) : 0;
          onProgressUpdate(taskId, { progress, progressData: data });
        }
      }
    } catch (error) {
      console.error('轮询进度失败:', error);
    }
  }, [shouldPoll, taskId, fetchProgressData, onProgressUpdate]);

  // 启动轮询
  const startPolling = useCallback(async () => {
    if (!taskId) {
      setShouldPoll(false);
      return;
    }
    

    
    // 先获取一次数据，判断是否应该轮询
    setIsLoading(true);
    try {
      const data = await fetchProgressData();
      if (data) {

        
        // 更新进度数据状态
        setProgressData(data);
        
        // 更新分页总数 - 使用进度数据中的总数
        if (data.sum > 0) {
          setTotal(data.sum);

        }
        
        // 判断是否应该继续轮询
        const shouldContinue = shouldContinuePolling(data);
        setShouldPoll(shouldContinue);
        

      } else {

        setShouldPoll(false);
      }
    } catch (error) {
      console.error('获取进度数据失败:', error);
      setShouldPoll(false);
    } finally {
      setIsLoading(false);
    }
  }, [taskId, fetchProgressData, shouldContinuePolling]);

  // 停止轮询
  const stopPolling = useCallback(() => {
    setShouldPoll(false);
    setUnchangedCount(0);
    setLastProgress(null);

  }, []);

  // 使用ref存储最新的函数引用，避免依赖问题
  const shouldPollRef = useRef(shouldPoll);
  const pollProgressRef = useRef(pollProgress);
  
  // 更新ref中的最新值
  useEffect(() => {
    shouldPollRef.current = shouldPoll;
  }, [shouldPoll]);
  
  useEffect(() => {
    pollProgressRef.current = pollProgress;
  }, [pollProgress]);

  // 设置定时器 - 进入页面就设置，每5秒触发一次
  useEffect(() => {
    // 清理之前的定时器
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    
    // 设置新的定时器
    intervalRef.current = setInterval(() => {
      if (shouldPollRef.current) {
        pollProgressRef.current();
      }
    }, pollingInterval);
    

    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [pollingInterval]); // 移除 shouldPoll 和 pollProgress 依赖，避免无限循环

  // 当任务ID变化时，重新评估是否应该轮询
  useEffect(() => {
    // 停止之前的轮询
    stopPolling();
    
    // 重置进度数据
    setProgressData({
      ic_num: 0,
      num: 0,
      sum: 0,
      state: 0
    });
    
    // 如果任务ID存在，启动新的轮询评估
    if (taskId) {
      startPolling();
    }
    
    return () => {
      // 清理请求
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [taskId, platform]); // 移除 startPolling 和 stopPolling 依赖，避免无限循环

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // 手动刷新进度
  const refreshProgress = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await fetchProgressData();
      if (data) {
        await handleProgressUpdate(data);
      }
    } finally {
      setIsLoading(false);
    }
  }, [fetchProgressData, handleProgressUpdate]);

  // 分页相关方法
  const handleSetCurrent = useCallback((page: number) => {
    const validPage = Math.max(1, Math.min(page, pagination.totalPages));
    setCurrent(validPage);
  }, [pagination.totalPages]);

  const handleSetPageSize = useCallback((size: number) => {
    setPageSize(size);
    // 重置到第一页
    setCurrent(1);
  }, []);

  const nextPage = useCallback(() => {
    if (pagination.hasNextPage) {
      setCurrent(prev => prev + 1);
    }
  }, [pagination.hasNextPage]);

  const prevPage = useCallback(() => {
    if (pagination.hasPrevPage) {
      setCurrent(prev => prev - 1);
    }
  }, [pagination.hasPrevPage]);

  const goToPage = useCallback((page: number) => {
    handleSetCurrent(page);
  }, [handleSetCurrent]);

  const resetPagination = useCallback(() => {
    setCurrent(defaultCurrent);
    setPageSize(defaultPageSize);
  }, [defaultCurrent, defaultPageSize]);

  // 更新总数
  const updateTotal = useCallback((newTotal: number) => {
    setTotal(newTotal);
    // 当总数变化时，自动调整当前页
    if (newTotal > 0 && current > Math.ceil(newTotal / pageSize)) {
      setCurrent(Math.ceil(newTotal / pageSize));
    }
  }, [current, pageSize]);

  return {
    // 进度相关
    progressData,
    progressPercent,
    intentPercent,
    isLoading,
    refreshProgress,
    
    // 分页相关
    pagination,
    setCurrent: handleSetCurrent,
    setPageSize: handleSetPageSize,
    nextPage,
    prevPage,
    goToPage,
    resetPagination,
    
    // 工具方法
    updateTotal
  };
}

// 组件接口
interface ProgressAndPaginationProps extends UseProgressAndPaginationOptions {
  // 是否显示进度条（某些页面可能不需要）
  showProgress?: boolean;
  // 是否显示分页器（某些页面可能不需要）
  showPagination?: boolean;
  // 自定义样式
  className?: string;
  style?: React.CSSProperties;
  // 分页变化回调
  onPaginationChange?: (page: number, size: number) => void;
}

// 合并后的组件
export default function ProgressAndPagination({
  showProgress = true,
  showPagination = true,
  className,
  style,
  onPaginationChange,
  ...hookOptions
}: ProgressAndPaginationProps): React.ReactElement {
  // 使用合并后的Hook
  const {
    progressData,
    progressPercent,
    intentPercent,
    pagination,
    setCurrent,
    setPageSize
  } = useProgressAndPagination(hookOptions);



  return (
    <div 
      className={className}
      style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: 30,
        ...style
      }}
    >
      {/* 进度条部分 */}
      {showProgress && (
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <span style={{ marginRight: 10, color: '#666', fontSize: 14 }}>
            进度：{progressData.num} / {progressData.sum}
          </span>
          <div style={{
            width: 200,
            height: 8,
            background: '#f0f0f0',
            borderRadius: 4,
            marginRight: 8,
            overflow: 'hidden'
          }}>
            <div style={{
              width: `${progressPercent}%`,
              height: '100%',
              background: progressPercent === 100 ? '#52c41a' : '#1890ff',
              borderRadius: 4,
              transition: 'width 0.3s ease'
            }}></div>
          </div>
          <span style={{ color: '#666', fontSize: 14 }}>
            {progressPercent}%
          </span>
          <span style={{ marginLeft: 16, color: '#666', fontSize: 14 }}>
            意向：{progressData.ic_num} 个，占比：{intentPercent}%
          </span>
        </div>
      )}

      {/* 分页器部分 */}
      {showPagination && (
        <div style={{ display: 'flex', alignItems: 'center', marginRight: 3 }}>
          <Pagination
            total={pagination.total}
            pageSize={pagination.pageSize}
            current={pagination.current}
            onChange={(page: number) => {
              setCurrent(page);
              // 调用父组件的分页变化回调
              onPaginationChange?.(page, pagination.pageSize);
            }}
            showTotal
            showJumper
            sizeOptions={[5, 10, 20]}
            onPageSizeChange={(size: number) => {
              setPageSize(size);
              // 调用父组件的分页变化回调，保持当前页
              onPaginationChange?.(pagination.current, size);
            }}
            disabled={pagination.total === 0}
          />
          <Select
            style={{ width: 120, marginLeft: 16 }}
            value={pagination.pageSize}
            onChange={(size: number) => {
              setPageSize(size);
              // 调用父组件的分页变化回调，保持当前页
              onPaginationChange?.(pagination.current, size);
            }}
            options={[5, 10, 20].map(v => ({ label: `${v} 条/页`, value: v }))}
          />
        </div>
      )}
    </div>
  );
}
