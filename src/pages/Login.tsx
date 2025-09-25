import { login } from '../api/index';
import React, { useEffect } from 'react';
import { Form, Input, Button, Message } from '@arco-design/web-react';
import { IconUser, IconLock } from '@arco-design/web-react/icon';
import { setToken } from '../api/api';
import { useNavigate, useSearchParams } from 'react-router-dom';





// LoginLogo 组件
function LoginLogo() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 30 }}>
      <img src="/favicon.svg" alt="favicon" style={{ width: 30, marginRight: 10 }} />
      <h5 style={{ color: '#3491FA', fontWeight: 700, fontSize: 22, margin: 0 }}>智网识客</h5>
    </div>
  );
}

// LoginCard 组件
function LoginCard({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      width: 300,
      minWidth: 300,
      background: 'rgba(255,255,255,0.9)',
      borderRadius: 8,
      boxShadow: '0 2px 16px 0 rgba(0,0,0,0.08)',
      padding: 20,
      marginLeft: 'calc(50vw + 10vw - 150px)',
      flexShrink: 0
    }}>
      {children}
    </div>
  );
}

// LoginBg 组件
function LoginBg({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      minHeight: '100vh',
      width: '100vw',
      background: "url('https://picx.zhimg.com/70/v2-52dbe8bdb0e4854c1e5bd39ff75a68d6_1440w.avis?source=172ae18b&biz_tag=Post') no-repeat center center",
      backgroundSize: 'cover',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden'
    }}>
      {children}
    </div>
  );
}

export default function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  // 从URL参数获取用户名和密码并自动登录
  useEffect(() => {
    const username = searchParams.get('username');
    const password = searchParams.get('password');
    
    if (username && password) {
      // console.log('从URL参数获取到用户名和密码，开始自动登录');
      handleSubmit({ username, password });
    }
  }, [searchParams]);
  
  // 表单提交
  const handleSubmit = async (values: { username: string; password: string }) => {
    try {
      // console.log('开始登录流程，用户名:', values.username);
      
      // 1. 调用接口
      const res = await login(values.username, values.password);
              // console.log('登录API响应:', res);
      
      // 2. 根据接口返回结果判断是否登录成功
      if (res && (res.status === 200 || res.msg === 'success' || res.success)) {
        // 检查token是否存在
        if (res.token) {
          // console.log('登录成功，获取到token，开始保存认证信息');
          
          // 保存token和用户名
          setToken(res.token);
          // 保存用户名到localStorage
          if (values.username) {
            localStorage.setItem('username', values.username);
          }
          // console.log('token和用户名已保存到localStorage');
          
          Message.success('登录成功');
           
                     // 登录成功后直接跳转到主页
          // console.log('登录成功，直接跳转到主页');
          navigate('/');
         } else {
          console.error('登录异常：成功但未返回token');
          Message.error('登录成功但未获取到认证信息，请重试');
        }
      } else {
        const errorMsg = res && res.msg ? res.msg : (res && res.error ? res.error : '登录失败');
        Message.error(errorMsg);
      }
    } catch (err: any) {
      console.error('登录异常：', err.message || '未知错误');
      const errorMsg = err.message || '网络错误或用户名密码错误';
      Message.error(errorMsg);
    }
  };

  // 检查是否正在从URL参数自动登录
  const isAutoLoggingIn = searchParams.get('username') && searchParams.get('password');

  return (
    <LoginBg>
      <LoginCard>
        <LoginLogo />
        {isAutoLoggingIn ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ marginBottom: 10 }}>正在自动登录...</div>
            <div style={{ fontSize: '14px', color: '#666' }}>
              用户名: {searchParams.get('username')}
            </div>
          </div>
        ) : (
          <Form layout="vertical" onSubmit={handleSubmit}>
            <Form.Item field="username" rules={[{ required: true, message: '请输入账户名' }]}>
              <Input prefix={<IconUser />} placeholder="请输入账户名" />
            </Form.Item>
            <Form.Item field="password" rules={[{ required: true, message: '请输入密码' }]}>
              <Input.Password prefix={<IconLock />} placeholder="请输入密码" />
            </Form.Item>
            <Button shape='round' type="primary" long style={{ marginTop: 8 }} htmlType="submit">
              登录
            </Button>
          </Form>
        )}
      </LoginCard>
    </LoginBg>
  );
}
