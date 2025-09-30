// 版本检查相关的API接口
// 专门处理版本检查，避免影响其他接口的URL配置

// 获取聊天版本
export async function getChatVersion() {
  try {
    // 直接使用正确的本地服务地址
    const localResponse = await fetch('http://127.0.0.1:3010/get_version', {
      method: 'GET'
    });
    
    if (localResponse.status === 200) {
      const data = await localResponse.json();
      console.log('从本地服务获取版本信息成功');
      
      // 检查响应格式并返回正确的数据结构
      if (data && data.status === 200 && data.version) {
        return data; // 返回完整响应
      } else if (data && data.version) {
        // 如果没有status字段，包装成标准格式
        return { 
          status: 200, 
          version: data.version, 
          message: data.message || data.msg || '获取版本成功',
          data: data.data || null
        };
      } else {
        console.warn('本地服务返回的版本数据格式异常:', data);
        return { 
          status: 200, 
          version: '1.0.0', 
          message: '使用默认版本信息' 
        };
      }
    } else {
      console.log(`本地服务响应异常，状态码: ${localResponse.status}`);
      // 如果本地服务不可用，返回默认版本信息
      return { 
        status: 200, 
        version: '1.0.0', 
        message: '本地服务不可用，使用默认版本信息' 
      };
    }
    
  } catch (error) {
    console.error('获取版本信息失败:', error);
    return { 
      status: 0, 
      version: '1.0.0', 
      message: '获取版本信息失败，使用默认版本信息' 
    };
  }
}

// 检查版本服务是否可用
export async function checkVersionService() {
  try {
    const response = await fetch('http://127.0.0.1:3010/get_version', {
      method: 'GET',
      signal: AbortSignal.timeout(3000) // 3秒超时
    });
    return response.status === 200;
  } catch (error) {
    console.log('版本服务检查失败:', error);
    return false;
  }
}
