import { useState, useEffect, useCallback } from 'react';
import type { Task } from '../api/api';

// 全局状态对象
const globalState = {
  tasks: [] as Task[], 
  lastUpdateTime: 0,
  subscribers: new Set<(tasks: Task[]) => void>(),
  updateTasks: (newTasks: Task[]) => {
    globalState.tasks = newTasks;
    globalState.lastUpdateTime = Date.now();
    globalState.subscribers.forEach(callback => callback(newTasks));
  }
};

export function useGlobalTaskState() {
  const [tasks, setTasks] = useState<Task[]>(globalState.tasks);

  useEffect(() => {
    // 订阅全局状态更新
    const subscriber = (newTasks: Task[]) => {
      setTasks(newTasks);
    };
    globalState.subscribers.add(subscriber);

    // 如果已有数据，立即更新
    if (globalState.tasks.length > 0) {
      setTasks(globalState.tasks);
    }

    // 清理订阅
    return () => {
      globalState.subscribers.delete(subscriber);
    };
  }, []);

  const updateGlobalTasks = useCallback((newTasks: Task[]) => {
    globalState.updateTasks(newTasks);
  }, []);

  const getLastUpdateTime = useCallback(() => {
    return globalState.lastUpdateTime;
  }, []);

  return {
    globalTasks: tasks,
    updateGlobalTasks,
    getLastUpdateTime
  };
}

export default useGlobalTaskState;