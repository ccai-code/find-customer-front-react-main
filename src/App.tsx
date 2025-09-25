import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Login from './pages/Login';
import Main from './pages/Main';
import TestUsername from './pages/TestUsername';
// import CommentCollection from './pages/CommentCollection';
// import CommentAnalysis from './pages/CommentAnalysis';
// import PrivateMessage from './pages/PrivateMessage';

function App() {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // 简单的加载状态管理
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  if (isLoading) {
    return <div>加载中...</div>;
  }

  return (
    <Router>
      <Routes>
        {/* 登录页面路由 */}
        <Route path="/login" element={<Login />} />
        
        {/* 测试页面路由 */}
        <Route path="/test-username" element={<TestUsername />} />
        
        {/* 主应用路由 - 组件自己处理认证 */}
        <Route path="/" element={<Main onLogout={() => {}} />} />
        <Route path="/collection" element={<Main onLogout={() => {}} />} />
        <Route path="/analysis" element={<Main onLogout={() => {}} />} />
        <Route path="/analysis/:taskId" element={<Main onLogout={() => {}} />} />
        <Route path="/message" element={<Main onLogout={() => {}} />} />
        
        {/* 通配符路由 - 跳转到主页 */}
        <Route path="*" element={<Main onLogout={() => {}} />} />
      </Routes>
    </Router>
  );
}

export default App;
