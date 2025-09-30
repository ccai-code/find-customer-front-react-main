import { useState, useEffect } from 'react';

export interface NetworkStatus {
  isOnline: boolean;
  isReconnecting: boolean;
  lastError: string | null;
}

export function useNetworkStatus(): NetworkStatus {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setIsReconnecting(false);
      setLastError(null);
      console.log('网络已连接');
    };

    const handleOffline = () => {
      setIsOnline(false);
      setLastError('网络连接已断开');
      console.log('网络已断开');
    };

    // 监听网络状态变化
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // 检测网络连接质量
    const checkNetworkQuality = async () => {
      try {
        const startTime = Date.now();
        await fetch('/api/health', { 
          method: 'HEAD',
          signal: AbortSignal.timeout(5000)
        });
        const endTime = Date.now();
        const latency = endTime - startTime;
        
        if (latency > 3000) {
          console.warn('网络延迟较高:', latency + 'ms');
        }
      } catch (error) {
        console.warn('网络质量检测失败:', error);
      }
    };

    // 定期检测网络质量
    const interval = setInterval(checkNetworkQuality, 30000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  return { isOnline, isReconnecting, lastError };
}
