// 私信相关的API接口
import { fetchApi } from './api';

import { handle401Error } from './api';

// 智能处理认证头的辅助函数
function getAuthHeader(): string {
  const token = localStorage.getItem('token') || '';
  // 检查token是否已经包含Bearer前缀，避免重复添加
  return token.startsWith('Bearer ') ? token : `Bearer ${token}`;
}

// 私信API参数类型定义
export interface StartMarketingParams {
  user_id: string;
  task_id: string;
  message_text: string;
  ip_location?: string; // 地区筛选参数
  target_user_ids?: string[]; // 新增：内容筛选后的目标用户ID列表
  is_all?: number; // 私信全部用户参数：0表示少选，1表示选择全部
  comment_keyword_filter?: string; // 新增：评论内容筛选参数
  send_limit?: number; // 新增：每日私信限制数量，默认150个
}

export interface StopMarketingParams {
  user_id: string;
  task_id: string;
}

// 私信服务配置
const localChatServiceUrl = "http://127.0.0.1:3010"; // 本地私信服务（优先）
const remoteChatServiceUrl = 'https://chat.zhihua.chat'; // 使用硬编码的API地址
const xhsChatServiceUrl = "http://127.0.0.1:3000"; // 小红书服务
const goBackServiceUrl = 'https://golang-qo9o-116838-7-1320884641.sh.run.tcloudbase.com';
// const mainServiceUrl = 'https://chat.zhihua.chat'; // 使用硬编码的API地址

// 服务状态管理
let serviceStatus = {
  remoteServiceAvailable: false,
  localServiceAvailable: false,
  lastChecked: 0
};

// 检查服务可用性的函数
async function checkServiceAvailability() {
  const now = Date.now();
  // 如果距离上次检查不到5分钟，直接返回缓存状态
  if (now - serviceStatus.lastChecked < 5 * 60 * 1000) {
    return serviceStatus;
  }
  
  try {
    // 优先检查本地服务
    try {
      const localResponse = await fetch(`${localChatServiceUrl}/get_version`, {
        method: 'GET',
        signal: AbortSignal.timeout(3000) // 3秒超时
      });
      serviceStatus.localServiceAvailable = localResponse.status === 200;
    } catch {
      serviceStatus.localServiceAvailable = false;
    }
    
    // 然后检查远程服务
    try {
      const remoteResponse = await fetch(`http://127.0.0.1:3010/get_version`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000) // 5秒超时
      });
      serviceStatus.remoteServiceAvailable = remoteResponse.status === 200;
    } catch {
      serviceStatus.remoteServiceAvailable = false;
    }
    
    serviceStatus.lastChecked = now;
    
    console.log('服务状态检查完成:', {
      local: serviceStatus.localServiceAvailable,
      remote: serviceStatus.remoteServiceAvailable
    });
    
  } catch (error) {
    console.log('服务状态检查失败:', error);
    serviceStatus.remoteServiceAvailable = false;
    serviceStatus.localServiceAvailable = false;
    serviceStatus.lastChecked = now;
  }
  
  return serviceStatus;
}

// 专门处理私信的API调用函数
async function fetchLocalApi(url: string, options: RequestInit = {}) {
  try {
    // 确保设置Content-Type为application/json
    if (options.method === 'POST' || options.method === 'PUT') {
      options.headers = {
        ...options.headers,
        'Content-Type': 'application/json'
      };
    }

    const response = await fetch(url, options);
    if (response.status === 401) {
      handle401Error();
      return;
    }
    if (response.status !== 200) {
      console.warn(`API请求失败: ${url}, 状态码: ${response.status}`);
      return response.status;
    }
    return response.json();

  } catch (error) {
    console.warn(`API请求异常: ${url}, 错误:`, error);
    return 10000;
  }
}

