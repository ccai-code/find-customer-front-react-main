// 任务流程管理器
// 按照完整的流程管理爬虫任务、监控状态和获取营销用户

import { handle401Error } from './api';

// 智能处理认证头的辅助函数
function getAuthHeader(): string {
  const token = localStorage.getItem('token') || '';
  // 检查token是否已经包含Bearer前缀，避免重复添加
  return token.startsWith('Bearer ') ? token : `Bearer ${token}`;
}

// 任务状态枚举
export const TaskStatus = {
  CREATED: 'created',
  CRAWLING: 'crawling',
  CRAWL_COMPLETED: 'crawl_completed',
  ANALYZING: 'analyzing',
  ANALYSIS_COMPLETED: 'analysis_completed',
  MARKETING_READY: 'marketing_ready',
  ERROR: 'error'
} as const;

export type TaskStatusType = typeof TaskStatus[keyof typeof TaskStatus];

// 任务流程配置
export interface TaskFlowConfig {
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
  maxWaitTime?: number;
  checkInterval?: number;
}

// 任务流程结果
export interface TaskFlowResult {
  success: boolean;
  task_id?: string;
  status: TaskStatusType;
  message: string;
  marketingUsers?: any[];
  error?: any;
}

// 营销用户请求参数
export interface MarketingUserParams {
  task_id: string;
  task_step_type: number;
  ip_location?: string;
  start_time?: number;
  end_time?: number;
}

// 任务流程管理器
export class TaskFlowManager {
  private config: TaskFlowConfig;
  private taskId: string | null = null;
  private isMonitoring: boolean = false;
  private abortController: AbortController | null = null;
  private baseUrl: string = 'https://chat.zhihua.chat';

  constructor(config: TaskFlowConfig) {
    this.config = {
      lt: 'qrcode',
      crawler_type: 'detail',
      start_page: 1,
      maxWaitTime: 30 * 60 * 1000, // 30分钟超时
      checkInterval: 30 * 1000, // 30秒检查一次，减少请求频率
      ...config
    };
  }

  // 开始完整的任务流程
  async startFlow(): Promise<TaskFlowResult> {
    try {
      console.log('开始任务流程:', this.config);
      
      // 1. 创建爬虫任务
      const createResult = await this.createTask();
      if (!createResult.success || !createResult.task_id) {
        return {
          success: false,
          status: TaskStatus.ERROR,
          message: createResult.message || '创建任务失败'
        };
      }

      this.taskId = createResult.task_id;
      console.log('任务创建成功，task_id:', this.taskId);

      // 2. 监控任务状态直到完成
      const monitorResult = await this.monitorTaskProgress();
      if (!monitorResult.success) {
        return {
          success: false,
          status: TaskStatus.ERROR,
          message: monitorResult.message || '任务监控失败',
          task_id: this.taskId
        };
      }

      // 3. 获取营销用户数据
      const marketingResult = await this.getMarketingUsers();
      if (!marketingResult.success) {
        return {
          success: false,
          status: TaskStatus.ERROR,
          message: marketingResult.message || '获取营销用户失败',
          task_id: this.taskId
        };
      }

      return {
        success: true,
        task_id: this.taskId,
        status: TaskStatus.MARKETING_READY,
        message: '任务流程完成，营销用户数据已获取',
        marketingUsers: marketingResult.data
      };

    } catch (error) {
      console.error('任务流程执行失败:', error);
      return {
        success: false,
        status: TaskStatus.ERROR,
        message: error instanceof Error ? error.message : '任务流程执行失败',
        task_id: this.taskId || undefined,
        error
      };
    }
  }

  // 1. 创建爬虫任务获取 task_id
  private async createTask(): Promise<{ success: boolean; task_id?: string; message: string }> {
    try {
      const taskData = {
        platform: this.config.platform,
        keyword: this.config.keyword,
        awemes: this.config.awemes,
        lt: this.config.lt!,
        crawler_type: this.config.crawler_type!,
        start_page: this.config.start_page!
      };
      
      console.log('创建爬虫任务，参数:', taskData);
      
      const response = await fetch(`${this.baseUrl}/comment_crawler`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': getAuthHeader()
        },
        body: JSON.stringify(taskData)
      });
      
