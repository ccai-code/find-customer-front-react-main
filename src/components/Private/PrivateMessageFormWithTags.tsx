import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Input, Tag, Spin, Message } from '@arco-design/web-react';
import { postAnalysisSatisfactionApi, saveMessageApi, getUserSatisfactionApi, clearUserSatisfactionCache, clearMarketProgressCache } from '../../api/api';

const { TextArea } = Input;

interface PrivateMessageFormWithTagsProps {
  inputValue: string;
  onInputChange: (value: string) => void;
  onBlur?: () => void; // 添加失焦回调
  currentTaskKeyword?: string;
  taskId?: string;
}

interface TagGroupProps {
  title: string;
  tags: string[];
  color: string;
  style?: React.CSSProperties;
}

const TagGroup: React.FC<TagGroupProps> = ({ title, tags, color, style }) => {
  // 使用 useMemo 确保标签数组的稳定性，避免重复渲染
  const uniqueTags = useMemo(() => {
    return Array.from(new Set(tags)).map((tag, index) => ({
      id: `${title}-${tag}-${index}`,
      text: tag
    }));
  }, [tags, title]);
  
  // 根据颜色设置标题颜色
  const getTitleColor = (color: string) => {
    switch (color) {
      case 'green':
        return '#52c41a'; // 绿色
      case 'red':
        return '#ff4d4f'; // 红色
      case 'orange':
        return '#fa8c16'; // 橙色
      default:
        return '#1d2129'; // 默认颜色
    }
  };
  
  return (
    <div style={{ marginBottom: '16px', ...style }}>
      <div style={{ 
        display: 'flex',
        alignItems: 'flex-start',
        gap: '16px'
      }}>
        {/* 左侧标题 */}
        <div style={{ 
          fontSize: '16px', 
          fontWeight: '700', 
          color: getTitleColor(color), 
          textShadow: '0 1px 2px rgba(0,0,0,0.1)',
          letterSpacing: '0.5px',
          minWidth: '80px', // 固定标题宽度，确保对齐
          flexShrink: 0, // 防止标题被压缩
          paddingTop: '8px' // 添加顶部内边距，与话术输入框顶部对齐
        }}>
          {title}
        </div>
        
        {/* 右侧标签 */}
        <div style={{ 
          display: 'flex', 
          flexWrap: 'wrap', 
          gap: '8px',
          flex: 1, // 占据剩余空间
          paddingTop: '8px' // 添加顶部内边距，与话术输入框顶部对齐
        }}>
          {uniqueTags.map((tagItem) => (
            <Tag 
              key={tagItem.id} 
              color={color}
              style={{ 
                fontSize: '14px', 
                padding: '6px 12px',
                borderRadius: '16px',
                fontWeight: '500',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                border: 'none'
              }}
            >
              {tagItem.text}
            </Tag>
          ))}
        </div>
      </div>
    </div>
  );
};

