import React, { useState, useEffect } from 'react';
import { Button, Input, Message } from '@arco-design/web-react';

// 声明Chrome扩展API类型
declare global {
  interface Window {
    chrome?: {
      runtime?: {
        sendMessage: (extensionId: string, message: any, callback: (response: any) => void) => void;
      };
    };
  }
}

interface SearchBarProps {
  onSearch?: (keyword: string, platforms: string[]) => void;
  quota?: { used_quota: number; total_quota: number };
}

const SearchBar: React.FC<SearchBarProps> = ({ onSearch, quota }) => {
  // 本地状态
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(false);
  const [pluginDetected, setPluginDetected] = useState(false);
  // const [showPluginGuide, setShowPluginGuide] = useState(false);

  // 检测插件是否安装
  useEffect(() => {
    const checkPlugin = () => {
      // 查找disabled按钮，包括隐藏的按钮（插件会将按钮设为display: 'none'）
      const downloadButton = document.querySelector('button[disabled][style*="not-allowed"]') as HTMLButtonElement;
      if (downloadButton && downloadButton.innerText && downloadButton.innerText.trim()) {
        setPluginDetected(true);
      } else {
        setPluginDetected(false);
      }
    };

    // 立即检查一次
    checkPlugin();
    
    // 每2秒检查一次插件状态
    const interval = setInterval(checkPlugin, 2000);
    
    return () => clearInterval(interval);
  }, []);

  // 处理搜索
  const handleSearch = async () => {
    if (!keyword.trim()) {
      Message.error('请输入关键词');
      return;
    }

    if (!pluginDetected) {
      Message.error('插件未安装，请先安装插件');
      return;
    }

    // 检查评论收集额度是否超限
    if (quota && quota.used_quota >= quota.total_quota) {
      Message.error('评论收集额度已超出，请联系客服');
      return;
    }

    setLoading(true);
    try {
      // 查找插件按钮获取扩展ID
      const downloadButton = document.querySelector('button[disabled][style*="not-allowed"]') as HTMLButtonElement;
      if (!downloadButton || !downloadButton.innerText) {
        Message.error('插件未正确配置');
        return;
      }

      const extensionId = downloadButton.innerText.trim();
      
      // 发送消息到插件
      if (window.chrome && window.chrome.runtime && window.chrome.runtime.sendMessage) {
        const message = {
          action: 'openSearch',
          query: keyword,
          platform: '抖音', // 默认抖音平台
          autoSwitchValue: 'true'
        };
        
        window.chrome.runtime.sendMessage(extensionId, message, (response) => {
          if (response && response.status === 'success') {
            Message.success('已打开搜索链接');
          } else {
            Message.error('打开搜索链接失败');
          }
        });
      } else {
        Message.error('Chrome环境不可用');
      }

      // 调用父组件的搜索回调
      if (onSearch) {
        onSearch(keyword, ['抖音']);
      }
    } catch (error) {
      console.error('搜索失败:', error);
      Message.error('搜索失败，请检查插件状态');
    } finally {
      setLoading(false);
    }
  };

  // 回车触发搜索
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  // 当插件未检测到时，显示安装提示
  if (!pluginDetected) {
    return (
      <div style={{ 
        background: '#3491FA1A', 
        margin: '0 0 20px 0', 
        boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
        padding: '20px 36px', 
        borderRadius: 12
      }}>
        <h3 style={{ fontWeight: 700, color: '#222', margin: '0 0 16px 0', fontSize: '16px' }}>
          使用评论收集功能推荐使用Windows10/11系统电脑，Edge或Chrome浏览器，下载安装最新的评论收集插件，注意有原来的插件要删除，弹出此提示说明插件有更新
        </h3>
        <p style={{ fontSize: 15, color: '#444', fontFamily: '微软雅黑, Arial, sans-serif', margin: '12px 0 0 0' }}>
          安装或更新收集插件视频：
          <a
            href="https://xcn9f50y4vw5.feishu.cn/wiki/Y26hwDUgAioiDzkv7CbcZFC5n1b#share=ZPBed4YFSolUMxASrvc65zJn8g"
            target="_blank"
            rel="noreferrer"
            style={{ color: '#3491fa', marginLeft: 4 }}
          >
            查看视频教程
          </a>
        </p>
        <p style={{ fontSize: 15, color: '#444', fontFamily: '微软雅黑, Arial, sans-serif', margin: '8px 0' }}>
          1. 点击右侧下载
          <a
            href="https://iry-1256349444.cos.ap-guangzhou.myqcloud.com/%E5%86%85%E5%AE%B9%E6%94%B6%E9%9B%86%E6%8F%92%E4%BB%B6.zip"
            download="智能评论插件.zip"
            style={{ color: '#3491fa', margin: '0 4px' }}
          >
            .zip文件
          </a>
          并解压缩，得到插件的文件夹，注意安装完成后也不要移动和删除解压后的文件夹
        </p>
        <p style={{ fontSize: 15, color: '#444', fontFamily: '微软雅黑, Arial, sans-serif', margin: '8px 0' }}>
          2. 打开 Edge或Chrome 浏览器，复制 <code style={{ background: '#f0f0f0', padding: '2px 6px', borderRadius: '4px', fontFamily: 'monospace' }}>chrome://extensions</code> 并粘贴到地址栏中，进入扩展设置。
        </p>
        <p style={{ fontSize: 15, color: '#444', fontFamily: '微软雅黑, Arial, sans-serif', margin: '8px 0' }}>
          3. 在扩展管理页面的右上角，打开"开发者模式"。
        </p>
        <p style={{ fontSize: 15, color: '#444', fontFamily: '微软雅黑, Arial, sans-serif', margin: '8px 0' }}>
          4. 点击左上角的"加载已解压的扩展程序"按钮，在弹出的文件选择对话框中，选择解压后的插件文件夹。（如果有旧版本的插件请移除）
        </p>
        <p style={{ fontSize: 15, color: '#444', fontFamily: '微软雅黑, Arial, sans-serif', margin: '8px 0' }}>
          5. 确认插件已安装，在扩展管理页面中，应该能够看到刚刚加载的插件，并且插件已经启用
        </p>
        <p style={{ fontSize: 15, color: '#444', fontFamily: '微软雅黑, Arial, sans-serif', margin: '8px 0' }}>
          6. 安装完成后，请刷新此页面，注意不要移动和删除解压后的插件文件夹
        </p>
        <div style={{ textAlign: 'center', marginTop: '20px' }}>
          <Button 
            type="primary"
            onClick={() => {
              // 重新尝试检测
              setTimeout(() => {
                const downloadButton = document.querySelector('button[disabled][style*="not-allowed"]') as HTMLButtonElement;
                if (downloadButton && downloadButton.innerText && downloadButton.innerText.trim()) {
                  setPluginDetected(true);
                }
              }, 1000);
            }}
          >
            我已安装，重新检测
          </Button>
        </div>
      </div>
    );
  }

  // 检测到插件时，显示搜索框
  return (
    <div style={{ 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      padding: '10vh 20px 50px 20px',
      background: '#fff',
      borderRadius: '8px',
      marginBottom: '50px'
    }}>
      <Input 
        placeholder="输入关键词可用逗号分隔，如：广州,招聘" 
        style={{ 
          width: 'auto', 
          minWidth: 300, 
          maxWidth: 600, 
          flex: 1, 
          marginRight: 16 
        }}
        value={keyword}
        onChange={setKeyword}
        onKeyPress={handleKeyPress}
      />
      <Button 
        type="primary" 
        onClick={handleSearch}
        loading={loading}
        disabled={quota && quota.used_quota >= quota.total_quota}
        title={quota && quota.used_quota >= quota.total_quota ? '评论收集额度已超出，请联系客服' : ''}
      >
        {quota && quota.used_quota >= quota.total_quota ? '额度已超限' : '搜索'}
      </Button>
      

    </div>
  );
};

export default SearchBar;
