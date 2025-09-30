import { useEffect, useState, useRef } from 'react';
import { Card, Input, Message } from '@arco-design/web-react';

import { postChatModel, createAnalysisModuleApi, updateAnalysisModuleApi, getAnalysisModulesApi } from '../../api/api';

// 扩展 Window 接口以支持 _lastTaskId 属性
declare global {
  interface Window {
    _lastTaskId?: string;
  }
}


// 内容清洗函数
function cleanContent(str: string): string {
  if (!str) return '';
  // 去除首尾空格、引号、大括号、破折号、点号、换行
  str = str.trim()
    .replace(/^["'"{}、.．·\-———\s]+|["'"{}、.．·\-———\s]+$/g, '')
    .replace(/^[\r\n]+|[\r\n]+$/g, '');
  // 连续多个换行替换为一个
  str = str.replace(/[\r\n]{2,}/g, '\n');
  // 去除内容中多余的点号、破折号等
  str = str.replace(/^[·•\-———]+/gm, '');
  // 去除内容中所有大括号和多余引号
  str = str.replace(/[{}"']/g, '');
  return str;
}

interface Task {
  task_id: string;
  keyword: string;
  platform: string;
  progress?: number;
  analysis_state?: string;
  intent_count?: number;
}

interface SummaryCardsProps {
  currentTask?: Task;
  progressData?: {
    num: number;
    sum: number;
    state: number;
    ic_num: number;
  } | null;
  onTaskUpdate?: () => void;
  onServiceIntroChange?: (service: string) => void;
  onTargetCustomerChange?: (customer: string) => void;
  analysisProgress?: number; // 添加分析进度参数
}

export default function SummaryCards({ currentTask, onServiceIntroChange, onTargetCustomerChange, analysisProgress = 0 }: SummaryCardsProps) {
  const [serviceIntro, setServiceIntro] = useState('');
  const [targetCustomer, setTargetCustomer] = useState('');
  const [loading, setLoading] = useState(false);
  
  // 判断是否为未开始的任务（直接显示输入框）
  const isInitialTask = currentTask?.analysis_state === 'initial';
  
  // 判断是否允许编辑：分析进度小于100%时才允许编辑
  const isEditable = analysisProgress < 100;

  // 前端缓存，避免重复请求
  const cacheRef = useRef<{ [key: string]: { service: string; customer: string } }>({});

  // 本地存储缓存键名 - 使用任务ID作为键
  const getTemplateKey = (taskId: string) => `${taskId}-template`;

  // 从本地存储加载模板数据 - 优化后的优先级逻辑
  const loadTemplateData = async () => {
    const currentTaskId = currentTask?.task_id;
    const currentKeyWord = currentTask?.keyword;
    
    if (!currentTaskId) return;
    
    try {
      // 1. 最高优先级：首先尝试从 localStorage 加载已存储的模板数据
      const storedData = localStorage.getItem(getTemplateKey(currentTaskId));
      if (storedData) {
        const parsedData = JSON.parse(storedData);
        // 验证数据格式是否正确（必须包含 content1 和 content2）
        if ('content1' in parsedData && 'content2' in parsedData) {
          console.log('✅ 从本地存储加载模板数据:', parsedData);
          
          // 检查内容是否为空，如果为空则继续执行后续逻辑
          const hasValidContent = (parsedData.content1 && parsedData.content1.trim()) || 
                                 (parsedData.content2 && parsedData.content2.trim());
          
          if (hasValidContent) {
            setServiceIntro(parsedData.content1 || '');
            setTargetCustomer(parsedData.content2 || '');
            
            // 同步到内存缓存
            if (currentKeyWord) {
              cacheRef.current[currentKeyWord] = {
                service: parsedData.content1 || '',
                customer: parsedData.content2 || ''
              };
            }
            
            // 调用回调函数通知父组件
            if (onServiceIntroChange) onServiceIntroChange(parsedData.content1 || '');
            if (onTargetCustomerChange) onTargetCustomerChange(parsedData.content2 || '');
            
            return; // 如果本地有有效数据，直接返回，不调用API
          } else {
            // 清理空的本地存储数据
            localStorage.removeItem(getTemplateKey(currentTaskId));
          }
        }
      }
      
      // 2. 第二优先级：从后端API获取已有数据
      setLoading(true);
      
      try {
        const response = await getAnalysisModulesApi(currentTaskId);
        
        if (response && response.status === 200 && response.data) {
          const analysisModules = response.data;
          
          // 查找当前任务对应的分析模块
          // 优先查找task_id匹配的记录，如果没有则使用最新的记录
          let targetModule = null;
          
          if (Array.isArray(analysisModules) && analysisModules.length > 0) {
            // 首先尝试查找task_id匹配的记录
            targetModule = analysisModules.find(module => module.task_id === currentTaskId);
            
            // 如果没有找到匹配的task_id，使用最新的记录（按create_time排序）
            if (!targetModule) {
              targetModule = analysisModules
                .filter(module => module.service_introduction || module.customer_description) // 过滤掉空记录
                .sort((a, b) => (b.create_time || 0) - (a.create_time || 0))[0]; // 按创建时间倒序，取最新的
            }
          }
          
          if (targetModule) {
            console.log('✅ 找到匹配的分析模块:', targetModule);
            
            const serviceIntro = targetModule.service_introduction || '';
            const customerDesc = targetModule.customer_description || '';
            
            if (serviceIntro || customerDesc) {
              const backendTemplate = {
                content1: serviceIntro,
                content2: customerDesc
              };
              
              // 内容清洗
              const cleanedTemplate = {
                content1: cleanContent(backendTemplate.content1),
                content2: cleanContent(backendTemplate.content2)
              };
              
              setServiceIntro(cleanedTemplate.content1);
              setTargetCustomer(cleanedTemplate.content2);
              
              // 将后端数据保存到 localStorage，避免下次重复请求
              localStorage.setItem(getTemplateKey(currentTaskId), JSON.stringify(cleanedTemplate));
              
              // 同步到内存缓存
              if (currentKeyWord) {
                cacheRef.current[currentKeyWord] = {
                  service: cleanedTemplate.content1,
                  customer: cleanedTemplate.content2
                };
              }
              
              // 调用回调函数通知父组件
              if (onServiceIntroChange) onServiceIntroChange(cleanedTemplate.content1);
              if (onTargetCustomerChange) onTargetCustomerChange(cleanedTemplate.content2);
              
              setLoading(false);
              return; // 成功从后端获取数据，结束流程
            }
          }
        }
      } catch (error) {
        console.log('⚠️ 从后端获取分析模块数据失败，将使用AI模型生成:', error);
        // 后端获取失败，继续执行AI模型生成逻辑
      }
      
      // 3. 最低优先级：只有当本地和后端都没有数据且关键词存在时，才调用模型接口生成新模板
      if (currentKeyWord) {
        console.log('🔄 本地和后端都无数据，使用AI模型生成新模板');
        try {
          const data = await postChatModel(currentKeyWord, "template");
          console.log('🤖 Chat API响应:', data);
          
          if (data && data.code === 0 && data.messages && data.messages[0] && data.messages[0].content) {
            const jsonData = JSON.parse(data.messages[0].content);
            const newTemplate = {
              content1: jsonData['我提供的服务介绍'] || jsonData['服务介绍'],
              content2: jsonData['我想要的客户描述'] || jsonData['目标客户描述']
            };
            
            // 内容清洗
            const cleanedTemplate = {
              content1: cleanContent(newTemplate.content1),
              content2: cleanContent(newTemplate.content2)
            };
            
            setServiceIntro(cleanedTemplate.content1);
            setTargetCustomer(cleanedTemplate.content2);
            
            // 将新生成的模板保存到 localStorage
            localStorage.setItem(getTemplateKey(currentTaskId), JSON.stringify(cleanedTemplate));
            
            // 同步到内存缓存
            cacheRef.current[currentKeyWord] = {
              service: cleanedTemplate.content1,
              customer: cleanedTemplate.content2
            };
            
            // 调用回调函数通知父组件
            console.log('🔄 调用回调函数，传递数据:', {
              serviceIntro: cleanedTemplate.content1,
              targetCustomer: cleanedTemplate.content2
            });
            if (onServiceIntroChange) onServiceIntroChange(cleanedTemplate.content1);
            if (onTargetCustomerChange) onTargetCustomerChange(cleanedTemplate.content2);
            
            // 自动创建分析模块，将模板数据保存到后端
            try {
              await createAnalysisModuleApi({
                task_id: currentTaskId,
                service_introduction: cleanedTemplate.content1,
                customer_description: cleanedTemplate.content2
              });
              console.log('✅ 分析模块创建成功');
            } catch (error) {
              console.error('❌ 创建分析模块失败:', error);
              // 不影响用户体验，只在控制台记录错误
            }
          } else {
            console.error('❌ Chat API返回数据格式异常:', data);
            // 设置默认值，避免空字符串
            const defaultTemplate = {
              content1: `我是${currentKeyWord}相关的服务提供商`,
              content2: `需要${currentKeyWord}相关服务的客户群体`
            };
            setServiceIntro(defaultTemplate.content1);
            setTargetCustomer(defaultTemplate.content2);
            
            if (onServiceIntroChange) onServiceIntroChange(defaultTemplate.content1);
            if (onTargetCustomerChange) onTargetCustomerChange(defaultTemplate.content2);
          }
        } catch (error) {
          console.error('❌ Chat API请求失败:', error);
          // 设置默认值，避免空字符串
          const defaultTemplate = {
            content1: `我是${currentKeyWord}相关的服务提供商`,
            content2: `需要${currentKeyWord}相关服务的客户群体`
          };
          setServiceIntro(defaultTemplate.content1);
          setTargetCustomer(defaultTemplate.content2);
          
          if (onServiceIntroChange) onServiceIntroChange(defaultTemplate.content1);
          if (onTargetCustomerChange) onTargetCustomerChange(defaultTemplate.content2);
        }
      }
      setLoading(false);
    } catch (error) {
      console.error('❌ Error loading template:', error);
      Message.error("模板加载失败");
      setLoading(false);
    }
  };
  
  // 保存编辑内容到本地存储
  const saveEditedContent = async (type: 'service' | 'customer', content: string) => {
    const currentTaskId = currentTask?.task_id;
    if (!currentTaskId) return;
    
    const cleanedContent = cleanContent(content);
    
    // 获取当前存储的模板数据
    const storedData = localStorage.getItem(getTemplateKey(currentTaskId));
    let templateData = storedData ? JSON.parse(storedData) : { content1: '', content2: '' };
    
    // 更新对应字段
    if (type === 'service') {
      templateData.content1 = cleanedContent;
      setServiceIntro(cleanedContent);
    } else {
      templateData.content2 = cleanedContent;
      setTargetCustomer(cleanedContent);
    }
    
    // 保存到本地存储
    localStorage.setItem(getTemplateKey(currentTaskId), JSON.stringify(templateData));
    
    // 同步到内存缓存
    if (currentTask?.keyword) {
      if (!cacheRef.current[currentTask.keyword]) {
        cacheRef.current[currentTask.keyword] = { service: '', customer: '' };
      }
      
      if (type === 'service') {
        cacheRef.current[currentTask.keyword].service = cleanedContent;
      } else {
        cacheRef.current[currentTask.keyword].customer = cleanedContent;
      }
    }
    
    // 调用回调函数通知父组件
    if (type === 'service' && onServiceIntroChange) {
      onServiceIntroChange(cleanedContent);
    } else if (type === 'customer' && onTargetCustomerChange) {
      onTargetCustomerChange(cleanedContent);
    }
    
    // 6. 保存编辑后的内容到后端分析模块
    try {
      await updateAnalysisModuleApi({
        task_id: currentTaskId,
        service_introduction: type === 'service' ? cleanedContent : templateData.content1,
        customer_description: type === 'customer' ? cleanedContent : templateData.content2
      });
      console.log('分析模块更新成功');
    } catch (error) {
      console.error('更新分析模块失败:', error);
      // 不影响用户体验，只在控制台记录错误
    }
    
    Message.success('保存成功');
  };

  // 处理输入变化 - 实时保存
  const handleInputChangeT1 = (value: string) => {
    setServiceIntro(value);
    // 实时保存到本地存储
    const currentTaskId = currentTask?.task_id;
    if (currentTaskId) {
      const storedData = localStorage.getItem(getTemplateKey(currentTaskId));
      let templateData = storedData ? JSON.parse(storedData) : { content1: '', content2: '' };
      templateData.content1 = value;
      localStorage.setItem(getTemplateKey(currentTaskId), JSON.stringify(templateData));
    }
  };

  const handleInputChangeT2 = (value: string) => {
    setTargetCustomer(value);
    // 实时保存到本地存储
    const currentTaskId = currentTask?.task_id;
    if (currentTaskId) {
      const storedData = localStorage.getItem(getTemplateKey(currentTaskId));
      let templateData = storedData ? JSON.parse(storedData) : { content1: '', content2: '' };
      templateData.content2 = value;
      localStorage.setItem(getTemplateKey(currentTaskId), JSON.stringify(templateData));
    }
  };
  

  useEffect(() => {
    const currentTaskId = currentTask?.task_id;
    
    if (!currentTaskId) {
      setServiceIntro('');
      setTargetCustomer('');
      return;
    }

    // 检查是否为首次加载或任务切换
    const isFirstMount = !window._lastTaskId;
    const isTaskChanged = window._lastTaskId !== currentTaskId;
    
    if (isFirstMount || isTaskChanged) {
      loadTemplateData();
      window._lastTaskId = currentTaskId;
    }
  }, [currentTask?.task_id, currentTask?.keyword]);

  return (
    <>
      {/* 添加CSS样式来隐藏滚动条 */}
      <style>
        {`
          /* 隐藏所有滚动条但保持滚动功能 */
          .arco-card::-webkit-scrollbar,
          .arco-card *::-webkit-scrollbar {
            width: 0 !important;
            height: 0 !important;
            display: none !important;
          }
          
          .arco-card,
          .arco-card * {
            scrollbar-width: none !important;
            -ms-overflow-style: none !important;
          }
          
          /* 隐藏Input.TextArea的滚动条 */
          .arco-textarea::-webkit-scrollbar,
          .arco-textarea *::-webkit-scrollbar {
            width: 0 !important;
            height: 0 !important;
            display: none !important;
          }
          
          .arco-textarea,
          .arco-textarea * {
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
        `}
      </style>
      
      <div style={{ width: '1300px',marginLeft:20 }}>
        {/* 第一行：服务介绍和客户描述 */}
        <div style={{ display: 'flex',marginBottom: 20,gap:20 }}>
        <div style={{ flex: 0.8 }}>
          <div style={{ marginBottom: 8, fontWeight: 600, fontSize: 17, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>我的服务介绍</span>

          </div>
          <Card 
            style={{ 
              background: '#f5f5f5', 
              border: '1px solid #e5e6eb', 
              height: 80, 
              overflow: 'auto', 
              borderRadius: '12px',
              padding: 0
            }} 
            bodyStyle={{ 
              padding: '8px 14px',
              margin: 0,
              height: '100%'
            }}
          >
            {loading ? (
              <div style={{ color: '#bdbdbd', fontSize: 15 }}>加载中...</div>
            ) : isInitialTask && isEditable ? (
              <Input.TextArea
                value={serviceIntro}
                onChange={handleInputChangeT1}
                placeholder="请输入服务介绍"
                style={{ 
                  width: '100%',
                  fontSize: 15,
                  border: 'none',
                  background: 'transparent',
                  resize: 'none',
                  padding: 0,
                  margin: 0,
                  lineHeight: 1.5
                }}
                autoSize={{ minRows: 2, maxRows: 3 }}
                onBlur={() => saveEditedContent('service', serviceIntro)}
              />
            ) : (
              <div style={{ 
                color: isEditable ? '#1d2129' : '#999', 
                fontStyle: isEditable ? 'normal' : 'italic',
                opacity: isEditable ? 1 : 0.8,
                fontSize: '15px',
                lineHeight: 1.5,
                padding: 0,
                margin: 0
              }}>
                {serviceIntro || '暂无服务介绍'}
                {!isEditable && <span style={{ color: '#999', fontSize: '15px', marginLeft: '8px' }}>(分析完成，不可编辑)</span>}
              </div>
            )}
          </Card>
        </div>
        <div style={{ flex: 0.8 }}>
          <div style={{ marginBottom: 8, fontWeight: 600, fontSize: 17, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>我想要的客户</span>

          </div>
          <Card style={{ background: '#f5f5f5', border: '1px solid #e5e6eb', height: 80, overflow: 'auto', borderRadius: '12px' }} bodyStyle={{ padding: 14, color: '#bdbdbd', fontSize: 15 }}>
            {loading ? (
              '加载中...'
            ) : isInitialTask && isEditable ? (
              <Input.TextArea
                value={targetCustomer}
                onChange={handleInputChangeT2}
                placeholder="请输入目标客户描述"
                style={{ 
                  flex: 1,
                  minHeight: 40,
                  fontSize: 15,
                  border: 'none',
                  background: 'transparent',
                  resize: 'none',
                  padding: 0,
                  margin: 0,
                  lineHeight: 1.5
                }}
                autoSize={{ minRows: 2, maxRows: 3 }}
                onBlur={() => saveEditedContent('customer', targetCustomer)}
              />
            ) : (
              <div style={{ 
                color: isEditable ? '#1d2129' : '#999', 
                fontStyle: isEditable ? 'normal' : 'italic',
                opacity: isEditable ? 1 : 0.8,
                fontSize: '15px', // 统一字体大小，与输入框一致
                lineHeight: '1.5', // 统一行高
                minHeight: '40px', // 统一最小高度
                display: 'block',
                paddingTop: 0
              }}>
                {targetCustomer || '暂无客户描述'}
                {!isEditable && <span style={{ color: '#999', fontSize: '15px', marginLeft: '8px' }}>(分析完成，不可编辑)</span>}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
    </>
  );
}

