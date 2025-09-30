import { useEffect, useState, useCallback, useRef } from 'react';
import { Table, Tag, Space, Link, Message, Pagination } from '@arco-design/web-react';
import { useNavigate } from 'react-router-dom';
import SearchBar from '../components/CommentCollection/SearchBar';
import TaskService from '../api/api';
import type { Task } from '../api/api';
import { createCommentCrawlerTaskApi, getQuoteApi } from '../api/api';
import '@arco-design/web-react/dist/css/arco.css';
// 移除未使用的导入
// import useGlobalTaskState from '../hooks/useGlobalTaskState';


// 平台图标组件
const PlatformIcon = ({ platform }: { platform: string }) => {
  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case '抖音':
        return '/dy.svg';
      case '小红书':
        return '/xhs.svg';
      default:
        return '';
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      <img 
        src={getPlatformIcon(platform)} 
        alt={platform}
        style={{ 
          width: '20px', 
          height: '20px',
          borderRadius: '4px'
        }} 
      />
    </div>
  );
};

export default function CommentCollection() {
  const navigate = useNavigate();
  
  // 状态管理
  const [loading, setLoading] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [quota, setQuota] = useState({ used_quota: 0, total_quota: 0 });
  const [intentTotal, setIntentTotal] = useState(0);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  // 插件数据监听相关
  const hiddenDataContainerRef = useRef<HTMLElement | null>(null);
  const [hiddenDataText, setHiddenDataText] = useState('');

  // 自动刷新相关状态
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(false);
  const autoRefreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // 检查任务状态变化，基于状态决定是否继续刷新
  const checkTasksDataChange = useCallback((newTasks: Task[]) => {
    // 检查是否还有进行中的爬虫任务
    const hasRunningTasks = newTasks.some(task => 
      task.crawler_state === 'running'
    );
    
    console.log('🔄 检查爬虫任务状态:', {
      hasRunningTasks,
      runningTasks: newTasks.filter(task => 
        task.crawler_state === 'running'
      ).map(task => ({
        task_id: task.task_id,
        keyword: task.keyword,
        crawler_state: task.crawler_state
      }))
    });
    
    return hasRunningTasks;
  }, []);

  // 启动自动刷新
  const startAutoRefresh = useCallback(() => {
    // 如果已经启用，直接返回
    if (autoRefreshEnabled) {
      console.log('🔄 自动刷新已经处于启用状态');
      return;
    }
    
    console.log('🔄 准备启动自动刷新');
    
    // 确保清理旧的定时器
    if (autoRefreshIntervalRef.current) {
      console.log('🔄 检测到已存在的定时器，先清除');
      clearInterval(autoRefreshIntervalRef.current);
      autoRefreshIntervalRef.current = null;
    }
    
    const refreshData = async () => {
      try {
        // 再次检查定时器是否有效
        if (!autoRefreshIntervalRef.current) {
          return;
        }
        
        const taskService = TaskService.getInstance();
        taskService.clearTaskListCache();
        
        const offset = (currentPage - 1) * pageSize;
        const result = await taskService.getTaskList(offset, pageSize);
        
        // 再次检查定时器是否有效
        if (!autoRefreshIntervalRef.current) {
          return;
        }
        
        if (result && result.tasks) {
          setTasks(result.tasks);
        } else {
          setTasks([]);
        }
      } catch (error) {
        console.error('任务列表：自动刷新失败 -', error instanceof Error ? error.message : '未知错误');
        // 发生错误时不更新任务列表，保持当前状态
      }
    };
    
    // 先设置定时器
    autoRefreshIntervalRef.current = setInterval(refreshData, 30000);
    console.log('🔄 定时器已设置，ID:', autoRefreshIntervalRef.current);
    
    // 成功设置定时器后再更新状态
    setAutoRefreshEnabled(true);
    console.log('🔄 自动刷新已启用');
    
    // 立即执行一次刷新
    refreshData();
  }, [currentPage, pageSize, autoRefreshEnabled]);

  // 停止自动刷新
  const stopAutoRefresh = useCallback(() => {
    console.log('🔄 准备停止自动刷新');
    
    // 先更新状态
    setAutoRefreshEnabled(false);
    
    // 再清理定时器
    if (autoRefreshIntervalRef.current) {
      console.log('🔄 清除定时器，ID:', autoRefreshIntervalRef.current);
      clearInterval(autoRefreshIntervalRef.current);
      autoRefreshIntervalRef.current = null;
    }
    
    console.log('🔄 自动刷新已停止');
  }, []);

  // 检查是否有进行中的任务
  const hasRunningTasks = useCallback((taskList: Task[]) => {
    return taskList.some(task => task.crawler_state === 'running');
  }, []);

  // 获取任务列表
  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const offset = (currentPage - 1) * pageSize;
      const taskService = TaskService.getInstance();
      const result = await taskService.getTaskList(offset, pageSize);
      
      if (result && result.tasks) {
        setTasks(result.tasks);
      } else {
        setTasks([]);
      }
    } catch (error) {
      console.error('获取任务列表失败:', error);
      Message.error('获取任务列表失败');
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, [currentPage, pageSize]);

  // 清除缓存并刷新任务列表（静默刷新，不显示加载状态）
  const refreshTasksWithCacheClear = useCallback(async (silent: boolean = true) => {
    console.log('🔄 清除缓存并刷新任务列表', silent ? '(静默)' : '');
    if (!silent) {
      setLoading(true);
    }
    try {
      const taskService = TaskService.getInstance();
      taskService.clearTaskListCache();
      
      const result = await taskService.getTaskList(0, pageSize);
      
      if (result && result.tasks) {
        console.log('🔄 缓存清除后获取到任务数量:', result.tasks.length);
        setTasks(result.tasks);
        setCurrentPage(1);
      } else {
        console.log('🔄 缓存清除后无任务数据');
        setTasks([]);
      }
    } catch (error) {
      console.error('🔄 清除缓存后获取任务列表失败:', error);
      setTasks([]);
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [pageSize]);

  // 获取任务总数（只在初始化时调用一次）
  const fetchTaskTotal = useCallback(async () => {
    try {
      const taskService = TaskService.getInstance();
      const total = await taskService.getTaskTotal();
      setTotal(total || 0);
    } catch (error) {
      console.error('获取任务总数失败:', error);
      setTotal(0);
    }
  }, []);

  // 获取额度信息
  const fetchQuota = useCallback(async () => {
    try {
      const response = await getQuoteApi();
      if (response.status === 200 && response.data) {
        setQuota({
          used_quota: response.data.used_quota || 0,
          total_quota: response.data.total_quota || 0,
        });
        // 设置意向总数
        setIntentTotal(response.data.intent_customer_count || 0);
      } else {
        console.warn('额度信息：获取失败');
      }
    } catch (error) {
      console.error('额度信息：获取异常 -', error instanceof Error ? error.message : '未知错误');
    }
  }, []);

  // 处理当前页变化
  const handleCurrentPageChange = (page: number) => {
    setCurrentPage(page);
  };

  // 处理页面大小变化
  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setCurrentPage(1);
  };

  // 监听插件数据变化
  useEffect(() => {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach(() => {
        if (hiddenDataContainerRef.current) {
          const newText = hiddenDataContainerRef.current.innerText;
          setHiddenDataText(newText);
        }
      });
    });

    const config = { attributes: true, childList: true, subtree: true };

    const checkElement = () => {
      hiddenDataContainerRef.current = document.querySelector('#hiddenDataContainer');
      
      if (hiddenDataContainerRef.current) {
        observer.observe(hiddenDataContainerRef.current, config);
      } else {
        // 如果元素不存在，延迟重试
        setTimeout(checkElement, 500);
      }
    };

    checkElement();

    // 清理函数
    return () => {
      observer.disconnect();
    };
  }, []);

  // 处理插件传来的数据
  useEffect(() => {
    if (hiddenDataText) {
      try {
        const pluginData = JSON.parse(hiddenDataText);
        
        // 处理插件数据，创建评论收集任务
        handlePluginData(pluginData);
        
        // 清空数据，避免重复处理
        setHiddenDataText('');
      } catch (error) {
        console.error('解析插件数据失败:', error);
      }
    }
  }, [hiddenDataText]);

  // 处理插件数据的函数
  const handlePluginData = async (data: any) => {
    try {
      if (quota.used_quota >= quota.total_quota) {
        Message.error('评论收集额度已超出，请联系客服');
        return;
      }

      const { ids, keyword, platform, tokens, titles } = data;
      
      if (!ids || !keyword || !platform) {
        console.error('插件数据不完整:', data);
        return;
      }

      Message.info("正在添加评论收集任务...");

      const awemes = ids.map((id: string, index: number) => ({
        id: id,
        title: titles?.[index] || "",
        xsec_token: tokens?.[index]?.token || ""
      }));

      const back_data = {
        awemes,
        platform: platform,
        keyword
      };

      const response = await createCommentCrawlerTaskApi(back_data);
      if (response.status === 200) {
        Message.success("评论收集任务添加成功！");
        
        const taskService = TaskService.getInstance();
        taskService.clearCache();
        
        // 刷新数据，但避免重复刷新
        await refreshTasksWithCacheClear(true);
        await fetchTaskTotal();
      } else {
        Message.error("任务添加失败！");
      }
    } catch (error) {
      console.error('处理插件数据失败:', error);
      Message.error('处理插件数据失败');
    }
  };

  // 初始化数据
  useEffect(() => {
    // 并行获取任务列表和总数，避免重复请求
    fetchTaskTotal();
    fetchTasks();
    fetchQuota();
  }, []); // 只在组件挂载时执行一次

  // 监听分页参数变化，重新获取数据
  useEffect(() => {
    // 避免初始化时重复调用，只有当组件已经挂载且分页参数确实发生变化时才调用
    const isInitialized = currentPage > 0;
    if (isInitialized) {
      // 直接在这里实现获取逻辑，避免依赖fetchTasks函数
      const loadTasks = async () => {
        setLoading(true);
        try {
          const offset = (currentPage - 1) * pageSize;
          const taskService = TaskService.getInstance();
          const result = await taskService.getTaskList(offset, pageSize);
          
          if (result && result.tasks) {
            setTasks(result.tasks);
            // 不在这里触发自动刷新管理，让专门的useEffect处理
          } else {
            setTasks([]);
          }
        } catch (error) {
          console.error('获取任务列表失败:', error);
          Message.error('获取任务列表失败');
          setTasks([]);
        } finally {
          setLoading(false);
        }
      };

      loadTasks();
    }
  }, [currentPage, pageSize]); // 移除不必要的依赖

  // 管理自动刷新 - 统一在这里处理所有自动刷新逻辑
  useEffect(() => {
    // 检查是否需要启动或停止自动刷新
    if (tasks.length > 0) {
      const hasRunning = hasRunningTasks(tasks);
      
      if (hasRunning && !autoRefreshEnabled) {
        startAutoRefresh();
      } else if (!hasRunning && autoRefreshEnabled) {
        stopAutoRefresh();
      }
    }

    // 组件卸载时清理
    return () => {
      if (autoRefreshIntervalRef.current) {
        clearInterval(autoRefreshIntervalRef.current);
        autoRefreshIntervalRef.current = null;
        setAutoRefreshEnabled(false);
      }
    };
  }, [tasks, autoRefreshEnabled, hasRunningTasks, startAutoRefresh, stopAutoRefresh]);

  // 表格列配置
  const columns = [
    { 
      title: '关键词', 
      dataIndex: 'keyword',
      key: 'keyword',
      width: 160
    },
    { 
      title: '平台', 
      dataIndex: 'platform', 
      key: 'platform',
      render: (val: string) => <PlatformIcon platform={val === 'dy' ? '抖音' : val === 'xhs' ? '小红书' : val} /> 
    },
    { 
      title: '评论收集状态', 
      key: 'crawler_state',
      render: (_: any, record: any) => (
        <span>
          <Tag color={record.crawler_state === 'finish' ? 'green' : 'orange'}>
            {record.crawler_state === 'finish' ? '已完成' : '进行中'}
          </Tag>
        </span>
      ) 
    },
    {
      title: '收集评论数量',
      key: 'crawler_progress',
      render: (_: any, record: any) => (
        <span style={{ color: '#1890ff', fontWeight: '500' }}>
          {record.crawler_progress || 0} 条
        </span>
      )
    },
    {
      title: '评论分析状态',
      key: 'analysis_state',
      render: (_: any, record: any) => (
        <span>
          <Tag color={record.analysis_state === 'finish' ? 'green' : record.analysis_state === 'running' ? 'orange' : 'blue'}>
            {record.analysis_state === 'finish' ? '已完成' : record.analysis_state === 'running' ? '进行中' : '未开始'}
          </Tag>
        </span>
      )
    },
    {
      title: '分析评论数量',
      key: 'analysis_progress',
      render: (_: any, record: any) => (
        <span style={{ color: '#52c41a', fontWeight: '500' }}>
          {record.analysis_progress || 0} 条
        </span>
      )
    },
    { 
      title: '意向客户', 
      dataIndex: 'intent_count', 
      key: 'intent_count',
      render: (val: number) => <Tag color="green">{val || 0}人</Tag>
    },
    {
      title: '私信状态',
      key: 'market_state',
      render: (_: any, record: any) => (
        <span>
          <Tag color={record.market_state === 'finish' ? 'green' : record.market_state === 'processing' ? 'orange' : 'blue'}>
            {record.market_state === 'finish' ? '已完成' : record.market_state === 'processing' ? '进行中' : '未开始'}
          </Tag>
        </span>
      )
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: any) => (
        <Space size={8}>
          <Link
            href={`/analysis/${record.task_id}`}
            onClick={e => {
              e.preventDefault();
              console.log('🔄 点击进入分析按钮:', { 
                taskId: record.task_id, 
                keyword: record.keyword,
                targetUrl: `/analysis/${record.task_id}`
              });
              navigate(`/analysis/${record.task_id}`);
            }}
          >
            进入分析
          </Link>
        </Space>
      )
    }
  ];

  return (
    <div style={{ width: '100%', height: 'calc(100vh - 56px)' }}>
      <div style={{ width: '100%', padding: '20px' }}>
        {/* 搜索框组件 */}
        <SearchBar onSearch={() => {}} quota={quota} />
        
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
            height: 32,
            width: '100%'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {/* 左侧：任务列表标题 */}
            <h2 style={{ margin: 0, fontWeight: 600, textAlign: 'left' }}>任务列表</h2>
            
            {/* 中间：统计数据 */}
            <div
              style={{
                color: '#888',
                fontSize: 14,
                marginLeft: 16,
                display: 'flex',
                alignItems: 'center',
                gap: '16px'
              }}
            >
              <span>意向总数：{intentTotal}个</span>
              <span style={{ 
                color: quota.used_quota >= quota.total_quota ? '#ff4d4f' : '#888',
                fontWeight: quota.used_quota >= quota.total_quota ? '600' : 'normal'
              }}>
                评论收集额度：{quota.used_quota}/{quota.total_quota}
                {quota.used_quota >= quota.total_quota && (
                  <span style={{ color: '#ff4d4f', marginLeft: '8px' }}>(已超限)</span>
                )}
              </span>
              
              {/* 自动刷新状态指示器 */}
              {autoRefreshEnabled && (
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '8px',
                  color: '#1890ff',
                  fontSize: '12px'
                }}>
                  <style>
                    {`
                      @keyframes pulse {
                        0% { opacity: 0.4; }
                        50% { opacity: 1; }
                        100% { opacity: 0.4; }
                      }
                    `}
                  </style>
                  <div style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: '#1890ff',
                    animation: 'pulse 3s ease-in-out infinite'
                  }} />
                  <span>自动刷新中</span>
                </div>
              )}
            </div>
          </div>
          
          {/* 右侧：分页器 */}
          <div style={{ display: 'flex', alignItems: 'center', height: '100%' }}>
            {total > 0 && (
              <Pagination
                current={currentPage}
                pageSize={pageSize}
                total={total}
                onChange={handleCurrentPageChange}
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
        
        <Table 
          columns={columns} 
          data={tasks} 
          pagination={false}
          loading={loading}
          rowKey="task_id"
          style={{ width: '100%'}}
        />
        
        {/* 隐藏滚动条的自定义样式 */}
        <style>{`
          /* 隐藏页面滚动条 */
          ::-webkit-scrollbar {
            display: none;
          }
          
          /* 隐藏表格滚动条 */
          .arco-table-body {
            scrollbar-width: none; /* Firefox */
            -ms-overflow-style: none; /* IE and Edge */
          }
          
          .arco-table-body::-webkit-scrollbar {
            display: none; /* Chrome, Safari, Opera */
          }
          
          /* 隐藏整个页面的滚动条 */
          body {
            scrollbar-width: none;
            -ms-overflow-style: none;
          }
          
          body::-webkit-scrollbar {
            display: none;
          }
        `}</style>
      </div>
    </div>
  );
}