// 获取抖音账号列表
export async function getDouyinAccounts() {
  try {
    // 优先尝试本地服务
    try {
      const localResponse = await fetch(`${localChatServiceUrl}/get_douyin_accounts`, {
        method: 'GET'
      });
      
      if (localResponse.status === 200) {
        const data = await localResponse.json();
        console.log('从本地服务获取抖音账号成功');
        
        // 检查响应格式并返回正确的数据结构
        if (data && data.status === 200 && data.data && data.data.accounts) {
          return data; // 返回完整响应
        } else if (data && Array.isArray(data)) {
          // 如果直接返回数组，包装成标准格式
          return { data: { accounts: data }, msg: 'success', status: 200 };
        } else {
          console.warn('本地服务返回的数据格式异常:', data);
          return { data: { accounts: [] }, msg: 'data format error', status: 200 };
        }
      } else {
        console.log(`本地服务响应异常，状态码: ${localResponse.status}`);
      }
    } catch (localError) {
      console.log('本地服务连接失败:', localError);
    }
    
    // 如果本地服务不可用，尝试远程服务
    try {
      const remoteResponse = await fetch(`${remoteChatServiceUrl}/get_douyin_accounts`, {
        method: 'GET'
      });
      
      if (remoteResponse.status === 200) {
        const data = await remoteResponse.json();
        console.log('从远程服务获取抖音账号成功');
        return data;
      } else if (remoteResponse.status === 404) {
        console.log('远程服务端点不存在');
      } else {
        console.log(`远程服务响应异常，状态码: ${remoteResponse.status}`);
      }
    } catch (remoteError) {
      console.log('远程服务连接失败:', remoteError);
    }
    
    // 如果都不可用，返回空数组
    console.log('所有服务都不可用，返回空账号列表');
    return { data: { accounts: [] }, msg: 'no service available', status: 0 };
    
  } catch (error) {
    console.error('获取抖音账号失败:', error);
    return { data: { accounts: [] }, msg: 'error', status: 0 };
  }
}

