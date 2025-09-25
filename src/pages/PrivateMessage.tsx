import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Layout, Table, Tag, Alert, Button, Message, Pagination, Popover, Space, Input } from '@arco-design/web-react';
import { IconFilter, IconRefresh } from '@arco-design/web-react/icon';
import { useLocation } from 'react-router-dom';
import { useTaskList } from '../hooks/useTaskList';
import { TaskSidebar } from '../hooks';
import type { Task } from '../api/api'; // 使用与 AnalysisHeader 一致的 Task 类型
import { getMarketListByTaskIdApi, getMarketProgressApi, getUserSatisfactionApi, clearMarketListCache, clearMarketProgressCache, getCommentListByTaskIdApi } from '../api/api'; // 使用正确的私信API接口
import { postLoginDouyin, getIsAllStatus, updateIsAllStatus } from '../api/privateMessageApi'; // 导入登录抖音账号API和is_all状态管理API
// import { IconCheck, IconClose, IconClockCircle, IconUser, IconMessage, IconLoading } from '@arco-design/web-react/icon';
import { 
  DouyinAccountTable, 
  PrivateMessageFormWithTags, 
  PrivateMessageTabs, 
  PrivateMessageHeader
} from '../components';

const { Content } = Layout;

// IP地址筛选器组件
const RegionFilter = ({ onFilter, detailData, taskId, tasks, messageAllUsers }: { 
  onFilter: (value: string[]) => void; 
  detailData: DetailItem[];
  taskId?: string;
  tasks: Task[];
  messageAllUsers: boolean;
}) => {
  const [visible, setVisible] = useState(false);
  const [regionValues, setRegionValues] = useState<string[]>([]);
  const [hasFilter, setHasFilter] = useState(false);
  const [allTaskRegions, setAllTaskRegions] = useState<{region: string, count: number}[]>([]);

  // 获取当前任务的所有地区数据（不限于当前页面）
  useEffect(() => {
    const fetchAllTaskRegions = async () => {
      if (!taskId) return;
      
      try {
        // 首先检查任务是否已经分析过
        const currentTask = tasks.find(t => t.task_id === taskId);
        const isTaskAnalyzed = currentTask?.analysis_state === 'finish';
        
        // 根据任务分析状态和用户选择决定isAll参数，与fetchMarketData保持一致
        const isAll = isTaskAnalyzed ? messageAllUsers : true;
        
        if (isAll) {
          // 如果isAll为true（私信全部用户），使用评论数据接口获取地区数据
          const response = await getCommentListByTaskIdApi(taskId, 1, 10000, {}, true);
          
          if (response.status === 200) {
            let commentList: any[] = [];
            
            if (response && response.data && response.data.comment_list && Array.isArray(response.data.comment_list)) {
              commentList = response.data.comment_list;
            } else if (response && response.data && Array.isArray(response.data)) {
              commentList = response.data;
            } else if (response && Array.isArray(response)) {
              commentList = response;
            } else {
              commentList = [];
            }
            
            // 统计所有地区的人数
            const regionCounts = commentList.reduce((acc, item) => {
              const region = item.user_region || item.province || item['IP地址'] || '';
              if (region && region.trim() !== '') {
                acc[region] = (acc[region] || 0) + 1;
              }
              return acc;
            }, {} as Record<string, number>);
            
            // 转换为数组并排序
            const regions = Object.entries(regionCounts)
              .map(([region, count]) => ({ region, count: count as number }))
              .sort((a, b) => a.region.localeCompare(b.region));
            
            setAllTaskRegions(regions);
            
          }
        } else {
          // 如果isAll为false（只私信意向客户），使用营销数据接口获取地区数据
          const response = await getMarketListByTaskIdApi(taskId, 0, 10000);
          
          if (response.status === 200) {
            let marketList: any[] = [];
            
            if (response && response.user_link_list && Array.isArray(response.user_link_list)) {
              marketList = response.user_link_list;
            } else if (response && Array.isArray(response)) {
              marketList = response;
            } else if (response && response.market_list && Array.isArray(response.market_list)) {
              marketList = response.market_list;
            } else if (response && response.data && Array.isArray(response.data)) {
              marketList = response.data;
            } else if (response && response.list && Array.isArray(response.list)) {
              marketList = response.list;
            } else {
              marketList = Array.isArray(response) ? response : [];
            }
            
            // 统计所有地区的人数
            const regionCounts = marketList.reduce((acc, item) => {
              const region = item.user_region || item.province || item['IP地址'] || '';
              if (region && region.trim() !== '') {
                acc[region] = (acc[region] || 0) + 1;
              }
              return acc;
            }, {} as Record<string, number>);
            
            // 转换为数组并排序
            const regions = Object.entries(regionCounts)
              .map(([region, count]) => ({ region, count: count as number }))
              .sort((a, b) => a.region.localeCompare(b.region));
            
            setAllTaskRegions(regions);
            
          }
        }
      } catch (error) {
        console.error('获取任务所有地区数据失败:', error);
        // 如果获取失败，回退到使用当前页面数据
        const regionCounts = detailData.reduce((acc, item) => {
          const region = item.user_region;
          if (region && region.trim() !== '') {
            acc[region] = (acc[region] || 0) + 1;
          }
          return acc;
        }, {} as Record<string, number>);
        
        const regions = Object.entries(regionCounts)
          .map(([region, count]) => ({ region, count: count as number }))
          .sort((a, b) => a.region.localeCompare(b.region));
        
        setAllTaskRegions(regions);
        
      }
    };

    fetchAllTaskRegions();
  }, [taskId, detailData, tasks, messageAllUsers]);

  // 使用所有任务的地区数据，而不是当前页面的数据
  const availableRegions = useMemo(() => {
    return allTaskRegions;
  }, [allTaskRegions]);

  const handleFilter = () => {
    onFilter(regionValues);
    setHasFilter(regionValues.length > 0);
    setVisible(false);
  };

  const handleClear = () => {
    setRegionValues([]);
    onFilter([]);
    setHasFilter(false);
    setVisible(false);
  };

  const content = (
    <div style={{ width: 145, padding: '8px 0' }}>
      {/* 地区列表显示在输入框上方 */}
      <div style={{ 
        maxHeight: '200px', 
        overflowY: 'auto', 
        marginBottom: '8px',
        border: '1px solid #e5e6eb',
        borderRadius: '4px',
        padding: '4px 0'
      }}>
        {availableRegions.length > 0 ? (
          availableRegions.map(regionItem => (
            <div
              key={regionItem.region}
              style={{
                padding: '6px 12px',
                cursor: 'pointer',
                backgroundColor: regionValues.includes(regionItem.region) ? '#e8f4fd' : 'transparent',
                color: regionValues.includes(regionItem.region) ? '#1890ff' : '#1d2129',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '8px'
              }}
              onClick={() => {
                if (regionValues.includes(regionItem.region)) {
                  setRegionValues(regionValues.filter(v => v !== regionItem.region));
                } else {
                  setRegionValues([...regionValues, regionItem.region]);
                }
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  width: '16px',
                  height: '16px',
                  border: '1px solid #c9cdd4',
                  borderRadius: '2px',
                  backgroundColor: regionValues.includes(regionItem.region) ? '#1890ff' : 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontSize: '12px'
                }}>
                  {regionValues.includes(regionItem.region) && '✓'}
                </div>
                <span>{regionItem.region}</span>
              </div>
              <span style={{
                fontSize: '12px',
                color: '#86909c',
                backgroundColor: '#f5f5f5',
                padding: '2px 6px',
                borderRadius: '10px',
                minWidth: '20px',
                textAlign: 'center'
              }}>
                {regionItem.count}
              </span>
            </div>
          ))
        ) : (
          <div style={{
            padding: '12px',
            textAlign: 'center',
            color: '#86909c',
            fontSize: '14px'
          }}>
            暂无地区数据
          </div>
        )}
      </div>
      

      
      <Space>
        <Button
          type="primary"
          size="small"
          onClick={handleFilter}
        >
          筛选
        </Button>
        <Button
          size="small"
          icon={<IconRefresh />}
          onClick={handleClear}
        >
          重置
        </Button>
      </Space>
    </div>
  );

  return (
    <Popover
      content={content}
      trigger="click"
      popupVisible={visible}
      onVisibleChange={setVisible}
      position="top"
    >
      <Button
        size="small"
        icon={<IconFilter />}
        type={hasFilter ? 'primary' : 'secondary'}
        style={{
          color: hasFilter ? '#fff' : '#86909c'
        }}
      />
    </Popover>
  );
};

// 评论内容筛选器组件
const CommentContentFilter = ({ onFilter, onClear }: { 
  onFilter: (value: string) => void; 
  onClear?: () => void;
}) => {
  const [visible, setVisible] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [hasFilter, setHasFilter] = useState(false);

  const handleFilter = () => {
    onFilter(searchKeyword);
    setHasFilter(searchKeyword.trim() !== '');
    setVisible(false);
  };

  const handleClear = () => {
    setSearchKeyword('');
    onFilter('');
    setHasFilter(false);
    setVisible(false);
    
    // 通知父组件清除筛选
    if (onClear) {
      onClear();
    }
  };

  const content = (
    <div style={{ width: 250, padding: '16px' }}>
      {/* 搜索关键词输入框 */}
      <div style={{ marginBottom: '16px', textAlign: 'center' }}>
        <Input
          placeholder="输入关键词搜索评论内容"
          value={searchKeyword}
          onChange={(value) => setSearchKeyword(value)}
          style={{ width: '100%' }}
          allowClear
          onPressEnter={handleFilter}
        />
      </div>
      
      {/* 操作按钮 */}
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
        <Button
          size="small"
          onClick={handleClear}
        >
          重置
        </Button>
        <Button
          type="primary"
          size="small"
          onClick={handleFilter}
        >
          筛选
        </Button>
      </div>
    </div>
  );

  return (
    <Popover
      content={content}
      trigger="click"
      popupVisible={visible}
      onVisibleChange={setVisible}
      position="top"
    >
      <Button
        size="small"
        icon={<IconFilter />}
        type={hasFilter ? 'primary' : 'secondary'}
        style={{
          color: hasFilter ? '#fff' : '#86909c'
        }}
      />
    </Popover>
  );
};

const marketStateMap = { 
  finish: '已私信', 
  initial: '未私信', 
  processing: '私信中' 
};

interface DetailItem {
  key: string;
  user_name: string;
  user_region: string;
  comment_time: string;
  comment_content: string;
  market_state: string;
  market_result_display: string;
  user_link: string;
  content_link: string;
  user_id?: string;
  id?: string;
}

