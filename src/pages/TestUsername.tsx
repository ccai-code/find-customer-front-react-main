import React, { useEffect, useState } from 'react';
import { Button, Card, Space, Typography } from '@arco-design/web-react';

const { Title, Text } = Typography;

const TestUsername: React.FC = () => {
  const [currentUsername, setCurrentUsername] = useState<string>('');
  const [urlUsername, setUrlUsername] = useState<string>('');

  useEffect(() => {
    // 获取当前localStorage中的用户名
    const storedUsername = localStorage.getItem('username');
    setCurrentUsername(storedUsername || '未设置');

    // 获取URL参数中的用户名
    const urlParams = new URLSearchParams(window.location.search);
    const usernameParam = urlParams.get('username');
    if (usernameParam) {
      try {
        const decodedUsername = decodeURIComponent(usernameParam);
        setUrlUsername(decodedUsername);
      } catch (error) {
        setUrlUsername('解码失败');
      }
    } else {
      setUrlUsername('未提供');
    }
  }, []);

  const testLogin = () => {
    // 模拟登录，设置用户名到localStorage
    const testUsername = '测试用户376号';
    localStorage.setItem('username', testUsername);
    setCurrentUsername(testUsername);
  };

  const clearUsername = () => {
    localStorage.removeItem('username');
    setCurrentUsername('已清除');
  };

  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
      <Title heading={2}>用户名显示测试</Title>
      
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Card title="当前状态">
          <Space direction="vertical">
            <Text>localStorage中的用户名: <strong>{currentUsername}</strong></Text>
            <Text>URL参数中的用户名: <strong>{urlUsername}</strong></Text>
          </Space>
        </Card>

        <Card title="测试操作">
          <Space>
            <Button type="primary" onClick={testLogin}>
              模拟登录（设置测试用户名）
            </Button>
            <Button onClick={clearUsername}>
              清除用户名
            </Button>
            <Button onClick={() => window.location.reload()}>
              刷新页面
            </Button>
          </Space>
        </Card>

        <Card title="测试URL">
          <Text>
            使用以下URL测试自动登录功能：
          </Text>
          <div style={{ 
            background: '#f5f5f5', 
            padding: '10px', 
            borderRadius: '4px', 
            marginTop: '10px',
            wordBreak: 'break-all'
          }}>
            {window.location.origin}/login?username=%E4%BC%9A%E5%91%98376%E5%8F%B7&password=398714
          </div>
        </Card>
      </Space>
    </div>
  );
};

export default TestUsername;