const PrivateMessageFormWithTags: React.FC<PrivateMessageFormWithTagsProps> = ({
  inputValue,
  onInputChange,
  onBlur,
  currentTaskKeyword,
  taskId
}) => {
  const [loading, setLoading] = useState(false);
  const [finalSatisfiedTags, setFinalSatisfiedTags] = useState<string[]>([]);
  const [finalUnsatisfiedTags, setFinalUnsatisfiedTags] = useState<string[]>([]);
  const [finalQuestionTags, setFinalQuestionTags] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const rightSideRef = useRef<HTMLDivElement>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 保存消息到后端
  const saveMessage = async (message: string) => {
    if (!taskId || !message.trim()) return;
    
    setSaving(true);
    try {
      const response = await saveMessageApi({
        task_id: taskId,
        message: message.trim()
      });
      
      if (response && response.status === 200) {
        // 保存成功后，立即清理营销进度缓存，确保获取最新数据
        clearMarketProgressCache(taskId);
        
        // 立即触发进度刷新事件
        const event = new CustomEvent('privateMessageComplete', {
          detail: { taskId }
        });
        window.dispatchEvent(event);
        
        // 延迟更新满意度分析数据，避免立即清除缓存
        setTimeout(() => {
          clearUserSatisfactionCache(taskId);
          fetchUserSatisfaction();
        }, 1000); // 延迟1秒，让后端有时间处理数据
      } else {
        console.warn('❌ 消息保存失败:', response);
        Message.error('消息保存失败，请重试');
      }
    } catch (error) {
      console.error('❌ 保存消息异常:', error);
      Message.error('保存消息时发生错误');
    } finally {
      setSaving(false);
    }
  };

  // 获取用户满意度分析数据
  const fetchUserSatisfaction = async () => {
    if (!taskId) return;
    
    
    setLoading(true);
    try {
      const response = await getUserSatisfactionApi(taskId);
      
      if (response && response.status === 200) {
        const data = response.data;
        
        // 清空之前的数据
        setFinalSatisfiedTags([]);
        setFinalUnsatisfiedTags([]);
        setFinalQuestionTags([]);
        
        // 处理满意点数据
        if (data.满意点 && typeof data.满意点 === 'string') {
          const satisfiedTags = data.满意点.split(';').map((point: string) => point.trim()).filter(Boolean);
          setFinalSatisfiedTags(satisfiedTags);
        }
        
        // 处理不满点数据
        if (data.不满点 && typeof data.不满点 === 'string') {
          const unsatisfiedTags = data.不满点.split(';').map((point: string) => point.trim()).filter(Boolean);
          setFinalUnsatisfiedTags(unsatisfiedTags);
        }
        
        // 处理疑问点数据
        if (data.疑问点 && typeof data.疑问点 === 'string') {
          const questionTags = data.疑问点.split(';').map((point: string) => point.trim()).filter(Boolean);
          setFinalQuestionTags(questionTags);
        }
        
        // 移除输入框内容更新逻辑，由父组件统一管理
        // 只处理满意度分析标签数据
        
      } else {
        console.warn('❌ PrivateMessageFormWithTags 获取用户满意度数据失败:', response);
        // 清空数据，显示"暂无数据"提示
        setFinalSatisfiedTags([]);
        setFinalUnsatisfiedTags([]);
        setFinalQuestionTags([]);
      }
    } catch (error) {
      console.error('❌ PrivateMessageFormWithTags 获取用户满意度数据失败:', error);
      // 清空数据，显示"暂无数据"提示
      setFinalSatisfiedTags([]);
      setFinalUnsatisfiedTags([]);
      setFinalQuestionTags([]);
    } finally {
      setLoading(false);
    }
  };

  // 获取满意度分析数据（兼容旧接口）
  const fetchSatisfactionAnalysis = async () => {
    if (!taskId || !inputValue.trim()) return;
    
    setLoading(true);
    try {
      const response = await postAnalysisSatisfactionApi({
        task_id: taskId,
        content: inputValue
      });
      
      if (response && response.status === 200) {
        const data = response.data;
        
        // 处理满意点数据 - 根据实际API响应格式调整
        if (data.满意点 && typeof data.满意点 === 'string') {
          // 将字符串按分号分割成数组
          const satisfiedTags = data.满意点.split(';').map((point: string) => point.trim()).filter(Boolean);
          setFinalSatisfiedTags(satisfiedTags);
        }
        
        // 处理不满点数据 - 根据实际API响应格式调整
        if (data.不满点 && typeof data.不满点 === 'string') {
          // 将字符串按分号分割成数组
          const unsatisfiedTags = data.不满点.split(';').map((point: string) => point.trim()).filter(Boolean);
          setFinalUnsatisfiedTags(unsatisfiedTags);
        }
        
        // 处理疑问点数据 - 根据实际API响应格式调整
        if (data.疑问点 && typeof data.疑问点 === 'string') {
          // 将字符串按分号分割成数组
          const questionTags = data.疑问点.split(';').map((point: string) => point.trim()).filter(Boolean);
          setFinalQuestionTags(questionTags);
        }
        
      } else {
        console.warn('满意度分析：接口返回失败');
      }
    } catch (error) {
      console.error('满意度分析：获取失败 -', error instanceof Error ? error.message : '未知错误');
      // 移除错误弹窗提示，只在控制台记录错误
    } finally {
      setLoading(false);
    }
  };

  // 处理输入框失焦事件，自动保存
  const handleInputBlur = () => {
    if (taskId && inputValue.trim()) {
      // 清除之前的定时器
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      
      // 立即保存
      saveMessage(inputValue);
    }
    onBlur?.(); // 调用父组件的onBlur回调
  };

  // 处理输入框内容变化
  const handleInputChange = (value: string) => {
    
    // 直接调用父组件的onInputChange，不管理本地状态
    onInputChange(value);
  };

  // 当任务ID或输入内容变化时，自动获取满意度分析
  useEffect(() => {
    if (taskId && inputValue.trim()) {
      const timer = setTimeout(() => {
        fetchSatisfactionAnalysis();
      }, 1000); // 延迟1秒，避免频繁调用
      
      return () => clearTimeout(timer);
    }
  }, [taskId, inputValue]);

  // 自动保存话术内容到本地缓存
  useEffect(() => {
    if (taskId && inputValue.trim()) {
      const localMessageKey = `privateMessage_${taskId}`;
      localStorage.setItem(localMessageKey, inputValue.trim());
    }
  }, [taskId, inputValue]);

  // 当任务ID变化时，自动加载对应的话术内容和满意度数据
  useEffect(() => {
    if (taskId) {
      // 立即清空之前的满意度数据，避免显示上一个任务的内容
      setFinalSatisfiedTags([]);
      setFinalUnsatisfiedTags([]);
      setFinalQuestionTags([]);
      setLoading(true);
      
      
      // 增加防抖时间，避免与父组件的请求冲突
      const timer = setTimeout(() => {
        // 只获取满意度分析数据，不管理输入框内容
        fetchUserSatisfaction();
      }, 1000); // 延迟1秒，避免与父组件的请求冲突
      
      return () => clearTimeout(timer);
    } else {
      // 如果没有任务ID，清空所有数据
      setFinalSatisfiedTags([]);
      setFinalUnsatisfiedTags([]);
      setFinalQuestionTags([]);
      setLoading(false);
    }
  }, [taskId]); // 简化依赖，只监听taskId变化

  return (
    <>
      {/* 隐藏滚动条样式 */}
      <style>
        {`
          /* 隐藏所有滚动条但保持滚动功能 */
          .custom-scrollbar::-webkit-scrollbar,
          .custom-scrollbar *::-webkit-scrollbar {
            width: 0 !important;
            height: 0 !important;
            display: none !important;
          }
          
          .custom-scrollbar,
          .custom-scrollbar * {
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
      
      <div style={{ 
        display: 'flex', 
        marginBottom: '20px', 
        gap: '80px',
        alignItems: 'flex-start'
      }}>
      {/* 左侧：话术输入框 - 调整尺寸确保与右边标签组对齐 */}
      <div style={{ 
        width: '480px',
        height: '120px',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <div style={{ 
          position: 'relative',
          width: '100%'
        }}>
          <TextArea
            value={inputValue}
            onChange={handleInputChange}
            onBlur={handleInputBlur}
            placeholder={`有${currentTaskKeyword || ''}需求吗？`}
            rows={4}
            style={{ 
              borderRadius: '6px',
              width: '100%',
              height: '120px',
              resize: 'none',
              border: '1px solid #e5e6eb',
              fontSize: '14px',
              boxSizing: 'border-box'
            }}
          />
          {/* 保存状态指示器 */}
          {saving && (
            <div style={{
              position: 'absolute',
              top: '8px',
              right: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '12px',
              color: '#1890ff',
              backgroundColor: 'rgba(255, 255, 255, 0.9)',
              padding: '2px 6px',
              borderRadius: '4px',
              border: '1px solid #e5e6eb'
            }}>
              <Spin size={12} />
              保存中...
            </div>
          )}

        </div>
      </div>

            {/* 右侧：标签组 - 调整高度与输入框对齐，向上移动 */}
      <div ref={rightSideRef} 
        className="custom-scrollbar"
        style={{ 
          width: '800px',
          height: '200px',
          overflowY: 'auto',
          padding: '16px',
          borderRadius: '8px',
          backgroundColor: 'white',
          boxSizing: 'border-box',
          marginTop: '-80px' // 向上移动，与标题顶部对齐
        }}
      >
        {loading && (
          <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>
            <Spin size={16} style={{ marginRight: '8px' }} />
            正在加载用户满意度数据...
          </div>
        )}
        

        
        {finalSatisfiedTags.length > 0 && (
          <TagGroup
            title="满意点"
            tags={finalSatisfiedTags}
            color="green"
          />
        )}
        {finalUnsatisfiedTags.length > 0 && (
          <TagGroup
            title="不满点"
            tags={finalUnsatisfiedTags}
            color="red"
          />
        )}
        {finalQuestionTags.length > 0 && (
          <TagGroup
            title="疑问点"
            tags={finalQuestionTags}
            color="orange"
            style={{ marginBottom: 0 }}
          />
        )}
      </div>
      </div>
    </>
  );
};

export default PrivateMessageFormWithTags;