      if (response.status === 401) {
        handle401Error();
        return {
          success: false,
          message: '认证失败，请重新登录'
        };
      }
      
      if (response.status === 200) {
        const data = await response.json();
        console.log('任务创建成功，响应:', data);
        
        if (data.status === 200 && data.task_id) {
          // 缓存任务信息到本地存储
          const taskInfo = {
            task_id: data.task_id,
            platform: this.config.platform,
            keyword: this.config.keyword,
            status: 'created',
            created_at: new Date().toISOString(),
            awemes: this.config.awemes
          };
          localStorage.setItem(`task_${data.task_id}`, JSON.stringify(taskInfo));
          
          return {
            success: true,
            task_id: data.task_id,
            message: '任务创建成功'
          };
        } else {
          return {
            success: false,
            message: data.msg || data.message || '任务创建失败'
          };
        }
      } else {
        const errorText = await response.text();
        console.error('任务创建失败，状态码:', response.status, '错误:', errorText);
        return {
          success: false,
          message: `HTTP ${response.status}: ${response.statusText}`
        };
      }
    } catch (error) {
      console.error('创建任务异常:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : '创建任务失败'
      };
    }
  }

  // 2. 监控任务状态
  private async monitorTaskProgress(): Promise<{ success: boolean; message: string }> {
    if (!this.taskId) {
      return { success: false, message: '任务ID不存在' };
    }
    
    this.isMonitoring = true;
    this.abortController = new AbortController();
    const startTime = Date.now();

    console.log('开始监控任务进度，task_id:', this.taskId);

    try {
      while (Date.now() - startTime < this.config.maxWaitTime!) {
        // 检查是否被中止
        if (this.abortController.signal.aborted) {
          return { success: false, message: '任务监控被中止' };
        }

        try {
          // 调用 GET /task_list 接口监控任务状态
          const response = await fetch(`${this.baseUrl}/task_list?offset=0&count=100`, {
            method: 'GET',
            headers: {
              'Authorization': getAuthHeader()
            }
          });
          
          if (response.status === 401) {
            handle401Error();
            return { success: false, message: '认证失败，请重新登录' };
          }
          
          if (response.status === 200) {
            const data = await response.json();
            const currentTask = data.data?.task_list?.find((task: any) => task.task_id === this.taskId);
            
            if (currentTask) {
              const status = this.getTaskStatus(currentTask);

              if (status === TaskStatus.MARKETING_READY) {
                return { success: true, message: '任务完成' };
              }

              if (status === TaskStatus.ERROR) {
                console.error('任务流程：执行出错 -', currentTask.error_message || '未知错误');
                return { success: false, message: currentTask.error_message || '任务执行出错' };
              }

              // 检查是否超时
              if (Date.now() - startTime > this.config.maxWaitTime!) {
                console.warn('任务流程：监控超时');
                return { success: false, message: '任务监控超时' };
              }
            } else {
              console.warn('任务流程：未找到任务', this.taskId);
            }
          } else {
            console.warn('任务流程：获取列表失败', response.status);
          }

          // 等待下次检查
          await this.sleep(this.config.checkInterval!);

        } catch (error) {
          console.error('任务流程：监控出错 -', error instanceof Error ? error.message : '未知错误');
          // 继续监控，不中断流程
          await this.sleep(this.config.checkInterval!);
        }
      }

      return { success: false, message: '任务监控超时' };

    } finally {
      this.isMonitoring = false;
    }
  }

  // 3. 获取营销用户数据
  private async getMarketingUsers(): Promise<{ success: boolean; data?: any[]; message: string }> {
    if (!this.taskId) {
      return { success: false, message: '任务ID不存在' };
    }

    try {
      console.log('获取营销用户数据，task_id:', this.taskId);
      
      const params: MarketingUserParams = {
        task_id: this.taskId,
        task_step_type: 3
      };
      
      const response = await fetch(`${this.baseUrl}/get_simple_marketing_user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': getAuthHeader()
        },
        body: JSON.stringify(params)
      });

      if (response.status === 401) {
        handle401Error();
        return {
          success: false,
          message: '认证失败，请重新登录'
        };
      }

      if (response.status === 200) {
        const data = await response.json();
        console.log('获取营销用户成功，数据:', data);
        
        if (data.status === 200) {
          return {
            success: true,
            data: data.data || data.users || [],
            message: '获取营销用户成功'
          };
        } else {
          return {
            success: false,
            message: data.message || data.msg || '获取营销用户失败'
          };
        }
      } else {
        const errorText = await response.text();
        console.error('获取营销用户失败，状态码:', response.status, '错误:', errorText);
        return {
          success: false,
          message: `HTTP ${response.status}: ${response.statusText}`
        };
      }
    } catch (error) {
      console.error('获取营销用户异常:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : '获取营销用户失败'
      };
    }
  }

  // 解析任务状态
  private getTaskStatus(task: any): TaskStatusType {
    // 检查爬虫状态
    if (task.crawler_state === 'completed' || task.crawler_state === 'finish') {
      // 检查分析状态
      if (task.analysis_state === 'completed' || task.analysis_state === 'finish') {
        // 检查营销状态
        if (task.marketing_state === 'ready' || task.marketing_state === 'finish') {
          return TaskStatus.MARKETING_READY;
        } else {
          return TaskStatus.ANALYSIS_COMPLETED;
        }
      } else if (task.analysis_state === 'analyzing' || task.analysis_state === 'running') {
        return TaskStatus.ANALYZING;
      } else {
        return TaskStatus.CRAWL_COMPLETED;
      }
    } else if (task.crawler_state === 'crawling' || task.crawler_state === 'running') {
      return TaskStatus.CRAWLING;
    } else if (task.status === 'error' || task.error_message) {
      return TaskStatus.ERROR;
    } else {
      return TaskStatus.CREATED;
    }
  }

  // 停止监控
  stopMonitoring(): void {
    this.isMonitoring = false;
    if (this.abortController) {
      this.abortController.abort();
    }
  }

  // 工具函数：等待指定时间
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // 获取当前任务ID
  getTaskId(): string | null {
    return this.taskId;
  }

  // 检查是否正在监控
  isCurrentlyMonitoring(): boolean {
    return this.isMonitoring;
  }

  // 设置基础URL
  setBaseUrl(url: string): void {
    this.baseUrl = url;
  }
}

// 便捷函数：直接执行完整流程
export async function executeTaskFlow(config: TaskFlowConfig): Promise<TaskFlowResult> {
  const manager = new TaskFlowManager(config);
  return await manager.startFlow();
}

// 便捷函数：只创建任务，不监控进度
export async function createTaskOnly(config: TaskFlowConfig): Promise<{ success: boolean; task_id?: string; message: string }> {
  const manager = new TaskFlowManager(config);
  return await manager['createTask']();
}

// 直接调用营销用户接口
export async function getMarketingUsersDirectly(taskId: string, params?: Partial<MarketingUserParams>): Promise<any> {
  try {
    const requestParams: MarketingUserParams = {
      task_id: taskId,
      task_step_type: 3,
      ...params
    };
    
    const response = await fetch(`https://chat.zhihua.chat/get_simple_marketing_user`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': getAuthHeader()
      },
      body: JSON.stringify(requestParams)
    });

    if (response.status === 401) {
      handle401Error();
      throw new Error('认证失败，请重新登录');
    }

    if (response.status === 200) {
      const data = await response.json();
      return data;
    } else {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
  } catch (error) {
    console.error('直接获取营销用户失败:', error);
    throw error;
  }
}