export default function PrivateMessage() {
  const location = useLocation();
  
  // 使用统一的任务列表Hook
  const {
    tasks,
    loading: taskLoading,
    hasMoreTasks,
    isLoadingMore,
    selectedTaskId,
    selectTask,
    loadMoreTasks,
    refreshTasks
  } = useTaskList({
    pageType: 'privateCustomer',
    // 优先使用从分析页面传递过来的任务ID，如果没有则使用本地存储的
    initialSelectedTaskId: location.state?.selectedTaskId || localStorage.getItem('analysis_selectedTaskId') || localStorage.getItem('privateMessage_selectedTaskId') || null,
    onTaskSelect: (taskId: string) => {
      // 同时保存到两个localStorage，确保两个页面都能访问
      localStorage.setItem('privateMessage_selectedTaskId', taskId);
      localStorage.setItem('analysis_selectedTaskId', taskId);
    }
  });
  
  // 兼容性状态
  const [filteredTasks, setFilteredTasks] = useState<Task[]>([]);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  
  // 检测从分析页面跳转过来的情况，刷新任务列表
  useEffect(() => {
    const fromAnalysis = location.state?.fromAnalysis;
    const analysisTaskId = location.state?.selectedTaskId;
    
    if (fromAnalysis && analysisTaskId && refreshTasks) {
      // 延迟刷新，确保页面完全加载
      setTimeout(() => {
        refreshTasks();
      }, 500);
    }
  }, [location.state, refreshTasks]);

  // 详情相关状态
  const [detailData, setDetailData] = useState<DetailItem[]>([]);
  const [detailTotal, setDetailTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  // 其它状态
  const [inputValue, setInputValue] = useState('');
  const [activeTab, setActiveTab] = useState('customers');
  
  // 任务输入框内容缓存 - 用于存储不同任务的输入框内容
  const [taskInputCache, setTaskInputCache] = useState<Record<string, string>>({});
  const [isUserEditing, setIsUserEditing] = useState(false); // 添加用户编辑状态跟踪
  
  // 私信筛选状态
  const [onlyMessageFilteredUsers, setOnlyMessageFilteredUsers] = useState(false);
  // 私信全部用户状态 - 默认勾选
  const [messageAllUsers, setMessageAllUsers] = useState(true);
  
  // 调试：跟踪onlyMessageFilteredUsers状态变化
  useEffect(() => {
  }, [onlyMessageFilteredUsers, selectedTaskId, messageAllUsers]);
  // 跟踪是否已经从服务器加载了is_all状态
  const [isAllStatusLoaded, setIsAllStatusLoaded] = useState(false);
  
  // 包装setMessageAllUsers函数，添加调试日志
  const setMessageAllUsersWithDebug = useCallback((value: boolean) => {
    setMessageAllUsers(value);
  }, [selectedTaskId, isAllStatusLoaded, messageAllUsers]);
  
  // 调试：跟踪messageAllUsers状态变化
  useEffect(() => {
    // 当messageAllUsers状态变化时，清理相关缓存，确保获取最新数据
    if (selectedTaskId && isAllStatusLoaded) {
      console.log('🔄 messageAllUsers状态变化，清理缓存:', { messageAllUsers, selectedTaskId });
      clearMarketListCache(selectedTaskId);
      clearMarketProgressCache(selectedTaskId);
    }
  }, [messageAllUsers, selectedTaskId, isAllStatusLoaded]);
  
  // 加载任务的is_all状态
  const loadIsAllStatus = useCallback(async (taskId: string) => {
    if (!taskId) return;
    
    try {
      const response = await getIsAllStatus(taskId);
      
      if (response && response.success !== false && response.data && response.data.is_all !== undefined) {
        // 处理服务器返回的布尔值或数字值
        // 只有当is_all为true、1或'1'时才为true，其他情况（false、0、'0'等）都为false
        const isAll = response.data.is_all === true || response.data.is_all === 1 || response.data.is_all === '1';
        setMessageAllUsersWithDebug(isAll);
        
        // 当is_all为false时，自动勾选"只私信筛选用户"
        if (!isAll) {
          setOnlyMessageFilteredUsers(true);
        } else {
          setOnlyMessageFilteredUsers(false);
        }
      } else {
        // 如果没有保存的状态，使用默认值true（勾选私信全部用户）
        console.log('⚠️ 获取is_all状态失败或未设置，使用默认值true（勾选私信全部用户）');
        setMessageAllUsersWithDebug(true);
        // 默认情况下取消勾选"只私信筛选用户"
        setOnlyMessageFilteredUsers(false);
      }
      
      // 标记状态已加载
      setIsAllStatusLoaded(true);
    } catch (error) {
      console.error('❌ 加载is_all状态异常:', error);
      // 异常时也使用默认值true
      setMessageAllUsersWithDebug(true);
      // 异常情况下取消勾选"只私信筛选用户"
      setOnlyMessageFilteredUsers(false);
      setIsAllStatusLoaded(true);
    }
  }, []);
  
  // 保存任务的is_all状态
  const saveIsAllStatus = useCallback(async (taskId: string, isAll: boolean) => {
    if (!taskId) return;
    
    try {
      // 直接传递布尔值，API会处理转换
      const response = await updateIsAllStatus(taskId, isAll ? 1 : 0);
      
      if (response && response.success !== false) {
      } else {
        console.warn('⚠️ 保存is_all状态失败:', response);
      }
    } catch (error) {
      console.error('❌ 保存is_all状态异常:', error);
    }
  }, []);
  
  // 包装的messageAllUsers状态设置函数，自动保存到服务器
  const setMessageAllUsersWithSave = useCallback((isAll: boolean) => {
    setMessageAllUsersWithDebug(isAll);
    
    // 如果有选中的任务，同时保存到服务器
    if (selectedTaskId) {
      saveIsAllStatus(selectedTaskId, isAll);
    }
  }, [selectedTaskId, saveIsAllStatus]);
  
  // 抖音账号相关状态
  const [douyinAccounts, setDouyinAccounts] = useState<any[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [messagingAccounts, setMessagingAccounts] = useState<Set<string>>(new Set());
  
  // 进度条数据状态 - 初始化为空状态，避免显示异常数据
  const [progressData, setProgressData] = useState({ num: 0, sum: 0, state: 0 });
  const [isProgressLoading, setIsProgressLoading] = useState(false);
  
  // 使用 useMemo 优化进度数据，避免不必要的重新渲染
  const memoizedProgressData = useMemo(() => progressData, [progressData.num, progressData.sum, progressData.state]);
  
  // 分页状态 - 简化为独立状态，采用分析页面的成功模式
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  
  // 新增：标记是否正在进行评论内容筛选
  const [isCommentContentFiltering, setIsCommentContentFiltering] = useState(false);

  // 获取任务的所有数据用于筛选（不分页）
  const fetchAllTaskDataForFilter = useCallback(async (taskId: string) => {
    if (!taskId) return;
    
    setLoading(true);
    
    try {
      // 首先检查任务是否有意向客户
      const currentTask = tasks.find(t => t.task_id === taskId);
      const hasIntentCustomers = currentTask?.intent_count && currentTask.intent_count > 0;
      
      // 根据任务分析状态和用户选择决定isAll参数
      const isTaskAnalyzed = currentTask?.analysis_state === 'finish';
      const isAll = isTaskAnalyzed ? messageAllUsers : true;
      
      
      // 如果isall为1（私信全部用户），使用评论数据接口
      if (isAll) {
        const response = await getCommentListByTaskIdApi(taskId, 1, 10000, {}, true);
        
        if (response.status === 200) {
          // 尝试多种可能的数据结构
          let commentList: any[] = [];
          let totalCount = 0;
          
          if (response && response.data && response.data.comment_list && Array.isArray(response.data.comment_list)) {
            commentList = response.data.comment_list;
            totalCount = response.data.total || response.data.comment_list.length;
          } else if (response && response.data && Array.isArray(response.data)) {
            commentList = response.data;
            totalCount = response.total || response.data.length;
          } else if (response && Array.isArray(response)) {
            commentList = response;
            totalCount = response.length;
          } else {
            commentList = [];
            totalCount = 0;
          }
          
          // 将评论数据映射为私信用户数据格式
          const mappedData: DetailItem[] = commentList.map((item: any, index: number) => {
            const uniqueKey = `${taskId}_comment_${item.user_id || 'unknown'}_${item.comment_id || 'unknown'}_${index}`;
            
            return {
              key: uniqueKey,
              user_name: item.user_name || item.nickname || item['用户昵称'] || '',
              user_region: item.user_region || item.province || item['IP地址'] || '',
              comment_time: item.comment_time || item.time || item['评论时间'] || '',
              comment_content: item.comment_content || item.content || item['评论内容'] || '',
              // 根据私信结果字段判断私信状态
              market_state: (item['私信结果'] && item['私信结果'] !== '') ? 'success' : 'initial',
              market_result_display: item['私信结果'] || '未私信',
              user_link: item.user_link || item['用户链接'] || '',
              content_link: item.content_link || item['内容链接'] || '',
              user_id: item.user_id || item['用户ID'] || '',
              id: item.id || item.user_id || ''
            };
          });
          
          setDetailData(mappedData);
          setDetailTotal(totalCount);
          
          
          return;
        } else {
          console.error('评论数据获取失败:', response);
        }
      }
      
      // 如果isall为0（私信筛选用户）且有意向客户，使用私信用户列表接口
      if (hasIntentCustomers) {
        // isall为0且有意向客户，使用私信用户列表接口（私信筛选用户）
        const response = await getMarketListByTaskIdApi(taskId, 0, 10000);
        
        if (response.status === 200) {
          // 尝试多种可能的数据结构
          let marketList: any[] = [];
          let totalCount = 0;
          
          if (response && response.user_link_list && Array.isArray(response.user_link_list)) {
            marketList = response.user_link_list;
            totalCount = response.total_count || response.user_link_list.length;
          } else if (response && Array.isArray(response)) {
            marketList = response;
            totalCount = response.length;
          } else if (response && response.market_list && Array.isArray(response.market_list)) {
            marketList = response.market_list;
            totalCount = response.total || response.market_list.length;
          } else if (response && response.data && Array.isArray(response.data)) {
            marketList = response.data;
            totalCount = response.total || response.data.length;
          } else if (response && response.list && Array.isArray(response.list)) {
            marketList = response.list;
            totalCount = response.total || response.list.length;
          } else {
            marketList = Array.isArray(response) ? response : [];
            totalCount = response.total || marketList.length;
          }
          
          // 映射API返回的数据到DetailItem格式
          const mappedData: DetailItem[] = marketList.map((item: any, index: number) => {
            const uniqueKey = `${taskId}_market_${item.user_id || 'unknown'}_${item.comment_id || 'unknown'}_${index}`;
            
            return {
              key: uniqueKey,
              user_name: item.user_name || item.nickname || item['用户昵称'] || '',
              user_region: item.user_region || item.province || item['IP地址'] || '',
              comment_time: item.comment_time || item.time || item['评论时间'] || '',
              comment_content: item.comment_content || item.content || item['评论内容'] || '',
              market_state: item.market_state || item['私信状态'] || 'initial',
              market_result_display: item.market_result_display || item['私信结果'] || '未私信',
              user_link: item.user_link || item['用户链接'] || '',
              content_link: item.content_link || item['内容链接'] || '',
              user_id: item.user_id || item['用户ID'] || '',
              id: item.id || item.user_id || ''
            };
          });
          
          setDetailData(mappedData);
          setDetailTotal(totalCount);
          
          
        } else {
          console.error('私信用户列表获取失败:', response);
          setDetailData([]);
          setDetailTotal(0);
        }
      } else {
        // isall为0但无意向客户，使用评论数据接口作为备选
        const response = await getCommentListByTaskIdApi(taskId, 1, 10000, {}, false);
        
        if (response.status === 200) {
          // 尝试多种可能的数据结构
          let commentList: any[] = [];
          let totalCount = 0;
          
          if (response && response.data && response.data.comment_list && Array.isArray(response.data.comment_list)) {
            commentList = response.data.comment_list;
            totalCount = response.data.total || response.data.comment_list.length;
          } else if (response && response.data && Array.isArray(response.data)) {
            commentList = response.data;
            totalCount = response.total || response.data.length;
          } else if (response && Array.isArray(response)) {
            commentList = response;
            totalCount = response.length;
          } else {
            commentList = [];
            totalCount = 0;
          }
          
          // 将评论数据映射为私信用户数据格式
          const mappedData: DetailItem[] = commentList.map((item: any, index: number) => {
            const uniqueKey = `${taskId}_comment_${item.user_id || item.comment_id || 'unknown'}_${index}`;
            
            return {
              key: uniqueKey,
              user_name: item.user_name || item.nickname || item['用户昵称'] || '',
              user_region: item.user_region || item.province || item['IP地址'] || '',
              comment_time: item.comment_time || item.time || item['评论时间'] || '',
              comment_content: item.comment_content || item.content || item['评论内容'] || '',
              // 根据私信结果字段判断私信状态
              market_state: (item['私信结果'] && item['私信结果'] !== '') ? 'success' : 'initial',
              market_result_display: item['私信结果'] || '未私信',
              user_link: item.user_link || item['用户链接'] || '',
              content_link: item.content_link || item['内容链接'] || '',
              user_id: item.user_id || item['用户ID'] || '',
              id: item.id || item.user_id || ''
            };
          });
          
          setDetailData(mappedData);
          setDetailTotal(totalCount);
          
          
        } else {
          console.error('评论数据获取失败:', response);
          setDetailData([]);
          setDetailTotal(0);
        }
      }
    } catch (error) {
      console.error('fetchAllTaskDataForFilter API调用异常:', error);
      setDetailData([]);
      setDetailTotal(0);
    } finally {
      setLoading(false);
    }
  }, [tasks]);

  // 获取带筛选条件的详情数据 - 用于评论内容筛选
  const fetchMarketDataWithFilter = useCallback(async (taskId: string, page: number, size: number, filters: any) => {
    if (!taskId) return;
    
    setLoading(true);
    
    try {
      
      // 检查任务是否有意向客户
      const currentTask = tasks.find(t => t.task_id === taskId);
      const hasIntentCustomers = currentTask?.intent_count && currentTask.intent_count > 0;
      
      // 根据任务分析状态和用户选择决定isAll参数
      const isTaskAnalyzedForFilter = currentTask?.analysis_state === 'finish';
      const isAllForFilter = isTaskAnalyzedForFilter ? messageAllUsers : true;
      
      // 如果isall为1（私信全部用户），使用评论数据接口
      if (isAllForFilter) {
        const response = await getCommentListByTaskIdApi(taskId, page, size, filters, true);
        
        if (response && response.status === 200) {
          // 处理评论数据
          let commentList: any[] = [];
          let totalCount = 0;
          
          if (response && response.data && response.data.comment_list && Array.isArray(response.data.comment_list)) {
            commentList = response.data.comment_list;
            totalCount = response.data.total || response.data.comment_list.length;
          } else if (response && response.data && Array.isArray(response.data)) {
            commentList = response.data;
            totalCount = response.total || response.data.length;
          } else if (response && Array.isArray(response)) {
            commentList = response;
            totalCount = response.length;
          } else {
            commentList = [];
            totalCount = 0;
          }
          
          // 将评论数据映射为私信用户数据格式
          const mappedData: DetailItem[] = commentList.map((item: any, index: number) => {
            const uniqueKey = `${taskId}_comment_${item.user_id || 'unknown'}_${item.comment_id || 'unknown'}_${index}`;
            
            return {
              key: uniqueKey,
              user_name: item.user_name || item.nickname || item['用户昵称'] || '',
              user_region: item.user_region || item.province || item['IP地址'] || '',
              comment_time: item.comment_time || item.time || item['评论时间'] || '',
              comment_content: item.comment_content || item.content || item['评论内容'] || '',
              // 根据私信结果字段判断私信状态
              market_state: (item['私信结果'] && item['私信结果'] !== '') ? 'success' : 'initial',
              market_result_display: item['私信结果'] || '未私信',
              user_link: item.user_link || item['用户链接'] || '',
              content_link: item.content_link || item['内容链接'] || '',
              user_id: item.user_id || item['用户ID'] || '',
              id: item.id || item.user_id || ''
            };
          });
          
          setDetailData(mappedData);
          setDetailTotal(totalCount);
          
          
          return;
        } else {
          console.error('评论数据获取失败:', response);
        }
      }
      
      // 如果isall为0（私信筛选用户）且有意向客户，使用私信用户列表接口
      if (hasIntentCustomers) {
        // 有意向客户，使用私信用户列表接口
        const response = await getMarketListByTaskIdApi(taskId, (page - 1) * size, size);
        
        if (response && response.status === 200) {
          // 处理私信用户列表数据
          let marketList: any[] = [];
          let totalCount = 0;
          
          if (response && response.user_link_list && Array.isArray(response.user_link_list)) {
            marketList = response.user_link_list;
            totalCount = response.total_count || response.user_link_list.length;
          } else if (response && Array.isArray(response)) {
            marketList = response;
            totalCount = response.length;
          } else if (response && response.market_list && Array.isArray(response.market_list)) {
            marketList = response.market_list;
            totalCount = response.total || response.market_list.length;
          } else if (response && response.data && Array.isArray(response.data)) {
            marketList = response.data;
            totalCount = response.total || response.data.length;
          } else if (response && response.list && Array.isArray(response.list)) {
            marketList = response.list;
            totalCount = response.total || response.list.length;
          } else {
            marketList = Array.isArray(response) ? response : [];
            totalCount = response.total || marketList.length;
          }
          
          // 映射API返回的数据到DetailItem格式
          const mappedData: DetailItem[] = marketList.map((item: any, index: number) => {
            const uniqueKey = `${taskId}_market_${item.user_id || 'unknown'}_${item.comment_id || 'unknown'}_${index}`;
            
            return {
              key: uniqueKey,
              user_name: item.user_name || item.nickname || item['用户昵称'] || '',
              user_region: item.user_region || item.province || item['IP地址'] || '',
              comment_time: item.comment_time || item.time || item['评论时间'] || '',
              comment_content: item.comment_content || item.content || item['评论内容'] || '',
              market_state: item.market_state || item['私信状态'] || 'initial',
              market_result_display: item.market_result_display || item['私信结果'] || '未私信',
              user_link: item.user_link || item['用户链接'] || '',
              content_link: item.content_link || item['内容链接'] || '',
              user_id: item.user_id || item['用户ID'] || '',
              id: item.id || item.user_id || ''
            };
          });
          
          setDetailData(mappedData);
          setDetailTotal(totalCount);
          
          
          return;
        } else {
          console.error('私信用户列表获取失败:', response);
        }
      }
      
      // 无意向客户或私信接口失败，使用评论数据接口
      
      // 根据任务分析状态和用户选择决定isAll参数
      const isTaskAnalyzedForComment = currentTask?.analysis_state === 'finish';
      const isAllForComment = isTaskAnalyzedForComment ? messageAllUsers : true;
      
      const response = await getCommentListByTaskIdApi(taskId, page, size, filters, isAllForComment);
      
      
      if (response && response.status === 200) {
        // 处理API返回的数据
        let commentList: any[] = [];
        let totalCount = 0;
        
        // 更详细的数据结构检查
        if (response.data && response.data.comment_list && Array.isArray(response.data.comment_list)) {
          commentList = response.data.comment_list;
          totalCount = response.data.total || response.data.comment_list.length;
        } else if (response.data && Array.isArray(response.data)) {
          commentList = response.data;
          totalCount = response.total || response.data.length;
        } else if (response.comment_list && Array.isArray(response.comment_list)) {
          commentList = response.comment_list;
          totalCount = response.total || response.comment_list.length;
        } else if (Array.isArray(response)) {
          commentList = response;
          totalCount = response.length;
        } else {
          commentList = [];
          totalCount = 0;
        }
        
        // 映射API返回的数据到DetailItem格式
        const mappedData: DetailItem[] = commentList.map((item: any, index: number) => {
          const uniqueKey = `${taskId}_filtered_${item.user_id || 'unknown'}_${item.comment_id || 'unknown'}_${index}`;
          
          return {
            key: uniqueKey,
            user_name: item.user_name || item.nickname || item['用户昵称'] || '',
            user_region: item.user_region || item.province || item['IP地址'] || '',
            comment_time: item.comment_time || item.time || item['评论时间'] || '',
            comment_content: item.comment_content || item.content || item['评论内容'] || '',
            market_state: item.market_state || item['私信状态'] || 'initial',
            market_result_display: item.market_result_display || item['私信结果'] || '未私信',
            user_link: item.user_link || item['用户链接'] || '',
            content_link: item.content_link || item['内容链接'] || '',
            user_id: item.user_id || item['用户ID'] || '',
            id: item.id || item.user_id || ''
          };
        });
        
        
        setDetailData(mappedData);
        setDetailTotal(totalCount);
        
        
        // 检查数据状态
        setTimeout(() => {
        }, 100);
        
        // 标记筛选完成
        setIsCommentContentFiltering(false);
        
        // 如果筛选结果为空，记录详细信息
        if (mappedData.length === 0) {
          console.log('⚠️ 筛选结果为空，详细信息:', {
            taskId,
            filters,
            response,
            commentList,
            mappedData
          });
        } else {
          // 筛选成功，准备私信数据
          
          // 根据任务分析状态自动勾选相应的选项
          const currentTask = tasks.find(t => t.task_id === taskId);
          const isTaskAnalyzed = currentTask?.analysis_state === 'finish';
          
          
          // 注意：不再根据任务分析状态自动设置messageAllUsers
          // 让loadIsAllStatus函数来处理状态设置，保持默认的true状态（勾选私信全部用户）
          if (isTaskAnalyzed) {
          } else {
          }
          
          // 自动发送筛选用户给私信插件
          setTimeout(() => {
            sendFilteredUsersToPrivateMessagePlugin();
          }, 500); // 延迟500ms，确保状态更新完成
        }
        
      } else {
        console.error('筛选数据获取失败:', response);
        setDetailData([]);
        setDetailTotal(0);
      }
    } catch (error) {
      console.error('fetchMarketDataWithFilter API调用异常:', error);
      setDetailData([]);
      setDetailTotal(0);
    } finally {
      setLoading(false);
    }
  }, []);

  // 获取详情数据（私信用户列表）- 提前定义，供分页函数使用
  const fetchMarketData = useCallback(async (taskId: string, page: number, size: number) => {
    if (!taskId) return;
    
    setLoading(true);
    
    try {
      // 首先检查任务是否有意向客户
      const currentTask = tasks.find(t => t.task_id === taskId);
      const hasIntentCustomers = currentTask?.intent_count && currentTask.intent_count > 0;
      
      // 根据任务分析状态和用户选择决定isAll参数
      const isTaskAnalyzed = currentTask?.analysis_state === 'finish';
      const isAll = isTaskAnalyzed ? messageAllUsers : true;
      
      
      // 如果isall为1（私信全部用户），使用评论数据接口
      if (isAll) {
        const response = await getCommentListByTaskIdApi(taskId, page, size, {}, true);
        
        if (response && response.status === 200) {
          // 处理评论数据
          let commentList: any[] = [];
          let totalCount = 0;
          
          if (response && response.data && response.data.comment_list && Array.isArray(response.data.comment_list)) {
            commentList = response.data.comment_list;
            totalCount = response.data.total || response.data.comment_list.length;
          } else if (response && response.data && Array.isArray(response.data)) {
            commentList = response.data;
            totalCount = response.total || response.data.length;
          } else if (response && Array.isArray(response)) {
            commentList = response;
            totalCount = response.length;
          } else {
            commentList = [];
            totalCount = 0;
          }
          
          // 将评论数据映射为私信用户数据格式
          const mappedData: DetailItem[] = commentList.map((item: any, index: number) => {
            const uniqueKey = `${taskId}_comment_${item.user_id || 'unknown'}_${item.comment_id || 'unknown'}_${index}`;
            
            return {
              key: uniqueKey,
              user_name: item.user_name || item.nickname || item['用户昵称'] || '',
              user_region: item.user_region || item.province || item['IP地址'] || '',
              comment_time: item.comment_time || item.time || item['评论时间'] || '',
              comment_content: item.comment_content || item.content || item['评论内容'] || '',
              // 根据私信结果字段判断私信状态
              market_state: (item['私信结果'] && item['私信结果'] !== '') ? 'success' : 'initial',
              market_result_display: item['私信结果'] || '未私信',
              user_link: item.user_link || item['用户链接'] || '',
              content_link: item.content_link || item['内容链接'] || '',
              user_id: item.user_id || item['用户ID'] || '',
              id: item.id || item.user_id || ''
            };
          });
          
          setDetailData(mappedData);
          setDetailTotal(totalCount);
          
          
          return;
        } else {
          console.error('评论数据获取失败:', response);
        }
      }
      
      // 如果isall为0（私信筛选用户）且有意向客户，使用私信用户列表接口
      if (hasIntentCustomers) {
        // isall为0且有意向客户，使用私信用户列表接口（私信筛选用户）
        const offset = (page - 1) * size;
        const response = await getMarketListByTaskIdApi(taskId, offset, size);
        
        if (response.status === 200) {
          // 尝试多种可能的数据结构
          let marketList: any[] = [];
          let totalCount = 0;
          
          if (response && response.user_link_list && Array.isArray(response.user_link_list)) {
            marketList = response.user_link_list;
            totalCount = response.total_count || response.user_link_list.length;
          } else if (response && Array.isArray(response)) {
            marketList = response;
            totalCount = response.length;
          } else if (response && response.market_list && Array.isArray(response.market_list)) {
            marketList = response.market_list;
            totalCount = response.total || response.market_list.length;
          } else if (response && response.data && Array.isArray(response.data)) {
            marketList = response.data;
            totalCount = response.total || response.data.length;
          } else if (response && response.list && Array.isArray(response.list)) {
            marketList = response.list;
            totalCount = response.total || response.list.length;
          } else {
            marketList = Array.isArray(response) ? response : [];
            totalCount = response.total || marketList.length;
          }
          
          // 映射API返回的数据到DetailItem格式
          const mappedData: DetailItem[] = marketList.map((item: any, index: number) => {
            // 修复：使用更彻底的key生成方式，确保唯一性
            // 组合任务ID、用户ID、评论ID和索引生成唯一key，避免重复
            const uniqueKey = `${taskId}_market_${item.user_id || 'unknown'}_${item.comment_id || 'unknown'}_${offset + index}`;
            
            return {
              key: uniqueKey,
              user_name: item.user_name || item.nickname || item['用户昵称'] || '',
              user_region: item.user_region || item.province || item['IP地址'] || '',
              comment_time: item.comment_time || item.time || item['评论时间'] || '',
              comment_content: item.comment_content || item.content || item['评论内容'] || '',
              market_state: item.market_state || item['私信状态'] || 'initial',
              market_result_display: item.market_result_display || item['私信结果'] || '未私信',
              user_link: item.user_link || item['用户链接'] || '',
              content_link: item.content_link || item['内容链接'] || '',
              user_id: item.user_id || item['用户ID'] || '',
              id: item.id || item.user_id || ''
            };
          });
          
          setDetailData(mappedData);
          setDetailTotal(totalCount);
          
          // 添加调试日志，检查key生成和数据映射
          
        } else {
          console.error('私信用户列表获取失败:', response);
          setDetailData([]);
          setDetailTotal(0);
        }
      } else {
        // 任务未分析，使用评论数据接口
        const response = await getCommentListByTaskIdApi(taskId, page, size, {}, false);
        
        if (response.status === 200) {
          // 尝试多种可能的数据结构
          let commentList: any[] = [];
          let totalCount = 0;
          
          if (response && response.data && response.data.comment_list && Array.isArray(response.data.comment_list)) {
            commentList = response.data.comment_list;
            totalCount = response.data.total || response.data.comment_list.length;
          } else if (response && response.data && Array.isArray(response.data)) {
            commentList = response.data;
            totalCount = response.total || response.data.length;
          } else if (response && Array.isArray(response)) {
            commentList = response;
            totalCount = response.length;
          } else {
            commentList = [];
            totalCount = 0;
          }
          
          // 将评论数据映射为私信用户数据格式
          const mappedData: DetailItem[] = commentList.map((item: any, index: number) => {
            const uniqueKey = `${taskId}_comment_${item.user_id || item.comment_id || 'unknown'}_${(page - 1) * size + index}`;
            
            return {
              key: uniqueKey,
              user_name: item.user_name || item.nickname || item['用户昵称'] || '',
              user_region: item.user_region || item.province || item['IP地址'] || '',
              comment_time: item.comment_time || item.time || item['评论时间'] || '',
              comment_content: item.comment_content || item.content || item['评论内容'] || '',
              // 根据私信结果字段判断私信状态
              market_state: (item['私信结果'] && item['私信结果'] !== '') ? 'success' : 'initial',
              market_result_display: item['私信结果'] || '未私信',
              user_link: item.user_link || item['用户链接'] || '',
              content_link: item.content_link || item['内容链接'] || '',
              user_id: item.user_id || item['用户ID'] || '',
              id: item.id || item.user_id || ''
            };
          });
          
          setDetailData(mappedData);
          setDetailTotal(totalCount);
          
          
        } else {
          console.error('评论数据获取失败:', response);
          setDetailData([]);
          setDetailTotal(0);
        }
      }
    } catch (error) {
      console.error('fetchMarketData API调用异常:', error);
      setDetailData([]);
      setDetailTotal(0);
    } finally {
      setLoading(false);
    }
  }, [tasks, messageAllUsers]);





  // 重置分页状态
  const resetPagination = useCallback(() => {
    setCurrentPage(1);
    setPageSize(10);
  }, []);
  
  // 抖音账号处理函数
  const handleAddDouyinAccount = useCallback(async () => {
    setAccountsLoading(true);
    try {
      // 这里可以调用添加抖音账号的API
      // 暂时模拟添加账号
      const newAccount = {
        user_id: `account_${Date.now()}`,
        account: `抖音账号${douyinAccounts.length + 1}`,
        state: 0,
        currentTask: '',
        nickname: '',
        avatar: '',
        is_logged_in: false
      };
      
      setDouyinAccounts(prev => [...prev, newAccount]);
      Message.success('抖音账号已添加');
    } catch (error) {
      Message.error('添加抖音账号失败');
      console.error('添加抖音账号失败:', error);
    } finally {
      setAccountsLoading(false);
    }
  }, [douyinAccounts.length]);
  
  const handleStartMessaging = useCallback((record: any) => {
    setMessagingAccounts(prev => new Set([...prev, record.user_id]));
    // 更新账号状态
    setDouyinAccounts(prev => 
      prev.map(acc => 
        acc.user_id === record.user_id 
          ? { ...acc, state: 2, task_id: selectedTaskId } 
          : acc
      )
    );
  }, [selectedTaskId]);
  
  const handleStopMessaging = useCallback((record: any) => {
    setMessagingAccounts(prev => {
      const newSet = new Set(prev);
      newSet.delete(record.user_id);
      return newSet;
    });
    // 更新账号状态
    setDouyinAccounts(prev => 
      prev.map(acc => 
        acc.user_id === record.user_id 
          ? { ...acc, state: 1, task_id: selectedTaskId } 
          : acc
      )
    );
  }, [selectedTaskId]);
  
  const handleLoginDouyinAccount = useCallback(async (record: any) => {
    try {
      // 调用真实的登录抖音账号API
      const response = await postLoginDouyin();
      
      if (response && response.status === 200) {
        Message.success('抖音账号登录成功');
        // 更新账号状态
        setDouyinAccounts(prev => 
          prev.map(acc => 
            acc.user_id === record.user_id 
              ? { ...acc, state: 1, is_logged_in: true } 
              : acc
          )
        );
      } else {
        Message.error(response?.message || '登录抖音账号失败');
      }
    } catch (error) {
      Message.error('登录抖音账号失败');
      console.error('登录抖音账号失败:', error);
    }
  }, []);
  
  // 筛选相关状态 - 按任务ID分别存储，任务切换时重置
  const [filters, setFilters] = useState({
    commentTime: '',
    userNickname: '',
    userRegion: '',
    commentContent: '' // 新增：评论内容筛选
  });
  
  // 新增：获取评论内容筛选后的用户数据，供私信插件使用
  const getCommentContentFilteredUsers = useCallback(() => {
    if (!filters.commentContent || !filters.commentContent.trim()) {
      return [];
    }
    
    // 返回筛选后的用户数据
    const filteredUsers = detailData.filter(item => 
      item.user_id && 
      item.user_id.trim() !== '' && 
      item.comment_content && 
      item.comment_content.toLowerCase().includes(filters.commentContent.toLowerCase())
    );
    
    
    return filteredUsers;
  }, [filters.commentContent, detailData]);
  
  // 新增：将筛选后的用户数据传递给私信插件
  const sendFilteredUsersToPrivateMessagePlugin = useCallback(async () => {
    const filteredUsers = getCommentContentFilteredUsers();
    
    if (filteredUsers.length === 0) {
      console.log('⚠️ 没有筛选用户数据，无法发送给私信插件');
      return;
    }
    
    console.log('🚀 准备发送筛选用户给私信插件:', {
      userCount: filteredUsers.length,
      users: filteredUsers.slice(0, 3) // 只显示前3个，避免日志过长
    });
    
    try {
      // 这里可以调用私信插件的API
      // 例如：await privateMessagePluginApi.sendUsers(filteredUsers);
      
      // 或者通过全局事件通知私信插件
      const event = new CustomEvent('privateMessageUsers', {
        detail: {
          type: 'commentContentFiltered',
          taskId: selectedTaskId,
          filterKeyword: filters.commentContent,
          users: filteredUsers,
          timestamp: new Date().toISOString()
        }
      });
      
      window.dispatchEvent(event);
      
      
    } catch (error) {
      console.error('❌ 发送筛选用户给私信插件失败:', error);
    }
  }, [getCommentContentFilteredUsers, selectedTaskId, filters.commentContent]);

  // 分页处理函数 - 根据是否有筛选条件决定处理方式
  const handlePaginationChange = useCallback((page: number, size: number) => {
    // 更新分页状态
    setCurrentPage(page);
    setPageSize(size);
    
    // 检查是否有筛选条件
    const hasFilters = filters.commentTime || filters.userNickname || filters.userRegion || filters.commentContent;
    
    if (selectedTaskId) {
      if (hasFilters) {
        // 有筛选条件时，分页基于前端筛选后的数据，不需要重新调用API
      } else {
        // 没有筛选条件时，调用API获取数据
        fetchMarketData(selectedTaskId, page, size);
      }
    }
  }, [selectedTaskId, filters, fetchMarketData]);

  // 处理页大小变化 - 重置到第一页
  const handlePageSizeChange = useCallback((newSize: number) => {
    // 更新页大小并重置到第一页
    setPageSize(newSize);
    setCurrentPage(1);
    
    // 检查是否有筛选条件
    const hasFilters = filters.commentTime || filters.userNickname || filters.userRegion || filters.commentContent;
    
    if (selectedTaskId) {
      if (hasFilters) {
        // 有筛选条件时，不需要重新调用API，分页基于前端筛选后的数据
      } else {
        // 没有筛选条件时，重新获取第一页数据
        fetchMarketData(selectedTaskId, 1, newSize);
      }
    }
  }, [selectedTaskId, filters, fetchMarketData]);

  // 缓存机制
  // const cacheRef = useRef(new Map<string, Task>());
  // const requestCacheRef = useRef(new Map<string, any>());
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // const [containerWidth, setContainerWidth] = useState(0);



  // 生成缓存键
  // const generateCacheKey = (taskId: string | null, page: number, size: number) => `${taskId}_${page}_${size}`;

  // 处理从其他页面传递过来的参数 - 优化逻辑避免重复更新
  useEffect(() => {
    if (location.state?.selectedTaskId && !selectedTaskId) {
      const { selectedTaskId: taskId } = location.state;
      if (taskId) {
        selectTask(taskId);
        // 清除路由状态，避免重复处理
        window.history.replaceState({}, document.title);
      }
    }
  }, [location.state?.selectedTaskId, selectedTaskId, selectTask]);

  // 页面激活时自动刷新任务列表，确保任务状态是最新的
  useEffect(() => {
    // 当页面加载完成且有任务列表时，刷新任务状态
    if (tasks.length > 0) {
      // 使用setTimeout确保在下一个事件循环中执行，避免阻塞页面渲染
      const refreshTimer = setTimeout(() => {
        // 调用useTaskList的refreshTasks方法刷新任务列表
        if (typeof loadMoreTasks === 'function') {
          // 重新获取第一页数据来刷新状态
          loadMoreTasks();
        }
      }, 100);
      
      return () => clearTimeout(refreshTimer);
    }
  }, [tasks.length, loadMoreTasks]);
  
  // 页面重新激活时，如果有筛选条件，恢复筛选数据
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && selectedTaskId && filters.commentContent) {
        // 延迟执行，避免与其他逻辑冲突
        setTimeout(() => {
          if (selectedTaskId && filters.commentContent.trim()) {
            const filterParams = {
              comment_content: filters.commentContent.trim(),
              content: filters.commentContent.trim(),
              keyword: filters.commentContent.trim()
            };
            fetchMarketDataWithFilter(selectedTaskId, 1, pageSize, filterParams);
          }
        }, 1000);
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [selectedTaskId, filters.commentContent, pageSize, fetchMarketDataWithFilter]);

  // 页面可见性检测，当用户从其他页面切换回来时自动刷新
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && tasks.length > 0) {
        // 延迟刷新，避免频繁请求
        const refreshTimer = setTimeout(() => {
          if (typeof loadMoreTasks === 'function') {
            loadMoreTasks();
          }
        }, 500);
        
        return () => clearTimeout(refreshTimer);
      }
    };

    // 监听页面可见性变化
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // 清理事件监听器
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [tasks.length, loadMoreTasks]);

  // 路由变化监听，当从其他页面导航到私信页面时自动刷新
  useEffect(() => {
    // 当location.pathname变为'/message'时，说明用户刚切换到私信页面
    if (location.pathname === '/message' && tasks.length > 0) {
      // 延迟刷新，确保页面完全加载
      const refreshTimer = setTimeout(() => {
        if (typeof loadMoreTasks === 'function') {
          loadMoreTasks();
        }
      }, 300);
      
      return () => clearTimeout(refreshTimer);
    }
  }, [location.pathname, tasks.length, loadMoreTasks]);

  // 添加认证状态检查
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      console.warn('未检测到认证token，请先登录');
    }
  }, []);

  // 获取认证状态
  const isAuthenticated = useMemo(() => {
    const token = localStorage.getItem('token');
    return !!token;
  }, []);



  // 获取任务列表 - 现在由Hook管理，这里保留兼容性
  const fetchTasks = useCallback(async () => {
    // 任务列表现在由useTaskList Hook管理
    // 显示所有任务，不进行筛选
    setFilteredTasks(tasks);
  }, [tasks]);

  // 加载更多任务 - 现在由Hook管理
  const handleLoadMore = useCallback(async () => {
    await loadMoreTasks();
  }, [loadMoreTasks]);

  // 计算是否还有更多任务
  const calculateHasMoreTasks = useCallback(() => {
    return hasMoreTasks;
  }, [hasMoreTasks]);

  // 获取任务私信状态 - 已优化为使用fetchTaskMarketState统一处理
  // const getTaskMarketState = useCallback(async (task: Task) => {
  //   // 此函数已被fetchTaskMarketState替代，避免重复API调用
  // }, []);

  // 初始化任务数据
  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // 任务选中逻辑 - 优化避免重复选择
  useEffect(() => {
    if (isInitialLoad && filteredTasks.length > 0) {
      let targetTaskId: string | null = null;
      
      // 优先使用路由传递的任务ID
      if (location.state?.selectedTaskId) {
        targetTaskId = location.state.selectedTaskId;
        if (targetTaskId && filteredTasks.find(task => task.task_id === targetTaskId)) {
          selectTask(targetTaskId);
        }
      } 
      // 其次使用已选中的任务ID
      else if (selectedTaskId && filteredTasks.find(task => task.task_id === selectedTaskId)) {
        targetTaskId = selectedTaskId;
      } 
      // 最后选择第一个可用任务
      else if (filteredTasks.length > 0) {
        targetTaskId = filteredTasks[0].task_id;
        selectTask(targetTaskId);
      }
      
      setIsInitialLoad(false);
    }
  }, [filteredTasks, location.state?.selectedTaskId, selectedTaskId, isInitialLoad, selectTask]);

  // 当筛选后的任务列表变化时，处理任务选择
  useEffect(() => {
    // 如果当前选中的任务不在筛选后的列表中，需要重新选择
    if (selectedTaskId && filteredTasks.length > 0) {
      const currentTaskExists = filteredTasks.find(task => task.task_id === selectedTaskId);
      if (!currentTaskExists) {
        // 当前选中的任务不在筛选后的列表中，选择第一个可用的任务
        const firstAvailableTask = filteredTasks[0];
        if (firstAvailableTask) {
  
          selectTask(firstAvailableTask.task_id);
        }
      }
    } else if (filteredTasks.length > 0 && !selectedTaskId) {
      // 没有选中任务但有可用任务，选择第一个
      const firstTask = filteredTasks[0];

      selectTask(firstTask.task_id);
    }
  }, [filteredTasks, selectedTaskId, selectTask]);

  // 切换任务时重置分页、清除筛选条件并缓存任务ID
  useEffect(() => {
    resetPagination();
    
    // 任务切换时清除所有筛选条件，确保每个任务都有独立的筛选状态
    setFilters({
      commentTime: '',
      userNickname: '',
      userRegion: '',
      commentContent: ''
    });
    
    if (selectedTaskId) {
      localStorage.setItem('privateMessage_selectedTaskId', selectedTaskId);
    } else {
      localStorage.removeItem('privateMessage_selectedTaskId');
    }
  }, [selectedTaskId, resetPagination]);

  // 筛选处理函数
  const handleFilter = (field: string, value: string) => {
    // 如果是评论内容筛选，保留地区筛选，只清空其他筛选条件
    if (field === 'commentContent') {
      setFilters((prev: any) => {
        const newFilters = {
          commentTime: '',
          userNickname: '',
          userRegion: prev.userRegion || '', // 保留地区筛选
          commentContent: value
        };
        return newFilters;
      });
    } else {
      setFilters((prev: any) => {
        const newFilters = {
          ...prev,
          [field]: value
        };
        return newFilters;
      });
    }
    
    // 如果是评论内容筛选，需要立即处理（API筛选）
    if (selectedTaskId && field === 'commentContent' && value.trim()) {
      // 延迟执行，避免频繁请求
      setTimeout(() => {
        // 评论内容筛选：直接调用API接口
        // 设置筛选标记
        setIsCommentContentFiltering(true);
        // 构建正确的筛选参数格式 - 尝试多种可能的字段名
        const filterParams = {
          comment_content: value.trim(), // 使用后端期望的字段名
          content: value.trim(), // 备用字段名
          keyword: value.trim() // 备用字段名
        };
        fetchMarketDataWithFilter(selectedTaskId, 1, pageSize, filterParams);
      }, 300);
    }
    // 其他筛选（包括地区筛选）由useEffect统一处理
  };

  // 筛选后的详情数据
  const filteredDetailData = useMemo(() => {
    return detailData.filter(item => {
      const matchTime = !filters.commentTime || 
        (item.comment_time && item.comment_time.includes(filters.commentTime));
      const matchNickname = !filters.userNickname || 
        (item.user_name && item.user_name.toLowerCase().includes(filters.userNickname.toLowerCase()));
      const matchRegion = !filters.userRegion || 
        (item.user_region && filters.userRegion.split(',').some((region: string) => 
          item.user_region.includes(region.trim())
        ));
      const matchCommentContent = !filters.commentContent || 
        (item.comment_content && item.comment_content.toLowerCase().includes(filters.commentContent.toLowerCase()));
      
      return matchTime && matchNickname && matchRegion && matchCommentContent;
    });
  }, [detailData, filters]);

  // 生成筛选后的用户ID列表，用于内容筛选后的私信
  const filteredUserIds = useMemo(() => {
    // 检查是否有内容相关的筛选条件
    const hasContentFilters = filters.commentContent || filters.userNickname || filters.commentTime;
    
    if (hasContentFilters) {
      // 如果有内容相关的筛选条件，返回筛选后的用户ID列表
      const userIds = filteredDetailData
        .filter(item => item.user_id && item.user_id.trim() !== '')
        .map(item => item.user_id!)
        .filter((id, index, arr) => arr.indexOf(id) === index); // 去重
      
      
      return userIds;
    } else {
      return [];
    }
  }, [filteredDetailData, detailData.length, filters.commentContent, filters.userNickname, filters.commentTime]);

  // 基于筛选后数据的分页数据
  const paginatedFilteredData = useMemo(() => {
    // 使用正确的分页计算逻辑
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return filteredDetailData.slice(startIndex, endIndex);
  }, [filteredDetailData, currentPage, pageSize]);

  // 筛选后数据的总数
  const filteredTotal = filteredDetailData.length;

  // 检查是否有筛选条件
  const hasFilters = filters.commentTime || filters.userNickname || filters.userRegion || filters.commentContent;

  // 根据是否有筛选条件决定显示的总数和数据
  const displayTotal = hasFilters ? filteredTotal : detailTotal;
  const displayData = hasFilters ? paginatedFilteredData : detailData;

  // 当筛选条件变化时，重置页码到第一页并重新获取数据
  useEffect(() => {
    resetPagination();
    // 如果有选中的任务，延迟重新获取数据
    if (selectedTaskId) {
      setTimeout(() => {
        // 检查是否正在进行评论内容筛选
        if (isCommentContentFiltering) {
          return;
        }
        
        // 检查是否有评论内容筛选（API筛选）
        const hasCommentContentFilter = filters.commentContent && filters.commentContent.trim();
        
        // 如果有评论内容筛选，不重新获取数据（避免覆盖API筛选结果）
        if (hasCommentContentFilter) {
          return;
        }
        
        // 如果有其他筛选条件，获取所有数据用于前端筛选
        if (filters.commentTime || filters.userNickname || filters.userRegion) {
          // 清理缓存，确保获取最新数据
          clearMarketListCache(selectedTaskId);
          fetchAllTaskDataForFilter(selectedTaskId);
        } else {
          // 没有筛选条件时，只获取第一页数据
          fetchMarketData(selectedTaskId, 1, pageSize);
        }
      }, 300);
    }
  }, [filters, resetPagination, selectedTaskId, pageSize, fetchMarketData, fetchAllTaskDataForFilter, fetchMarketDataWithFilter]);

  // 当筛选条件变化时，根据任务分析状态自动勾选相应的单选框
  useEffect(() => {
    const hasFilters = filters.commentTime || filters.userNickname || filters.userRegion || filters.commentContent;
    if (hasFilters) {
      // 检查当前任务的分析状态
      const currentTask = tasks.find(t => t.task_id === selectedTaskId);
      const isTaskAnalyzed = currentTask?.analysis_state === 'finish';
      
      
      if (isTaskAnalyzed) {
        // 注意：不再根据任务分析状态自动设置messageAllUsers
        // 让loadIsAllStatus函数来处理状态设置，保持默认的true状态（勾选私信全部用户）
        console.log('🔍 已分析任务，等待loadIsAllStatus设置状态');
      } else {
        // 未分析的任务：筛选后自动勾选"私信全部用户"
        // 只有在状态未加载时才自动设置messageAllUsers
        if (!isAllStatusLoaded) {
          setMessageAllUsersWithDebug(true);
        } else {
        }
        setOnlyMessageFilteredUsers(false);
      }
    } else {
      // 没有筛选条件时，重置状态
      setOnlyMessageFilteredUsers(false);
      // 注意：不自动设置messageAllUsers，保持默认的true状态（勾选私信全部用户）
    }
  }, [filters, selectedTaskId, tasks, isAllStatusLoaded]);

  // 当"私信全部用户"变化时，确保"只私信筛选用户"被取消
  useEffect(() => {
    if (messageAllUsers) {
      setOnlyMessageFilteredUsers(false);
    }
  }, [messageAllUsers]);

  // 当"私信全部用户"状态变化时，同步刷新进度条数据
  useEffect(() => {
    if (selectedTaskId && fetchMarketProgressRef.current) {
      fetchMarketProgressRef.current(selectedTaskId);
    }
  }, [messageAllUsers, selectedTaskId]);

  // 当"私信全部用户"状态变化时，重新获取表格数据
  useEffect(() => {
    if (selectedTaskId && isAllStatusLoaded) {
      
      // 检查是否有筛选条件
      const hasFilters = filters.commentTime || filters.userNickname || filters.userRegion || filters.commentContent;
      
      if (hasFilters) {
        // 有筛选条件时，获取所有数据用于前端筛选
        fetchAllTaskDataForFilter(selectedTaskId);
      } else {
        // 没有筛选条件时，获取分页数据
        fetchMarketData(selectedTaskId, 1, pageSize);
      }
    }
  }, [messageAllUsers, selectedTaskId, tasks, filters, pageSize, isAllStatusLoaded]); // 添加isAllStatusLoaded依赖



  // 获取私信进度数据 - 使用 useRef 避免循环依赖
  const fetchMarketProgressRef = useRef<((taskId: string) => Promise<any>) | null>(null);
  
  fetchMarketProgressRef.current = async (taskId: string) => {
    try {
      setIsProgressLoading(true);
      
      // 根据任务分析状态和用户选择决定isAll参数
      const currentTask = tasks.find(t => t.task_id === taskId);
      const isTaskAnalyzed = currentTask?.analysis_state === 'finish';
      
      // 如果任务已分析，使用用户选择的模式；如果未分析，使用"私信全部"模式
      const isAll = isTaskAnalyzed ? messageAllUsers : true;
      
      
      const response = await getMarketProgressApi(taskId, isAll);
      if (response.status === 200) {
        // 正确解析API响应格式：{"data":{"num":2,"state":1,"sum":45},"msg":"success","status":200}
        const progressData = response.data;
        
        // 更新进度数据
        setProgressData({
          num: progressData.num || 0,
          sum: progressData.sum || 0,
          state: progressData.state || 0
        });
        
        setIsProgressLoading(false);
        return progressData;
      } else {
        console.error('获取私信进度失败:', response);
        setIsProgressLoading(false);
      }
    } catch (error) {
      console.error('获取私信进度失败:', error);
      setIsProgressLoading(false);
    }
    return null;
  };

  // 获取选中任务的私信状态数据 - 优化避免重复请求
  const fetchTaskMarketState = useCallback(async (taskId: string) => {
    if (!taskId) return;
    
    try {
      const task = tasks.find(t => t.task_id === taskId);
      if (task) {
        // 根据任务分析状态和用户选择决定isAll参数
        const isTaskAnalyzed = task.analysis_state === 'finish';
        const isAll = isTaskAnalyzed ? messageAllUsers : true;
        
        
        // 直接调用API，避免循环依赖
        const response = await getMarketProgressApi(taskId, isAll);
        if (response.status === 200) {
          const progressData = response.data;
          const num = progressData.num || 0;
          const sum = progressData.sum || 0;
          let marketState = 'initial';
          let progressPercentage = 0;
          
          // 根据实际进度数据计算状态
          if (sum > 0) {
            progressPercentage = Math.round((num / sum) * 100);
            
            if (num === sum && num > 0) {
              marketState = 'finish'; // 已完成
            } else if (num > 0) {
              marketState = 'processing'; // 进行中
            } else {
              marketState = 'initial'; // 未开始
            }
          }
          
          const updatedTask: Task & { hasPrivateCustomers?: boolean } = {
            ...task,
            market_state: marketState,
            progress: progressPercentage
          };
          
          // 只有当状态确实发生变化时才更新
          if (updatedTask.market_state !== task.market_state || 
              updatedTask.progress !== task.progress) {
            setFilteredTasks(prevTasks => 
              prevTasks.map(t => 
                t.task_id === taskId ? updatedTask : t
              )
            );
          }
        }
      }
    } catch (error) {
      console.error('获取任务私信状态失败:', error);
    }
  }, [tasks]); // 移除 fetchMarketProgress 依赖



  // 当任务切换时，更新抖音账号的任务信息
  useEffect(() => {
    if (selectedTaskId && douyinAccounts.length > 0) {
      setDouyinAccounts(prev => 
        prev.map(acc => ({
          ...acc,
          task_id: selectedTaskId,
          currentTask: tasks.find(t => t.task_id === selectedTaskId)?.keyword || ''
        }))
      );
    }
  }, [selectedTaskId, tasks, douyinAccounts.length]);

  // 当任务切换时，自动获取任务数据（根据分析状态选择数据源）
  useEffect(() => {
    if (selectedTaskId && isAllStatusLoaded) {
      // 只有在is_all状态加载完成后才获取数据
      // 延迟获取数据，避免频繁请求
      const timer = setTimeout(() => {
        // 根据任务分析状态自动获取数据
        fetchMarketData(selectedTaskId, 1, pageSize);
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [selectedTaskId, pageSize, fetchMarketData, isAllStatusLoaded, messageAllUsers]);
  
  // 当任务切换时，加载is_all状态
  useEffect(() => {
    if (selectedTaskId) {
      // 重置状态加载标志
      setIsAllStatusLoaded(false);
      loadIsAllStatus(selectedTaskId);
    }
  }, [selectedTaskId, loadIsAllStatus]);

  // 当选中任务变化时，获取进度数据
  useEffect(() => {
    if (selectedTaskId) {
      // 立即获取进度数据
      fetchMarketProgressRef.current?.(selectedTaskId);
      
      // 设置定时器，每10秒刷新一次进度数据（优化：从30秒改为10秒）
      const intervalId = setInterval(() => {
        fetchMarketProgressRef.current?.(selectedTaskId);
      }, 10000);
      
      return () => clearInterval(intervalId);
    } else {
      // 如果没有选中任务，重置进度数据
      setProgressData({ num: 0, sum: 0, state: 0 });
      setIsProgressLoading(false);
    }
  }, [selectedTaskId]); // 移除 fetchMarketProgress 依赖，避免循环

  // 防抖刷新机制 - 避免频繁刷新导致闪动
  const debouncedRefreshRef = useRef<NodeJS.Timeout | null>(null);
  const lastRefreshTimeRef = useRef<number>(0);
  const MIN_REFRESH_INTERVAL = 2000; // 最小刷新间隔2秒

  // 防抖刷新函数
  const debouncedRefreshProgress = useCallback((taskId: string) => {
    const now = Date.now();
    
    // 如果距离上次刷新时间太短，延迟执行
    if (now - lastRefreshTimeRef.current < MIN_REFRESH_INTERVAL) {
      // 清除之前的延迟定时器
      if (debouncedRefreshRef.current) {
        clearTimeout(debouncedRefreshRef.current);
      }
      
      // 设置新的延迟定时器
      debouncedRefreshRef.current = setTimeout(() => {
        fetchMarketProgressRef.current?.(taskId);
        lastRefreshTimeRef.current = Date.now();
      }, MIN_REFRESH_INTERVAL - (now - lastRefreshTimeRef.current));
    } else {
      // 立即刷新
      fetchMarketProgressRef.current?.(taskId);
      lastRefreshTimeRef.current = now;
    }
  }, []);

  // 监听私信完成事件 - 实现实时更新
  useEffect(() => {
    const handlePrivateMessageComplete = (event: CustomEvent) => {
      if (event.detail && event.detail.taskId === selectedTaskId && selectedTaskId) {
        debouncedRefreshProgress(selectedTaskId);
      }
    };

    // 监听私信进度变化事件
    const handlePrivateMessageProgress = (event: CustomEvent) => {
      if (event.detail && event.detail.taskId === selectedTaskId && selectedTaskId) {
        debouncedRefreshProgress(selectedTaskId);
      }
    };

    // 监听私信更新事件
    const handlePrivateMessageUpdate = (event: CustomEvent) => {
      if (event.detail && event.detail.taskId === selectedTaskId && selectedTaskId) {
        debouncedRefreshProgress(selectedTaskId);
      }
    };

    // 添加事件监听器
    window.addEventListener('privateMessageComplete', handlePrivateMessageComplete as EventListener);
    window.addEventListener('privateMessageProgress', handlePrivateMessageProgress as EventListener);
    window.addEventListener('privateMessageUpdate', handlePrivateMessageUpdate as EventListener);
    
    return () => {
      // 清理事件监听器
      window.removeEventListener('privateMessageComplete', handlePrivateMessageComplete as EventListener);
      window.removeEventListener('privateMessageProgress', handlePrivateMessageProgress as EventListener);
      window.removeEventListener('privateMessageUpdate', handlePrivateMessageUpdate as EventListener);
      
      // 清理防抖定时器
      if (debouncedRefreshRef.current) {
        clearTimeout(debouncedRefreshRef.current);
      }
    };
  }, [selectedTaskId, debouncedRefreshProgress]);

  // 页面可见性变化时，刷新进度数据
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && selectedTaskId) {
        // 使用防抖刷新，避免频繁请求
        debouncedRefreshProgress(selectedTaskId);
      }
    };

    // 监听页面可见性变化
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // 清理事件监听器
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [selectedTaskId, debouncedRefreshProgress]);

  // 测量容器宽度
  useEffect(() => {
    const measureWidth = () => {
      if (containerRef.current) {
        // setContainerWidth(containerRef.current.offsetWidth);
      }
    };

    measureWidth();
    window.addEventListener('resize', measureWidth);
    
    return () => {
      window.removeEventListener('resize', measureWidth);
    };
  }, []);

  // 任务选择处理函数 - 优化减少频繁刷新
  const handleTaskSelect = async (taskId: string) => {
    if (taskId !== selectedTaskId) {
      // 清除之前的定时器
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      
      // 清除旧任务的缓存，确保获取最新数据
      if (selectedTaskId) {
        clearMarketListCache(selectedTaskId);
      }
      
      // 先更新选中的任务ID
      selectTask(taskId);
      localStorage.setItem('privateMessage_selectedTaskId', taskId);
      
      const selectedTask = filteredTasks.find(task => task.task_id === taskId);
      
      // 当选择新任务时，自动设置输入框的默认值
      if (selectedTask && selectedTask.keyword) {
        const defaultMessage = `有${selectedTask.keyword}需求吗？`;
        setInputValue(defaultMessage);
      }
      
      // 移除重复的API调用，由useEffect统一处理
      // 对所有任务都获取私信状态，不进行筛选
      setTimeout(async () => {
        await fetchTaskMarketState(taskId);
      }, 200);
    }
  };

  // 使用useMemo优化currentTask计算
  const currentTask = useMemo(() => {
    return filteredTasks.find(item => item.task_id === selectedTaskId);
  }, [filteredTasks, selectedTaskId]);

  // 从后端获取私信内容
  const fetchBackendMessage = useCallback(async (taskId: string, keyword: string) => {
    try {
      
      // 检查缓存，避免重复请求
      const cacheKey = `backend_message_${taskId}`;
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        try {
          const cachedData = JSON.parse(cached);
          const cacheTime = cachedData.timestamp;
          const now = Date.now();
          // 缓存1分钟
          if (now - cacheTime < 60 * 1000) {
            if (cachedData.message) {
              setInputValue(cachedData.message);
              return;
            }
          } else {
          }
        } catch (error) {
          // 缓存解析失败，继续执行
        }
      }
      
      const response = await getUserSatisfactionApi(taskId);
      
      if (response && response.status === 200 && response.data && response.data.message) {
        // 有后端返回的内容
        const backendMessage = response.data.message;
        setInputValue(backendMessage);
        
        // 缓存结果
        sessionStorage.setItem(cacheKey, JSON.stringify({
          message: backendMessage,
          timestamp: Date.now()
        }));
        
        // 同时更新缓存，避免下次重复请求
        setTaskInputCache(prev => ({
          ...prev,
          [taskId]: backendMessage
        }));
        localStorage.setItem(`task_input_${taskId}`, backendMessage);
        
        return; // 有后端内容就直接返回
      }
      
      // 后端没有内容，显示默认模板
      const defaultMessage = `有${keyword}需求吗？`;
      setInputValue(defaultMessage);
      
    } catch (error) {
      console.error('❌ PrivateMessage 获取后端私信内容失败:', error);
      
      // 出错时显示默认模板
      const defaultMessage = `有${keyword}需求吗？`;
      setInputValue(defaultMessage);
    }
  }, [inputValue]);

  // 当选中任务变化时，自动设置输入框的默认值
  useEffect(() => {
    if (selectedTaskId && currentTask) {
      
      // 修复：当用户正在编辑时，不要自动恢复缓存内容
      // 只有当用户没有在编辑时，才自动设置新任务的内容
      if (!isUserEditing) {
        // 优先级1：缓存内容
        const cachedContent = taskInputCache[selectedTaskId];
        if (cachedContent) {
          setInputValue(cachedContent);
          return; // 有缓存内容就直接返回，不继续执行
        }
        
        // 优先级2：后端返回内容 - 从getUserSatisfactionApi获取
        fetchBackendMessage(selectedTaskId, currentTask.keyword);
      } else {
      }
    }
  }, [selectedTaskId, currentTask?.keyword, isUserEditing]); // 修复：移除fetchBackendMessage依赖，避免无限循环

  // 处理输入框内容变化，自动保存到对应任务的缓存中
  const handleInputChange = useCallback((value: string) => {
    
    // 标记用户正在编辑
    setIsUserEditing(true);
    
    setInputValue(value);
    
    // 如果有选中的任务，将内容保存到该任务的缓存中
    if (selectedTaskId) {
      // 修复：当用户删除内容时，也要更新缓存，支持完全清空
      const newValue = value.trim() === '' ? '' : value; // 空字符串也保存到缓存
      
      setTaskInputCache(prev => ({
        ...prev,
        [selectedTaskId]: newValue
      }));
      
      // 同时保存到 localStorage 中，确保页面刷新后不丢失
      localStorage.setItem(`task_input_${selectedTaskId}`, newValue);
      
    }
  }, [selectedTaskId, inputValue]);

  // 重置用户编辑状态 - 当用户完成编辑时调用
  const resetUserEditing = useCallback(() => {
    setIsUserEditing(false);
  }, []);

  // 页面初始化时，从 localStorage 恢复任务输入框内容缓存
  useEffect(() => {
    const restoreTaskInputCache = () => {
      const cache: Record<string, string> = {};
      // 遍历所有任务，尝试从 localStorage 恢复缓存内容
      tasks.forEach(task => {
        const cachedContent = localStorage.getItem(`task_input_${task.task_id}`);
        if (cachedContent) {
          cache[task.task_id] = cachedContent;
        }
      });
      setTaskInputCache(cache);
    };

    if (tasks.length > 0) {
      restoreTaskInputCache();
    }
  }, [tasks]);

  // 表格列配置
  const columns = [
    { 
      title: '用户昵称', 
      dataIndex: 'user_name', 
      key: 'user_name',
      width: 150,
      render: (text: string, record: DetailItem) => {
        // 如果用户链接存在，则渲染为可点击的链接
        if (record.user_link) {
          return (
            <a 
              href={record.user_link} 
              target="_blank" 
              rel="noopener noreferrer"
              style={{ 
                color: '#1890ff', 
                textDecoration: 'none',
                cursor: 'pointer',
                fontWeight: '500'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.textDecoration = 'underline';
                e.currentTarget.style.color = '#40a9ff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.textDecoration = 'none';
                e.currentTarget.style.color = '#1890ff';
              }}
              title="点击查看用户主页"
            >
              {text || '未知用户'}
            </a>
          );
        }
        // 如果没有链接，则显示普通文本
        return <span style={{ color: '#666' }}>{text || '未知用户'}</span>;
      }
    },
    { 
      title: (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>IP地址</span>
          <RegionFilter 
            onFilter={(values) => handleFilter('userRegion', values.join(','))}
            detailData={detailData}
            taskId={selectedTaskId || undefined}
            tasks={tasks}
            messageAllUsers={messageAllUsers}
          />
        </div>
      ), 
      dataIndex: 'user_region', 
      key: 'user_region',
      width: 120
    },
    { 
      title: '评论时间', 
      dataIndex: 'comment_time', 
      key: 'comment_time', 
      width: 120,
      render: (val: string) => val || '-' 
    },
    { 
      title: (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>评论内容</span>
          <CommentContentFilter 
            onFilter={(value) => handleFilter('commentContent', value)}
            onClear={() => {
              // 清除评论内容筛选标记
              setIsCommentContentFiltering(false);
              // 清除筛选状态
              const clearedFilters = {
                commentTime: '',
                userNickname: '',
                userRegion: '',
                commentContent: ''
              };
              setFilters(clearedFilters);
              // 重新获取原始数据
              if (selectedTaskId) {
                fetchMarketData(selectedTaskId, 1, pageSize);
              }
            }}
          />
        </div>
      ), 
      dataIndex: 'comment_content', 
      key: 'comment_content',
      width: 300,
      ellipsis: true,
      render: (text: string, record: DetailItem) => {
        // 如果内容链接存在，则渲染为可点击的链接
        if (record.content_link) {
          return (
            <a 
              href={record.content_link} 
              target="_blank" 
              rel="noopener noreferrer"
              style={{ 
                color: '#1890ff', 
                textDecoration: 'none',
                cursor: 'pointer',
                fontWeight: '500'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.textDecoration = 'underline';
                e.currentTarget.style.color = '#40a9ff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.textDecoration = 'none';
                e.currentTarget.style.color = '#1890ff';
              }}
              title="点击查看评论内容"
            >
              {text || '无内容'}
            </a>
          );
        }
        // 如果没有链接，则显示普通文本
        return (
          <div style={{ 
            maxWidth: '280px', 
            overflow: 'hidden', 
            textOverflow: 'ellipsis', 
            whiteSpace: 'nowrap' 
          }} title={text}>
            {text || '无内容'}
          </div>
        );
      }
    },
    { 
      title: '私信结果', 
      dataIndex: 'market_state', 
      key: 'market_state', 
      width: 120,
      render: (val: string, record: DetailItem) => {
        const displayText = record.market_result_display || marketStateMap[val as keyof typeof marketStateMap] || '未私信';
        
        // 根据显示文本和状态确定颜色
        let tagColor: string;
        
        if (displayText.includes('已私信') || displayText.includes('成功') || val === 'finish') {
          tagColor = 'green';
        } else if (displayText.includes('私信中') || displayText.includes('进行中') || val === 'processing') {
          tagColor = 'orange';
        } else if (displayText.includes('私信失败') || displayText.includes('失败') || val === 'failed') {
          tagColor = 'red';
        } else if (displayText.includes('未私信') || val === 'initial') {
          tagColor = 'blue';
        } else {
          tagColor = 'gray';
        }
        
        return (
          <Tag color={tagColor}>
            {displayText}
          </Tag>
        );
      }
    }
  ];
  // 分页工具栏组件
  // const PaginationToolbar = ({ children }: { children: React.ReactNode }) => (
  //   <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
  //     {children}
  //   </div>
  // );
  return (
    <Layout style={{ height: 'calc(100vh - 56px)', background: '#fff', overflow: 'hidden' }}>
      <Layout style={{ height: '100vh', flexDirection: 'row', overflow: 'hidden' }}>
        <TaskSidebar
          tasks={filteredTasks}
          loading={taskLoading}
          selectedTaskId={selectedTaskId}
          onTaskSelect={handleTaskSelect}
          pageType="privateCustomer"
          hasMoreTasks={calculateHasMoreTasks()}
          isLoadingMore={isLoadingMore}
          onLoadMore={handleLoadMore}
        />
        {/* 任务筛选提示 */}
        {filteredTasks.length === 0 && !taskLoading && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            textAlign: 'center',
            color: '#86909c',
            fontSize: '14px',
            zIndex: 1000
          }}>
            <div style={{ marginBottom: '8px' }}>
              📋 暂无任务
            </div>
            <div style={{ fontSize: '12px', color: '#c9cdd4' }}>
              请先创建任务，任务将自动显示在此处
            </div>
          </div>
        )}
        <Content style={{ 
          flex: 1, 
          margin: 16, 
          background: '#fff', 
          borderRadius: 8, 
          minWidth: 0, 
          overflow: 'auto',
          height: '100%'
        }}>
          {/* 添加CSS样式来隐藏滚动条和自定义进度条 */}
          <style>
            {`
              /* 隐藏Content区域的滚动条但保持滚动功能 */
              .arco-layout-content::-webkit-scrollbar,
              .arco-layout-content *::-webkit-scrollbar {
                width: 0 !important;
                height: 0 !important;
                display: none !important;
              }
              
              .arco-layout-content,
              .arco-layout-content * {
                scrollbar-width: none !important;
                -ms-overflow-style: none !important;
              }
              
              /* 隐藏所有可能的滚动条 */
              *::-webkit-scrollbar {
                width: 0 !important;
                height: 0 !important;
                display: none !important;
              }
              
              * {
                scrollbar-width: none !important;
                -ms-overflow-style: none !important;
              }
              
              /* 自定义进度条样式 - 与分析页面保持一致 */
              .arco-progress-line .arco-progress-line-inner {
                border-radius: 12px !important;
                height: 8px !important;
                background-color: rgb(144, 207, 255) !important;
              }
              
              .arco-progress-line .arco-progress-line-outer {
                border-radius: 12px !important;
                height: 8px !important;
                background-color: #f0f0f0 !important;
              }
            `}
          </style>
          {/* 认证状态提示 */}
          {!isAuthenticated && (
            <Alert
              type="warning"
              content="未检测到登录状态，部分功能可能无法正常使用。请先登录。"
              action={
                <Button size="small" type="primary" onClick={() => window.location.href = '/login'}>
                  前往登录
                </Button>
              }
              style={{ marginBottom: '16px' }}
            />
          )}
          
          {/* 顶部标题区域 */}
          <PrivateMessageHeader 
            currentTask={currentTask} 
            progressData={progressData} 
            messageAllUsers={messageAllUsers}
          />
          


          {/* 私信话术输入区域 */}
          <PrivateMessageFormWithTags
            inputValue={inputValue}
            onInputChange={handleInputChange}
            onBlur={resetUserEditing} // 传递失焦回调，重置编辑状态
            currentTaskKeyword={currentTask?.keyword}
            taskId={selectedTaskId || undefined}
          />

          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 16,
            marginLeft: 10,
            gap: '20px'
          }}>
            {/* 左侧：导航标签和进度条 */}
            <div ref={containerRef} style={{ display: 'flex', alignItems: 'center', flex: '1' }}>
              <PrivateMessageTabs
                activeTab={activeTab}
                onTabChange={setActiveTab}
                progressData={memoizedProgressData}
                isProgressLoading={isProgressLoading}
              />
            </div>
            
            {/* 右侧：分页器 - 与分析页面样式保持一致 */}
            {activeTab !== 'private-message' && (
              <div style={{ display: 'flex', alignItems: 'center', height: '100%', flex: '0 0 auto' }}>
                {displayTotal > 0 && (
                  <Pagination
                    current={currentPage}
                    pageSize={pageSize}
                    total={displayTotal}
                    onChange={handlePaginationChange}
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
            )}
          </div>

          <div style={{ marginLeft: 0, marginRight: 10, marginTop: 20, marginBottom: 20 }}>
            {activeTab === 'customers' ? (
              <div style={{ position: 'relative', width: '100%' }}>

                <Table
                  columns={columns}
                  data={displayData}
                  loading={loading}
                  rowKey={(record: DetailItem) => {
                    // 修复：使用record.key，它已经在fetchMarketData中设置为唯一值
                    return record.key;
                  }}
                  pagination={false}
                  scroll={{ x: 800 }}
                  size="small"
                  border={true}
                />
              </div>
            ) : (
              <div>
                <DouyinAccountTable
                  douyinAccounts={douyinAccounts}
                  accountsLoading={accountsLoading}
                  tasks={tasks}
                  messagingAccounts={messagingAccounts}
                  handleAddDouyinAccount={handleAddDouyinAccount}
                  handleStartMessaging={handleStartMessaging}
                  handleStopMessaging={handleStopMessaging}
                  handleLoginDouyinAccount={handleLoginDouyinAccount}
                  currentTaskId={selectedTaskId || undefined}
                  onAccountsUpdate={setDouyinAccounts}
                  onlyMessageFilteredUsers={onlyMessageFilteredUsers}
                  onOnlyMessageFilteredUsersChange={setOnlyMessageFilteredUsers}
                  filteredUserRegions={filters.userRegion ? filters.userRegion.split(',').filter((r: string) => r.trim()) : []}
                  // 传递当前任务的输入框内容
                  currentTaskMessageText={selectedTaskId ? taskInputCache[selectedTaskId] || `有${currentTask?.keyword || ''}需求吗？` : ''}
                  // 传递筛选状态信息，用于显示筛选成功的提示
                  hasFilters={!!(filters.commentContent || filters.userNickname || filters.commentTime || filters.userRegion)}
                  filterInfo={{
                    commentContent: filters.commentContent,
                    userNickname: filters.userNickname,
                    commentTime: filters.commentTime,
                    userRegion: filters.userRegion
                  }}
                  // 新增：私信全部用户相关props
                  messageAllUsers={messageAllUsers}
                  onMessageAllUsersChange={setMessageAllUsersWithSave}
                  // 新增：传递筛选后的用户ID列表，用于内容筛选后的私信
                  filteredUserIds={filteredUserIds}
                  // 新增：评论内容筛选关键词
                  commentKeywordFilter={filters.commentContent}
                  // 使用更稳定的key，减少不必要的重新渲染
                  key={`douyin-table-${selectedTaskId || 'no-task'}`}
                />
              </div>
            )}
          </div>
        </Content>
      </Layout>
    </Layout>
  );
}