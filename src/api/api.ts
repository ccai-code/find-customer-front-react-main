import CryptoJS from 'crypto-js';

// 扩展Window接口以支持缓存
declare global {
  interface Window {
    taskTotalCache?: {
      [key: string]: {
        value: number;
        timestamp: number;
      };
    };
    userSatisfactionCache?: {
      [key: string]: {
        value: any; // 可以根据实际返回数据类型调整
        timestamp: number;
      };
    };
    marketProgressCache?: {
      [key: string]: {
        value: any; // 营销进度数据
        timestamp: number;
      };
    };
    marketListCache?: {
      [key: string]: {
        value: any; // 营销列表数据
        timestamp: number;
      };
    };
    quotaCache?: {
      [key: string]: {
        value: any; // 额度数据
        timestamp: number;
      };
    };
  }
}

// 通用401错误处理函数
export function handle401Error() {
  console.error('认证失败(401)，重定向到登录页面');
  // 清除所有认证相关数据
  localStorage.removeItem('token');
  localStorage.removeItem('userInfo');
  
  // 强制跳转到登录页面，使用replace避免浏览器历史记录问题
  if (window.location.pathname !== '/login') {
    window.location.replace('/login');
  }
}

// 类型定义
export interface Task {
  task_id: string;
  keyword: string;
  platform: string;
  analysis_state?: string;
  market_state?: string;
  progress?: number;
  market_progress?: number; // 私信进度
  progressData?: {
    num: number;
    sum: number;
    state: number;
  };
  hasPrivateCustomers?: boolean;
  intent_count?: number;
  crawler_progress?: number; // 收集评论数量
  analysis_progress?: number; // 分析评论数量
  crawler_state?: string; // 收集状态
}

export interface TaskListState {
  tasks: Task[];
  loading: boolean;
  hasMoreTasks: boolean;
  isLoadingMore: boolean;
  selectedTaskId: string | null;
}

export interface ApiResponse<T = any> {
  code: number;
  message: string;
  data: T;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  username: string;
  status?: number;
  msg?: string;
  success?: boolean;
  error?: string;
}

export interface UserInfoResponse {
  data: {
    package_type: number;
    subscription_end_date: number;
  };
  msg: string;
  status: number;
}

// 通用请求函数
async function loginRequest(url: string, options: RequestInit = {}) {
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Request failed:', error);
    throw error;
  }
}

// API 函数
export const api = {
  // 登录接口
  login: async (username: string, password: string): Promise<LoginResponse> => {
    try {
      // 通过URL查询参数传递用户名和密码，使用POST请求
      const loginUrl = `https://chat.zhihua.chat/login?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;
      const response = await loginRequest(loginUrl, {
        method: 'POST', // 保持POST请求，但通过URL参数传递数据
      });
      
      // 确保响应中包含用户名信息
      if (response && (response.status === 200 || response.msg === 'success' || response.success)) {
        return {
          ...response,
          username: username // 确保返回的用户名是解码后的中文
        };
      }
      
      return response;
    } catch (error) {
      throw error;
    }
  },

  // 获取用户信息接口
  getUserInfo: async (): Promise<UserInfoResponse> => {
    try {
      const token = await getToken();
      if (!token) {
        throw new Error('No token found');
      }

      // 检查token是否已经包含Bearer前缀，避免重复添加
      const authHeader = token.startsWith('Bearer ') ? token : `Bearer ${token}`;

      const response = await fetch(`https://chat.zhihua.chat/user_info`, {
        method: 'GET',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('获取用户信息失败:', error);
      throw error;
    }
  },
};

// 单独导出登录函数
export const login = api.login;

// 单独导出获取用户信息函数
export const getUserInfo = api.getUserInfo;

// 使用硬编码的API地址
const normalServiceUrl = 'https://chat.zhihua.chat';

// Token Management
async function getToken() {
  const token = localStorage.getItem('token');
  // 与目标系统保持一致：直接返回token，不进行额外处理
  return token || null;
}

// 统一的token管理函数，确保与目标系统逻辑一致
export function setToken(token: string) {
  localStorage.setItem('token', token);
}

export function removeToken() {
  localStorage.removeItem('token');
  localStorage.removeItem('userInfo');
}