// 登录抖音账号
export async function postLoginDouyin() {
  try {
    // 优先尝试本地服务
    try {
      const localResponse = await fetch(`${localChatServiceUrl}/login_douyin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (localResponse.status === 200) {
        const data = await localResponse.json();
        console.log('本地服务登录抖音账号成功');
        
        // 检查响应格式并返回正确的数据结构
        if (data && data.status === 200) {
          return data; // 返回完整响应
        } else if (data && data.success !== undefined) {
          // 如果使用success字段，包装成标准格式
          return { 
            status: 200, 
            success: data.success, 
            message: data.message || data.msg || '登录成功',
            data: data.data || null
          };
        } else {
          console.warn('本地服务返回的登录数据格式异常:', data);
          return { 
            status: 200, 
            success: true, 
            message: '登录成功', 
            data: data 
          };
        }
      } else {
        console.log(`本地服务响应异常，状态码: ${localResponse.status}`);
      }
    } catch (localError) {
      console.log('本地服务连接失败:', localError);
    }
    
    // 如果本地服务不可用，尝试远程服务
    try {
      const remoteResponse = await fetch(`${remoteChatServiceUrl}/login_douyin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (remoteResponse.status === 200) {
        const data = await remoteResponse.json();
        console.log('远程服务登录抖音账号成功');
        return data;
      } else if (remoteResponse.status === 404) {
        console.log('远程服务端点不存在');
      } else {
        console.log(`远程服务响应异常，状态码: ${remoteResponse.status}`);
      }
    } catch (remoteError) {
      console.log('远程服务连接失败:', remoteError);
    }
    
    // 如果都不可用，返回错误信息
    console.log('所有服务都不可用，无法登录抖音账号');
    return { 
      status: 0, 
      success: false
    };
    
  } catch (error) {
    console.error('登录抖音账号失败:', error);
    return { 
      status: 0, 
      success: false, 
      message: '登录失败，请稍后重试' 
    };
  }
}

// 获取小红书账号列表
export async function getXhsAccounts() {
  return fetchLocalApi(`${xhsChatServiceUrl}/get_xhs_accounts`, {
    method: 'GET'
  });
}

// 获取聊天版本 - 已移动到 versionApi.ts 文件中
// 请使用 import { getChatVersion } from './versionApi' 来导入

// 开始私信营销
export async function postStartMarketByTaskIdApi(platform: string, data: StartMarketingParams) {
  const serviceUrl = platform === 'dy' ? localChatServiceUrl : xhsChatServiceUrl;
  return fetchApi(`${serviceUrl}/start_marketing`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// 停止私信营销
export async function postStopMarketByTaskIdApi(platform: string, data: StopMarketingParams) {
  const serviceUrl = platform === 'dy' ? localChatServiceUrl : xhsChatServiceUrl;
  return fetchApi(`${serviceUrl}/stop_marketing`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// 检查私信服务是否可用
export async function checkLocalServiceAvailability() {
  const status = await checkServiceAvailability();
  return status.remoteServiceAvailable || status.localServiceAvailable;
}

// 获取当前可用的服务状态
export async function getServiceStatus() {
  const status = await checkServiceAvailability();
  return {
    localServiceAvailable: status.localServiceAvailable,
    remoteServiceAvailable: status.remoteServiceAvailable,
    mainServiceAvailable: status.remoteServiceAvailable || status.localServiceAvailable,
    fallbackToLocalStorage: true  // 支持localStorage作为备选
  };
}

// 获取私信间隔时间
export async function getSimpleTimeGap() {
  try {
    // 优先尝试本地服务
    try {
      const localResponse = await fetch(`${localChatServiceUrl}/get_simple_time_gap`, {
        method: 'GET',
      });
      
      if (localResponse.status === 200) {
        const data = await localResponse.json();
        console.log('从本地服务获取间隔时间成功');
        
        // 检查响应格式并返回正确的数据结构
        if (data && data.status === 200 && typeof data.time_gap === 'number') {
          return data; // 返回完整响应
        } else if (data && typeof data.time_gap === 'number') {
          // 如果没有status字段，包装成标准格式
          return { msg: 'success', status: 200, time_gap: data.time_gap };
        } else {
          console.warn('本地服务返回的时间间隔数据格式异常:', data);
          return { msg: 'data format error', status: 200, time_gap: 180 };
        }
      } else {
        console.log(`本地服务响应异常，状态码: ${localResponse.status}`);
      }
    } catch (localError) {
      console.log('本地服务连接失败:', localError);
    }
    
    // 如果本地服务不可用，尝试远程服务
    try {
      const remoteResponse = await fetch(`${remoteChatServiceUrl}/get_simple_time_gap`, {
        method: 'GET',
      });
      
      if (remoteResponse.status === 200) {
        const data = await remoteResponse.json();
        return data;
      } else if (remoteResponse.status === 404) {
        console.warn('私信间隔：远程服务端点不存在');
      } else {
        console.warn(`私信间隔：远程服务异常(${remoteResponse.status})`);
      }
    } catch (remoteError) {
      console.warn('私信间隔：远程服务连接失败');
    }
    
    // 如果本地服务也不可用，尝试从localStorage获取保存的值
    try {
      const savedInterval = localStorage.getItem('privateMessageInterval');
      if (savedInterval) {
        return { msg: 'success', status: 200, time_gap: parseInt(savedInterval, 10) };
      }
    } catch (storageError) {
      console.error('私信间隔：本地存储读取失败');
    }
    
    // 如果都没有，返回默认值
    return { msg: 'success', status: 200, time_gap: 180 }; // 返回默认值
    
  } catch (error) {
    // 尝试从localStorage获取保存的值
    try {
      const savedInterval = localStorage.getItem('privateMessageInterval');
      if (savedInterval) {
        return { msg: 'success', status: 200, time_gap: parseInt(savedInterval, 10) };
      }
    } catch (storageError) {
      console.error('私信间隔：本地存储读取失败');
    }
    
    // 如果都没有，返回默认值
    return { msg: 'success', status: 200, time_gap: 180 }; // 返回默认值
  }
}

// 设置私信间隔时间
export async function setSimpleTimeGap(timeGap: number) {
  try {
    // 优先尝试本地服务
    const localResponse = await fetchLocalApi(`${localChatServiceUrl}/set_simple_time_gap`, {
      method: 'POST',
      body: JSON.stringify({ time_gap: timeGap }),
    });
    
    // 如果本地服务可用，返回结果
    if (localResponse && localResponse !== 10000) {
      return localResponse;
    }
    
    // 如果本地服务不可用，尝试保存到主服务或本地存储
    console.log('本地私信服务不可用，保存间隔时间到本地存储');
    
    // 保存到localStorage作为备选方案
    try {
      localStorage.setItem('privateMessageInterval', timeGap.toString());
      return { success: true, message: '间隔时间已保存到本地存储' };
    } catch (storageError) {
      console.error('保存到本地存储失败:', storageError);
      return { success: false, message: '保存失败，本地服务不可用且无法保存到本地存储' };
    }
    
  } catch (error) {
    console.log('设置私信间隔时间失败:', error);
    
    // 尝试保存到localStorage作为备选方案
    try {
      localStorage.setItem('privateMessageInterval', timeGap.toString());
      return { success: true, message: '间隔时间已保存到本地存储' };
    } catch (storageError) {
      console.error('保存到本地存储失败:', storageError);
      return { success: false, message: '保存失败，本地服务不可用且无法保存到本地存储' };
    }
  }
}

// 保存与task相关的键值对
export async function getKvApi(taskId: string, jsonKey: string) {
  return fetchLocalApi(`${goBackServiceUrl}/api/get_kvcache?taskId=${taskId}&jsonKey=${jsonKey}`, {
    method: 'GET'
  });
}

export async function updateKvApi(data: any) {
  return fetchLocalApi(`${goBackServiceUrl}/api/update_kvcache`, {
    method: 'POST',
    body: JSON.stringify(data)
  });
}

export async function createKvApi(data: any) {
  return fetchLocalApi(`${goBackServiceUrl}/api/create_kvcache`, {
    method: 'POST',
    body: JSON.stringify(data)
  });
}

// 获取小红书帖子的token
export async function getXhsApi(explore: string) {
  return fetchLocalApi(`${goBackServiceUrl}/api/xhs/get?explore=${explore}`, {
    method: 'GET'
  });
}

export async function updateXhsApi(data: any) {
  return fetchLocalApi(`${goBackServiceUrl}/api/xhs/update`, {
    method: 'POST',
    body: JSON.stringify(data)
  });
}

export async function createXhsApi(data: any) {
  return fetchLocalApi(`${goBackServiceUrl}/api/xhs/create`, {
    method: 'POST',
    body: JSON.stringify(data)
  });
}

// 获取私信用户数据 - 带重试和备用机制
export async function getSimpleMarketingUser(taskId: string, retryCount = 3) {
  console.log(`正在获取私信用户数据，task_id: ${taskId}`);
  
  for (let attempt = 1; attempt <= retryCount; attempt++) {
    try {
      console.log(`第${attempt}次尝试获取私信用户数据...`);
      
      // 优先尝试本地服务
      try {
        const localResponse = await fetch(`${localChatServiceUrl}/get_marketing_users`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ task_id: taskId })
        });
        
        if (localResponse.status === 200) {
          const data = await localResponse.json();
          console.log('从本地服务获取私信用户数据成功:', data);
          return data;
        }
      } catch (localError) {
        console.warn('本地服务获取私信用户数据失败:', localError);
      }
      
      // 如果本地服务失败，尝试远程服务
      const response = await fetch(`${remoteChatServiceUrl}/get_simple_marketing_user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': getAuthHeader()
        },
        body: JSON.stringify({ task_id: taskId })
      });
      
      if (response.status === 200) {
        const data = await response.json();
        console.log(`远程服务响应数据:`, data);
        
        // 检查数据是否有效
        if (data && data.users && Array.isArray(data.users) && data.users.length > 0) {
          console.log(`成功获取到${data.users.length}个私信用户`);
          // 缓存数据
          cacheMarketingUsers(taskId, data);
          return data;
        } else if (data && data.user_ids && Array.isArray(data.user_ids) && data.user_ids.length > 0) {
          console.log(`成功获取到${data.user_ids.length}个私信用户ID`);
          // 缓存数据
          cacheMarketingUsers(taskId, data);
          return data;
        } else {
          console.warn(`第${attempt}次尝试：远程服务返回空数据，尝试备用方案...`);
        }
      } else {
        console.warn(`第${attempt}次尝试：远程服务响应异常，状态码: ${response.status}`);
      }
      
    } catch (error) {
      console.warn(`第${attempt}次尝试失败:`, error);
    }
    
    // 如果不是最后一次尝试，等待后重试
    if (attempt < retryCount) {
      const delay = Math.pow(2, attempt) * 1000; // 指数退避：2秒、4秒、8秒
      console.log(`等待${delay/1000}秒后重试...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  // 所有重试都失败，尝试从本地缓存获取
  try {
    const cachedUsers = localStorage.getItem(`marketing_users_${taskId}`);
    if (cachedUsers) {
      const parsed = JSON.parse(cachedUsers);
      console.log('从本地缓存获取到私信用户数据:', parsed);
      return parsed;
    }
  } catch (cacheError) {
    console.warn('读取本地缓存失败:', cacheError);
  }
  
  // 所有方案都失败，返回空数据
  console.error('无法获取私信用户数据，所有数据源都不可用');
  return { 
    users: [], 
    user_ids: [], 
    message: '无法获取私信用户数据，请检查网络连接或联系管理员',
    status: 'error'
  };
}

// 缓存私信用户数据到本地存储
export function cacheMarketingUsers(taskId: string, userData: any) {
  try {
    localStorage.setItem(`marketing_users_${taskId}`, JSON.stringify(userData));
    console.log(`私信用户数据已缓存到本地存储，task_id: ${taskId}`);
  } catch (error) {
    console.warn('缓存私信用户数据失败:', error);
  }
}

// 清除缓存的私信用户数据
export function clearCachedMarketingUsers(taskId: string) {
  try {
    localStorage.removeItem(`marketing_users_${taskId}`);
    console.log(`已清除缓存的私信用户数据，task_id: ${taskId}`);
  } catch (error) {
    console.warn('清除缓存失败:', error);
  }
}

// ==================== 任务管理API ====================

// 创建爬虫任务
export async function createCommentCrawlerTask(params: {
  platform: 'dy' | 'xhs';
  keyword: string;
  awemes: Array<{
    id: string;
    title: string;
    xsec_token: string;
  }>;
  lt?: string;
  crawler_type?: string;
  start_page?: number;
}) {
  try {
    console.log('创建爬虫任务，参数:', params);
    
          const response = await fetch(`https://chat.zhihua.chat/comment_crawler`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': getAuthHeader()
      },
      body: JSON.stringify({
        platform: params.platform === 'dy' ? 'dy' : 'xhs',
        keyword: params.keyword,
        awemes: params.awemes,
        lt: params.lt || 'qrcode',
        crawler_type: params.crawler_type || 'detail',
        start_page: params.start_page || 1
      })
    });
    
    if (response.status === 200) {
      const data = await response.json();
      console.log('爬虫任务创建成功:', data);
      
      if (data.status === 200 && data.task_id) {
        // 缓存任务信息到本地存储
        const taskInfo = {
          task_id: data.task_id,
          platform: params.platform,
          keyword: params.keyword,
          status: 'created',
          created_at: new Date().toISOString(),
          awemes: params.awemes
        };
        localStorage.setItem(`task_${data.task_id}`, JSON.stringify(taskInfo));
        
        return {
          success: true,
          task_id: data.task_id,
          message: '任务创建成功',
          data: data
        };
      } else {
        throw new Error(data.msg || '任务创建失败');
      }
    } else {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
  } catch (error) {
    console.error('创建爬虫任务失败:', error);
    return {
      success: false,
      task_id: null,
      message: error instanceof Error ? error.message : '任务创建失败',
      error: error
    };
  }
}

// 获取本地缓存的任务
function getLocalTaskCache(): any[] {
  try {
    const cachedTasks: any[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('task_')) {
        try {
          const taskData = JSON.parse(localStorage.getItem(key) || '{}');
          if (taskData.task_id) {
            cachedTasks.push(taskData);
          }
        } catch (e) {
          console.warn('解析本地任务缓存失败:', key, e);
        }
      }
    }
    return cachedTasks;
  } catch (error) {
    console.error('获取本地任务缓存失败:', error);
    return [];
  }
}

// 合并任务数据
function mergeTaskData(remoteData: any, localData: any[]): any[] {
  try {
    const remoteTasks = remoteData.data?.task_list || [];
    const merged = [...remoteTasks];
    
    // 添加本地缓存的任务，避免重复
    localData.forEach(localTask => {
      const exists = merged.find(remoteTask => remoteTask.task_id === localTask.task_id);
      if (!exists) {
        merged.push(localTask);
      }
    });
    
    return merged;
  } catch (error) {
    console.error('合并任务数据失败:', error);
    return remoteData.data?.task_list || [];
  }
}

// ==================== is_all 状态管理API ====================

// 获取任务的is_all状态
export async function getIsAllStatus(taskId: string) {
  try {
    console.log('获取任务is_all状态，task_id:', taskId);
    
    const response = await fetch(`https://chat.zhihua.chat/get_is_all?task_id=${taskId}`, {
      method: 'GET',
      headers: {
        'Authorization': getAuthHeader()
      }
    });
    
    if (response.status === 200) {
      const data = await response.json();
      console.log('获取is_all状态成功:', data);
      return data;
    } else {
      console.warn(`获取is_all状态失败，状态码: ${response.status}`);
      return { success: false, is_all: 0, message: '获取状态失败' };
    }
    
  } catch (error) {
    console.error('获取is_all状态异常:', error);
    return { success: false, is_all: 0, message: '获取状态异常' };
  }
}

// 更新任务的is_all状态
export async function updateIsAllStatus(taskId: string, isAll: number) {
  try {
    console.log('更新任务is_all状态:', { taskId, isAll });
    
    const response = await fetch('https://chat.zhihua.chat/update_is_all', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': getAuthHeader()
      },
      body: JSON.stringify({
        task_id: taskId,
        is_all: isAll === 1
      })
    });
    
    if (response.status === 200) {
      const data = await response.json();
      console.log('更新is_all状态成功:', data);
      return data;
    } else {
      console.warn(`更新is_all状态失败，状态码: ${response.status}`);
      return { success: false, message: '更新状态失败' };
    }
    
  } catch (error) {
    console.error('更新is_all状态异常:', error);
    return { success: false, message: '更新状态异常' };
  }
}

// 获取任务列表 - 添加缓存机制
export async function getTaskList(params: {
  offset?: number;
  count?: number;
  platform?: 'dy' | 'xhs';
  status?: string;
}) {
  try {
    console.log('获取任务列表，参数:', params);
    
    // 构建缓存键
    const cacheKey = `task_list_${params.offset || 0}_${params.count || 50}_${params.platform || 'all'}_${params.status || 'all'}`;
    const cacheExpiry = 5 * 60 * 1000; // 5分钟缓存
    
    // 检查缓存
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      try {
        const cachedData = JSON.parse(cached);
        if (Date.now() - cachedData.timestamp < cacheExpiry) {
          return cachedData.data;
        }
      } catch (e) {
        console.warn('缓存数据解析失败，继续请求:', e);
      }
    }
    
    const queryParams = new URLSearchParams();
    if (params.offset !== undefined) queryParams.append('offset', params.offset.toString());
    if (params.count !== undefined) queryParams.append('count', params.count.toString());
    if (params.platform) queryParams.append('platform', params.platform);
    if (params.status) queryParams.append('status', params.status);
    
    const response = await fetch(`https://chat.zhihua.chat/task_list?${queryParams.toString()}`, {
      method: 'GET',
      headers: {
        'Authorization': getAuthHeader()
      }
    });
    
    if (response.status === 200) {
      const data = await response.json();
      console.log('获取任务列表成功:', data);
      
      // 合并本地缓存的任务信息
      const localTasks = getLocalTaskCache();
      const mergedTasks = mergeTaskData(data, localTasks);
      
      const result = {
        success: true,
        data: mergedTasks,
        message: '获取任务列表成功'
      };
      
      // 保存到缓存
      try {
        const cacheData = {
          data: result,
          timestamp: Date.now()
        };
        localStorage.setItem(cacheKey, JSON.stringify(cacheData));
      } catch (e) {
        console.warn('缓存保存失败:', e);
      }
      
      return result;
    } else {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
  } catch (error) {
    console.error('获取任务列表失败:', error);
    
    // 如果远程服务失败，返回本地缓存的任务
    const localTasks = getLocalTaskCache();
    if (localTasks.length > 0) {
      console.log('使用本地缓存的任务列表');
      return {
        success: true,
        data: localTasks,
        message: '使用本地缓存数据',
        fromCache: true
      };
    }
    
    return {
      success: false,
      data: [],
      message: error instanceof Error ? error.message : '获取任务列表失败',
      error: error
    };
  }
}

// 打开抖音网站
export async function openDouyinWebsite(userId: string) {
  try {
    // 优先尝试通过本地服务打开抖音
    const localResponse = await fetch(`${localChatServiceUrl}/open_douyin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ user_id: userId })
    });

    if (localResponse.ok) {
      console.log('本地服务成功打开抖音网站');
      return;
    }
  } catch (localError) {
    console.warn('本地服务打开抖音网站失败:', localError);
  }

  // 如果本地服务失败，尝试直接在浏览器中打开抖音
  try {
    const douyinUrl = `https://www.douyin.com/user/${userId}`;
    window.open(douyinUrl, '_blank');
    console.log('已在新标签页打开抖音网站');
  } catch (error) {
    console.error('打开抖音网站失败:', error);
    throw new Error('无法打开抖音网站');
  }
}