export function getStoredToken() {
  return localStorage.getItem('token');
}

export function getStoredUserInfo() {
  const userInfoStr = localStorage.getItem('userInfo');
  return userInfoStr ? JSON.parse(userInfoStr) : null;
}

// 全局请求频率限制器
const globalRequestLimiter = {
  lastRequestTime: 0,
  minRequestInterval: 1000, // 最小请求间隔1秒
  pendingRequests: new Map<string, Promise<any>>()
};

// Generic API Functions
export async function fetchApi(url: string, options: RequestInit = {}, retryCount = 0): Promise<any> {
  try {
    // 检查请求频率限制
    const now = Date.now();
    if (now - globalRequestLimiter.lastRequestTime < globalRequestLimiter.minRequestInterval) {
      // 延迟重试
      await new Promise(resolve => 
        setTimeout(resolve, globalRequestLimiter.minRequestInterval - (now - globalRequestLimiter.lastRequestTime))
      );
    }
    
    // 更新最后请求时间
    globalRequestLimiter.lastRequestTime = Date.now();
    
    // 检查是否有相同的请求正在进行
    const requestKey = `${url}_${JSON.stringify(options)}`;
    if (globalRequestLimiter.pendingRequests.has(requestKey)) {
      try {
        const result = await globalRequestLimiter.pendingRequests.get(requestKey);
        return result;
      } catch (error) {
        console.warn('等待的请求失败，继续发起新请求:', error);
      }
    }
    
    const token = await getToken();
    
    if (token) {
      // 检查token是否已经包含Bearer前缀，避免重复添加
      const authHeader = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
      options.headers = {
        ...(options.headers || {}),
        'Authorization': authHeader
      };
     
    } else {
      console.error('API调用失败 - 未找到认证token，重定向到登录页面');
      // 使用统一的token管理函数，确保与登录逻辑保持一致
      removeToken();
      window.location.href = '/login';
      return;
    }

    if (!options.headers || !('Content-Type' in options.headers)) {
      options.headers = {
        ...options.headers,
        'Content-Type': 'application/json'
      };
    }

    const fetchOptions = {
      ...options,
      mode: 'cors' as RequestMode,
      credentials: 'same-origin' as RequestCredentials,
      signal: AbortSignal.timeout(30000) // 添加超时控制，30秒
    };

    // 记录正在进行的请求
    const fetchPromise = fetch(url, fetchOptions).then(async (response) => {
      if (response.status === 401) {
        console.error('API调用：认证失败(401)，重定向到登录页面');
        window.location.href = '/login';
        return;
      }

      if (response.status !== 200) {
        console.error(`API调用：HTTP ${response.status} - ${response.statusText}`);
        return {
          success: false,
          error: `HTTP ${response.status}: ${response.statusText}`,
          data: null,
          status: response.status,
          msg: 'error'
        };
      }

      const data = await response.json();
      return data;
    });
    
    globalRequestLimiter.pendingRequests.set(requestKey, fetchPromise);
    
    try {
      const result = await fetchPromise;
      return result;
    } finally {
      // 清理请求记录
      globalRequestLimiter.pendingRequests.delete(requestKey);
    }

  } catch (error) {
    console.error('API调用异常:', error);
    
    // 如果是网络错误且还有重试次数，则重试
    if (retryCount < 3 && isNetworkError(error)) {
      console.log(`网络错误，1000ms后进行第${retryCount + 1}次重试...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
      return fetchApi(url, options, retryCount + 1);
    }
    
    return {
      success: false,
      error: (error as Error).message || '网络请求失败',
      data: null,
      status: 0,
      msg: 'error'
    };
  }
}

// 判断是否为网络错误的辅助函数
function isNetworkError(error: any): boolean {
  const networkErrors = [
    'Failed to fetch',
    'NetworkError',
    'ERR_PROXY_CONNECTION_FAILED',
    'ERR_CONNECTION_REFUSED',
    'ERR_NETWORK',
    'ERR_INTERNET_DISCONNECTED'
  ];
  
  return networkErrors.some(errMsg => 
    error.message && error.message.includes(errMsg)
  );
}

// 获取任务列表
export async function getTaskListApi(offset: number, count: number) {
  
  try {
    const response = await fetchApi(`${normalServiceUrl}/task_list?offset=${offset}&count=${count}`, {
      method: 'GET',
    });
    
    
    // 移除重复的总数获取请求，避免分页时的额外延迟
    // 总数应该通过专门的接口获取，或者在第一页时获取一次即可
    return response;
  } catch (error) {
    console.error('❌ getTaskListApi 请求失败:', { offset, count, error });
    throw error;
  }
}

// 获取任务总数
export async function getTaskTotalApi() {
  // 添加内存缓存，避免短时间内重复请求
  const cacheKey = 'task_total_count';
  const cacheExpiry = 10 * 60 * 1000; // 10分钟缓存，减少请求频率
  
  // 检查内存缓存
  if (window.taskTotalCache && window.taskTotalCache[cacheKey]) {
    const cached = window.taskTotalCache[cacheKey];
    if (Date.now() - cached.timestamp < cacheExpiry) {
      return cached.value;
    }
  }
  
  try {
    // 只发送一次请求，获取一个合理的数量来估算总数
    // 使用较大的count值来减少请求次数，但不会太大影响性能
    const response = await fetchApi(`${normalServiceUrl}/task_list?offset=0&count=50`, {
      method: 'GET',
    });
    
    let total = 0;
    
    if (response.status === 200 && response.data) {
      // 如果API返回了总数信息，直接使用
      if (response.data.total_count !== undefined) {
        total = response.data.total_count;
      }
      // 如果没有总数信息，但有任务列表，则返回列表长度
      else if (response.data.task_list) {
        total = response.data.task_list.length;
      }
    }
    
    // 缓存结果
    if (!window.taskTotalCache) {
      window.taskTotalCache = {};
    }
    window.taskTotalCache[cacheKey] = {
      value: total,
      timestamp: Date.now()
    };
    
    return total;
  } catch (error) {
    console.error('获取任务总数失败:', error);
    return 0;
  }
}

// 获取评论列表
export async function getCommentListByTaskIdApi(taskId: string, page: number, size: number, filters: any, isAll: boolean = false) {
  const offset = (page - 1) * size;
  
  // 构建查询参数
  const params = new URLSearchParams({
    task_id: taskId,
    offset: offset.toString(),
    count: size.toString(),
    is_all: isAll ? '1' : '0'  // 添加is_all参数
  });
  
  // 添加filters参数，即使为空对象也要传递
  if (filters) {
    params.append('filters', JSON.stringify(filters));
  }
  
  const url = `${normalServiceUrl}/comments?${params.toString()}`;
  
  const response = await fetchApi(url, {
    method: 'GET',
  });
  
  return response;
}

// 获取分析进度
export async function getAnalysisProgressApi(taskId: string) {
  // 根据正确接口，progress接口只需要task_id和step_type参数，不需要platform参数
  return fetchApi(`${normalServiceUrl}/progress?task_id=${taskId}&step_type=2`, {
    method: 'GET',
  });
}

// 获取评论（兼容旧版本）
export async function getCommentsApi(taskId: string) {
  return fetchApi(`${normalServiceUrl}/comments?task_id=${taskId}`, {
    method: 'GET',
  });
}

// 获取用户评论收集额度
export async function getQuoteApi() {
  const cacheKey = 'user_quota';
  const cacheExpiry = 5 * 60 * 1000; // 5分钟缓存


  // 检查内存缓存
  if (window.quotaCache && window.quotaCache[cacheKey]) {
    const cached = window.quotaCache[cacheKey];
    const timeDiff = Date.now() - cached.timestamp;
    
    if (timeDiff < cacheExpiry) {
      return cached.value;
    } else {
    }
  }


  const response = await fetchApi(`${normalServiceUrl}/quota`, {
    method: 'GET',
  });

  // 缓存结果
  if (!window.quotaCache) {
    window.quotaCache = {};
  }
  window.quotaCache[cacheKey] = {
    value: response,
    timestamp: Date.now()
  };


  return response;
}



// 提交评论收集任务
export async function createCommentCrawlerTaskApi(data: {
  platform: string;        // 平台：dy(抖音) 或 xhs(小红书)
  keyword: string;         // 关键词
  awemes: Array<{         // 视频列表
    id: string;           // 视频ID
    title: string;        // 视频标题
    xsec_token: string;   // token值
  }>;
}) {
  return fetchApi(`${normalServiceUrl}/comment_crawler`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// 创建爬虫任务获取 task_id
export async function createCrawlerTaskApi(data: {
  platform: string;        // 平台：dy(抖音) 或 xhs(小红书)
  keyword: string;         // 关键词
  awemes: Array<{         // 视频列表
    id: string;           // 视频ID
    title: string;        // 视频标题
    xsec_token: string;   // token值
  }>;
  lt: string;             // 登录类型
  crawler_type: string;   // 爬虫类型
  start_page: number;     // 起始页
}) {
  return fetchApi(`${normalServiceUrl}/comment_crawler`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// 获取营销用户
export async function getSimpleMarketingUserApi(data: {
  task_id: string;
  task_step_type: number;
  ip_location?: string;
  start_time?: number;
  end_time?: number;
}) {
  return fetchApi(`${normalServiceUrl}/get_simple_marketing_user`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// ========== Coze API 相关 ==========
const cozeModelServiceUrl = 'https://api.coze.cn/open_api/v2/chat';
const myToken = 'sat_FHx8TSWEqomJEzQE9u6lwwbsuRtaX1JC2QFB8b7S3XwzpbWU76J8azFp8rgJOOWW';

const chatbotMap = {
    "keyword": "7398469657676070947",
    "template": "7549030723194667008",
    "message": "7397788287782027304"
};

// 检查localStorage中是否已经存在user_id
const checkAndGenerateUserId = () => {
    const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
    if (userInfo.user_id) {
        return userInfo.user_id;
    }
    const username = userInfo.username;
    if (!username) {
        console.error('Username not found in userInfo');
        const defaultUserId = 'default_' + Math.random().toString(36).substring(2, 15);
        userInfo.user_id = defaultUserId;
        localStorage.setItem('userInfo', JSON.stringify(userInfo));
        return defaultUserId;
    }
    const userIdHash = CryptoJS.SHA256(username).toString();
    const userId = userIdHash.substring(0, 14);
    userInfo.user_id = userId;
    localStorage.setItem('userInfo', JSON.stringify(userInfo));
    return userId;
};

const generateConversationId = () => {
    return Math.floor(Math.random() * 9999) + 1;
};

const cozeOptions = {
    headers: {
        'Authorization': `Bearer ${myToken}`,
        'Content-Type': 'application/json',
        'Accept': '*/*',
        'Host': 'api.coze.cn',
        'Connection': 'keep-alive'
    }
};

// Model Service Functions
export async function postChatModel(query: string, mode: string) {
    const conversationId = generateConversationId().toString();
    const botId = chatbotMap[mode as keyof typeof chatbotMap];
    const userId = checkAndGenerateUserId();
    
    const data = {
        "conversation_id": conversationId,
        "bot_id": botId,
        "user": userId,
        "query": query,
        "stream": false,
    };
    
    console.log('postChatModel: 请求数据:', data);
    console.log('postChatModel: 请求头:', cozeOptions.headers);
    console.log('postChatModel: Bot ID:', botId);
    console.log('postChatModel: User ID:', userId);
    console.log('postChatModel: Conversation ID:', conversationId);
    
    const response = await fetch(`${cozeModelServiceUrl}`, {
        headers: { ...cozeOptions.headers },
        method: 'POST',
        body: JSON.stringify(data),
    });
    
    const responseData = await response.json();
    console.log('postChatModel: 响应状态:', response.status);
    console.log('postChatModel: 响应数据:', responseData);
    
    return responseData;
}

// ========== Task Service 相关 ==========
class TaskService {
  private static instance: TaskService;
  private taskCache: Map<string, Task> = new Map();
  private taskListCache: Map<string, { tasks: Task[], total: number }> = new Map();
  private taskTotalCache: Map<string, number> = new Map();
  private cacheExpiry: Map<string, number> = new Map();
  private readonly CACHE_DURATION = 10 * 60 * 1000; // 10分钟缓存，进一步减少请求

  private constructor() {}

  public static getInstance(): TaskService {
    if (!TaskService.instance) {
      TaskService.instance = new TaskService();
    }
    return TaskService.instance;
  }

  /**
   * 获取任务列表
   */
  async getTaskList(offset: number = 0, count: number = 50): Promise<{ tasks: Task[], total: number }> {
    
    try {
      // 使用缓存键来避免重复请求
      const cacheKey = `task_list_${offset}_${count}`;
      const now = Date.now();
      
      // 检查缓存
      if (this.taskListCache.has(cacheKey)) {
        const expiry = this.cacheExpiry.get(cacheKey);
        if (expiry && now < expiry) {
          const cached = this.taskListCache.get(cacheKey);
          if (cached) {
            return cached;
          }
        }
        // 缓存过期，删除
        this.taskListCache.delete(cacheKey);
        this.cacheExpiry.delete(cacheKey);
      }

      // 检查是否有相似的缓存数据可以使用（比如offset=0的数据）
      if (offset > 0) {
        const baseCacheKey = `task_list_0_${count}`;
        if (this.taskListCache.has(baseCacheKey)) {
          const baseExpiry = this.cacheExpiry.get(baseCacheKey);
          if (baseExpiry && now < baseExpiry) {
            const baseCached = this.taskListCache.get(baseCacheKey);
            if (baseCached && baseCached.tasks.length > offset) {
              const slicedTasks = baseCached.tasks.slice(offset, offset + count);
              return {
                tasks: slicedTasks,
                total: baseCached.total
              };
            }
          }
        }
      }

      const response = await getTaskListApi(offset, count);
      if (response.status === 200) {
        const apiTasks = response.data.task_list || [];
        const validTasks = apiTasks.filter((task: any) => task && task.task_id);
        
        // console.log('API返回的原始任务数据:', apiTasks);
        // console.log('验证后的任务数据:', validTasks);
        
        // 转换API数据格式为统一格式
        const normalizedTasks: Task[] = validTasks.map((task: any) => {
          const normalizedTask = {
            task_id: task.task_id,
            keyword: task.keyword,
            platform: task.platform,
            analysis_state: task.analysis_state || 'initial',
            market_state: task.market_state || 'initial',
            progress: task.progress || 0,
            market_progress: task.market_progress || 0, // 添加market_progress
            progressData: task.progress_data || { num: 0, sum: 0, state: 0 },
            hasPrivateCustomers: task.has_private_customers || false,
            intent_count: task.intent_count || 0,
            crawler_progress: task.crawler_progress || 0, // 添加收集评论数量
            analysis_progress: task.analysis_progress || 0, // 添加分析评论数量
            crawler_state: task.crawler_state || 'initial' // 添加收集状态
          };
          return normalizedTask;
        });

        const result = {
          tasks: normalizedTasks,
          total: response.total_count || normalizedTasks.length
        };

        // 设置缓存，避免重复请求
        this.taskListCache.set(cacheKey, result);
        this.cacheExpiry.set(cacheKey, now + this.CACHE_DURATION);

        return result;
      }
      return { tasks: [], total: 0 };
    } catch (error) {
      console.error('获取任务列表失败:', error);
      
      // 如果是503错误，尝试使用缓存数据
      if (error instanceof Error && error.message.includes('503')) {
        console.warn('🛑 服务器503错误，尝试使用缓存数据');
        
        // 尝试使用offset=0的缓存数据
        const baseCacheKey = `task_list_0_50`;
        if (this.taskListCache.has(baseCacheKey)) {
          const baseExpiry = this.cacheExpiry.get(baseCacheKey);
          if (baseExpiry && Date.now() < baseExpiry) {
            const baseCached = this.taskListCache.get(baseCacheKey);
            if (baseCached && baseCached.tasks.length > offset) {
              const slicedTasks = baseCached.tasks.slice(offset, offset + count);
              return {
                tasks: slicedTasks,
                total: baseCached.total
              };
            }
          }
        }
      }
      
      return { tasks: [], total: 0 };
    }
  }

  /**
   * 获取任务总数（单独方法，避免重复请求）
   */
  async getTaskTotal(): Promise<number> {
    try {
      const cacheKey = 'task_total_count';
      const now = Date.now();
      
      // 检查缓存
      if (this.taskTotalCache.has(cacheKey)) {
        const expiry = this.cacheExpiry.get(cacheKey);
        if (expiry && now < expiry) {
          const cached = this.taskTotalCache.get(cacheKey);
          if (cached !== undefined) {
            return cached;
          }
        }
        // 缓存过期，删除
        this.taskTotalCache.delete(cacheKey);
        this.cacheExpiry.delete(cacheKey);
      }

      // 导入getTaskTotalApi函数
      const { getTaskTotalApi } = await import('./api');
      const total = await getTaskTotalApi();
      
      // 缓存总数，设置较长的缓存时间（5分钟）
      this.taskTotalCache.set(cacheKey, total);
      this.cacheExpiry.set(cacheKey, now + 5 * 60 * 1000);
      
      return total;
    } catch (error) {
      console.error('获取任务总数失败:', error);
      return 0;
    }
  }

  /**
   * 获取单个任务的详细信息（包括状态和进度）
   */
  async getTaskDetails(taskId: string): Promise<Task | null> {
    const cacheKey = `task_${taskId}`;
    const now = Date.now();

    // 检查缓存
    if (this.taskCache.has(cacheKey)) {
      const expiry = this.cacheExpiry.get(cacheKey);
      if (expiry && now < expiry) {
        return this.taskCache.get(cacheKey) || null;
      }
      // 缓存过期，删除
      this.taskCache.delete(cacheKey);
      this.cacheExpiry.delete(cacheKey);
    }

    try {
      // 这里可以调用具体的任务详情API
      // 暂时返回null，由具体页面处理
      return null;
    } catch (error) {
      console.error(`获取任务${taskId}详情失败:`, error);
      return null;
    }
  }

  /**
   * 更新任务状态
   */
  updateTaskStatus(taskId: string, updates: Partial<Task>): void {
    const cacheKey = `task_${taskId}`;
    const existingTask = this.taskCache.get(cacheKey);
    
    if (existingTask) {
      const updatedTask = { ...existingTask, ...updates };
      this.taskCache.set(cacheKey, updatedTask);
      this.cacheExpiry.set(cacheKey, Date.now() + this.CACHE_DURATION);
    }
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.taskCache.clear();
    this.taskListCache.clear();
    this.taskTotalCache.clear();
    this.cacheExpiry.clear();
  }

  /**
   * 清除任务列表缓存
   */
  clearTaskListCache(): void {
    this.taskListCache.clear();
    // 只清除任务列表相关的缓存过期时间
    for (const [key] of this.cacheExpiry) {
      if (key.startsWith('task_list_')) {
        this.cacheExpiry.delete(key);
      }
    }
  }

  /**
   * 获取缓存的任务
   */
  getCachedTask(taskId: string): Task | null {
    const cacheKey = `task_${taskId}`;
    const now = Date.now();
    const expiry = this.cacheExpiry.get(cacheKey);

    if (expiry && now < expiry) {
      return this.taskCache.get(cacheKey) || null;
    }

    return null;
  }

  /**
   * 设置缓存的任务
   */
  setCachedTask(taskId: string, task: Task): void {
    const cacheKey = `task_${taskId}`;
    this.taskCache.set(cacheKey, task);
    this.cacheExpiry.set(cacheKey, Date.now() + this.CACHE_DURATION);
  }
}

export default TaskService;

// 私信相关的API函数
export async function getMarketListByTaskIdApi(task_id: string, offset: number, count: number) {
    const cacheKey = `market_list_${task_id}_${offset}_${count}`;
    const cacheExpiry = 10 * 60 * 1000; // 增加到10分钟缓存，减少请求频率

    // 检查内存缓存
    if (window.marketListCache && window.marketListCache[cacheKey]) {
      const cached = window.marketListCache[cacheKey];
      if (Date.now() - cached.timestamp < cacheExpiry) {
        return cached.value;
      }
    }

    // 检查是否有相似的缓存数据可以使用（比如offset=0的数据）
    if (offset > 0) {
      const baseCacheKey = `market_list_${task_id}_0_${count}`;
      if (window.marketListCache && window.marketListCache[baseCacheKey]) {
        const baseCached = window.marketListCache[baseCacheKey];
        if (Date.now() - baseCached.timestamp < cacheExpiry) {
          // 尝试从基础缓存中切片数据
          if (baseCached.value && baseCached.value.data && baseCached.value.data.length > offset) {
            const slicedData = baseCached.value.data.slice(offset, offset + count);
            return {
              ...baseCached.value,
              data: slicedData
            };
          }
        }
      }
    }

    try {
      const response = await fetchApi(`${normalServiceUrl}/get_marketing_list?task_id=${task_id}&task_step_type=3&offset=${offset}&count=${count}`, {
          method: 'GET'
      });

      // 缓存结果
      if (!window.marketListCache) {
        window.marketListCache = {};
      }
      window.marketListCache[cacheKey] = {
        value: response,
        timestamp: Date.now()
      };

      return response;
    } catch (error) {
      console.error('❌ 营销列表请求失败:', { task_id, offset, count, error });
      
      // 如果是503错误，尝试使用缓存数据
      if (error instanceof Error && error.message.includes('503')) {
        console.warn('🛑 服务器503错误，尝试使用缓存数据');
        
        // 尝试使用offset=0的缓存数据
        const baseCacheKey = `market_list_${task_id}_0_${count}`;
        if (window.marketListCache && window.marketListCache[baseCacheKey]) {
          const baseCached = window.marketListCache[baseCacheKey];
          if (Date.now() - baseCached.timestamp < cacheExpiry) {
            if (baseCached.value && baseCached.value.data && baseCached.value.data.length > offset) {
              const slicedData = baseCached.value.data.slice(offset, offset + count);
              return {
                ...baseCached.value,
                data: slicedData
              };
            }
          }
        }
        
        // 如果有任何可用的缓存数据，返回它
        if (window.marketListCache) {
          for (const [key, cached] of Object.entries(window.marketListCache)) {
            if (key.startsWith(`market_list_${task_id}_`) && Date.now() - cached.timestamp < cacheExpiry) {
              return cached.value;
            }
          }
        }
      }
      
      // 返回空数据，避免页面崩溃
      return {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
        data: [],
        status: 503,
        msg: 'error'
      };
    }
}

export async function getMarketProgressApi(task_id: string, isAll: boolean = false) {
    const cacheKey = `market_progress_${task_id}_${isAll ? 'all' : 'filtered'}`;
    const cacheExpiry = 10 * 60 * 1000; // 增加到10分钟缓存，减少请求频率

    // 检查内存缓存
    if (window.marketProgressCache && window.marketProgressCache[cacheKey]) {
      const cached = window.marketProgressCache[cacheKey];
      if (Date.now() - cached.timestamp < cacheExpiry) {
        return cached.value;
      }
    }

    try {
      console.log('🌐 发起营销进度API请求:', { task_id, isAll, url: `${normalServiceUrl}/marketing_progress?task_id=${task_id}&is_all=${isAll ? '1' : '0'}` });
      const response = await fetchApi(`${normalServiceUrl}/marketing_progress?task_id=${task_id}&is_all=${isAll ? '1' : '0'}`, {
          method: 'GET'
      });

      // 缓存结果
      if (!window.marketProgressCache) {
        window.marketProgressCache = {};
      }
      window.marketProgressCache[cacheKey] = {
        value: response,
        timestamp: Date.now()
      };

      console.log('✅ 营销进度API请求成功并缓存:', { task_id, isAll, cacheKey, response });
      return response;
    } catch (error) {
      console.error('❌ 营销进度请求失败:', { task_id, error });
      
      // 如果是503错误，尝试使用缓存数据
      if (error instanceof Error && error.message.includes('503')) {
        console.warn('🛑 服务器503错误，尝试使用缓存数据');
        
        // 如果有任何可用的缓存数据，返回它
        if (window.marketProgressCache) {
          for (const [key, cached] of Object.entries(window.marketProgressCache)) {
            if (key.startsWith(`market_progress_${task_id}_`) && Date.now() - cached.timestamp < cacheExpiry) {
              return cached.value;
            }
          }
        }
      }
      
      // 返回空数据，避免页面崩溃
      return {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
        data: null,
        status: 503,
        msg: 'error'
      };
    }
}

// 清理营销进度缓存
export function clearMarketProgressCache(taskId?: string) {
  if (!window.marketProgressCache) return;
  
  if (taskId) {
    // 清理特定任务的所有缓存（包括is_all=0和is_all=1的缓存）
    delete window.marketProgressCache[`market_progress_${taskId}_all`];
    delete window.marketProgressCache[`market_progress_${taskId}_filtered`];
  } else {
    // 清理所有缓存
    window.marketProgressCache = {};
  }
}

// 清理营销列表缓存
export function clearMarketListCache(taskId?: string) {
  if (!window.marketListCache) return;
  
  if (taskId) {
    // 清理特定任务的缓存
    for (const [key] of Object.entries(window.marketListCache)) {
      if (key.startsWith(`market_list_${taskId}_`)) {
        delete window.marketListCache[key];
      }
    }
  } else {
    // 清理所有缓存
    window.marketListCache = {};
  }
}

// 清理额度缓存
export function clearQuotaCache() {
  if (!window.quotaCache) return;
  
  // 清理所有缓存
  window.quotaCache = {};
}

// 满意度分析API
export async function postAnalysisSatisfactionApi(data: { task_id: string; content: string }) {
    return fetchApi(`${normalServiceUrl}/get_user_satisfaction?task_id=${data.task_id}`, {
        method: 'GET'
    });
}

// 清理用户满意度缓存
export function clearUserSatisfactionCache(taskId?: string) {
  if (!window.userSatisfactionCache) return;
  
  if (taskId) {
    // 清理特定任务的缓存
    delete window.userSatisfactionCache[`user_satisfaction_${taskId}`];
  } else {
    // 清理所有缓存
    window.userSatisfactionCache = {};
  }
}

// 获取用户满意度分析
export async function getUserSatisfactionApi(taskId: string) {
  // 添加内存缓存，避免短时间内重复请求
  const cacheKey = `user_satisfaction_${taskId}`;
  const cacheExpiry = 2 * 60 * 1000; // 2分钟缓存
  
  
  // 检查内存缓存
  if (window.userSatisfactionCache && window.userSatisfactionCache[cacheKey]) {
    const cached = window.userSatisfactionCache[cacheKey];
    const timeDiff = Date.now() - cached.timestamp;
    
    if (timeDiff < cacheExpiry) {
      return cached.value;
    } else {
    }
  }
  
  
  try {
    const response = await fetchApi(`${normalServiceUrl}/get_user_satisfaction?task_id=${taskId}`, {
      method: 'GET'
    });
    
    // 缓存结果
    if (!window.userSatisfactionCache) {
      window.userSatisfactionCache = {};
    }
    window.userSatisfactionCache[cacheKey] = {
      value: response,
      timestamp: Date.now()
    };
    
    
    return response;
  } catch (error) {
    console.error('❌ 获取用户满意度分析失败:', error);
    throw error;
  }
}

// 开始分析接口
export async function startAnalysisApi(data: {
    comment_id: string | null;
    task_id: string;
    platform: string;
    analysis_request: string;
    output_fields: Array<{
        key: string;
        explanation: string;
    }>;
}) {
    return fetchApi(`${normalServiceUrl}/analysis`, {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

// 停止分析接口
export async function stopAnalysisApi(data: {
    task_id: string;
}) {
    return fetchApi(`${normalServiceUrl}/stop_analysis`, {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

// 创建分析模块接口
export async function createAnalysisModuleApi(data: {
    task_id: string;
    service_introduction: string;
    customer_description: string;
}) {
    return fetchApi(`${normalServiceUrl}/create_analysis_module`, {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

// 获取分析模块接口
export async function getAnalysisModulesApi(task_id: string) {
    return fetchApi(`${normalServiceUrl}/get_analysis_modules?task_id=${task_id}`, {
        method: 'GET'
    });
}

// 更新分析模块接口
export async function updateAnalysisModuleApi(data: {
    task_id: string;
    service_introduction: string;
    customer_description: string;
}) {
    return fetchApi(`${normalServiceUrl}/update_analysis_module`, {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

// 保存私信消息接口
export async function saveMessageApi(data: {
    task_id: string;
    message: string;
}) {
    return fetchApi(`${normalServiceUrl}/save_message`, {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

