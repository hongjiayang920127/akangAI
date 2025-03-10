import axios from 'axios';
import router from '../router';

// 创建axios实例
const API = axios.create({
  baseURL: 'http://localhost:3001/api',
  timeout: 10000
});

// 请求拦截器
API.interceptors.request.use(
  config => {
    // 获取token
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    if (token) {
      // 设置Authorization头
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // 添加请求开始时间戳，用于计算请求耗时
    config.metadata = { startTime: new Date() };
    
    console.log(`[API请求] ${config.method.toUpperCase()} ${config.url}`);
    return config;
  },
  error => {
    console.error('[API请求错误]', error);
    return Promise.reject(error);
  }
);

// 响应拦截器
API.interceptors.response.use(
  response => {
    // 计算请求耗时
    const endTime = new Date();
    const duration = endTime - response.config.metadata.startTime;
    console.log(`[API响应] ${response.config.method.toUpperCase()} ${response.config.url} - ${response.status} (${duration}ms)`);
    
    return response;
  },
  error => {
    // 记录请求结束时间和持续时间
    if (error.config) {
      const endTime = new Date();
      const duration = endTime - error.config.metadata.startTime;
      console.error(`[API错误] ${error.config.method.toUpperCase()} ${error.config.url} - ${error.message} (${duration}ms)`);
    }
    
    // 检查错误类型
    if (error.response) {
      // 服务器返回了错误响应
      console.error(`[API服务器错误] 状态码: ${error.response.status}`, error.response.data);
      
      // 处理401错误（未授权）
      if (error.response.status === 401) {
        console.warn('[API认证失败] 需要重新登录');
        
        // 清除token和用户信息
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('user');
        
        // 如果不在登录页，则重定向到登录页
        if (router.currentRoute.value.path !== '/login') {
          router.push('/login');
        }
      }
    } else if (error.request) {
      // 发出请求但没有响应
      console.error('[API无响应] 请求已发送但未收到响应', error.request);
      
      // 检查是否是API服务器刚刚重启导致的问题
      if (error.message.includes('Network Error') || error.message.includes('ECONNREFUSED')) {
        console.warn('[API连接错误] 可能是服务器重启或不可用');
        
        // 如果当前路由需要认证，提示用户可能需要重新登录
        const currentRoute = router.currentRoute.value;
        if (currentRoute.meta.requiresAuth) {
          console.warn('[认证状态] 服务器可能重启，认证状态可能已失效');
        }
      }
    } else {
      // 设置请求时发生了错误
      console.error('[API配置错误]', error.message);
    }
    
    return Promise.reject(error);
  }
);

/**
 * 健康检查函数 - 验证服务器和认证状态
 * @returns {Promise<boolean>} 服务器状态是否良好
 */
API.checkHealth = async function() {
  try {
    // 检查基本连接
    try {
      await axios.get('http://localhost:3001/', { timeout: 3000 });
    } catch (connError) {
      console.error('[API健康检查] 服务器连接失败', connError);
      
      // 如果是连接被拒绝的错误，可能是服务器刚刚重启
      if (connError.message.includes('ECONNREFUSED') || connError.message.includes('Network Error')) {
        console.warn('[API健康检查] 服务器可能已重启，认证状态可能已失效');
        // 标记潜在的认证问题
        localStorage.setItem('auth_needs_verification', 'true');
      }
      
      return false;
    }
    
    // 如果有token，检查认证
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    if (token) {
      try {
        await this.get('/auth/verify');
        console.log('[API健康检查] API服务器连接正常，认证有效');
        // 清除认证需要验证的标记
        localStorage.removeItem('auth_needs_verification');
        return true;
      } catch (authError) {
        if (authError.response && authError.response.status === 401) {
          console.warn('[API健康检查] 认证无效，但服务器在线');
          // 如果检测到会话已经过期
          clearAuthData();
          return true; // 服务器在线，只是认证问题
        }
        console.error('[API健康检查] API服务异常', authError);
        return false;
      }
    } else {
      console.log('[API健康检查] 无认证token，但服务器在线');
      return true;
    }
  } catch (error) {
    console.error('[API健康检查] 服务器连接失败', error);
    return false;
  }
};

/**
 * 清除认证数据
 */
function clearAuthData() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  sessionStorage.removeItem('token');
  sessionStorage.removeItem('user');
  console.log('[认证] 已清除认证数据');
}

/**
 * 确保认证数据的一致性
 * 如果在某个存储中有token但没有用户信息，
 * 或者有用户信息但没有token，则尝试从另一个存储同步
 */
function ensureAuthConsistency() {
  // 获取当前存储状态
  const lsToken = localStorage.getItem('token');
  const lsUser = localStorage.getItem('user');
  const ssToken = sessionStorage.getItem('token');
  const ssUser = sessionStorage.getItem('user');
  
  console.log('[认证] 检查认证数据一致性...');
  
  // 如果localStorage有token但没有user，从sessionStorage同步
  if (lsToken && !lsUser && ssUser) {
    console.log('[认证] 修复: 从sessionStorage同步user信息到localStorage');
    localStorage.setItem('user', ssUser);
  }
  
  // 如果sessionStorage有token但没有user，从localStorage同步
  if (ssToken && !ssUser && lsUser) {
    console.log('[认证] 修复: 从localStorage同步user信息到sessionStorage');
    sessionStorage.setItem('user', lsUser);
  }
  
  // 如果localStorage有user但没有token，从sessionStorage同步
  if (!lsToken && lsUser && ssToken) {
    console.log('[认证] 修复: 从sessionStorage同步token到localStorage');
    localStorage.setItem('token', ssToken);
  }
  
  // 如果sessionStorage有user但没有token，从localStorage同步
  if (!ssToken && ssUser && lsToken) {
    console.log('[认证] 修复: 从localStorage同步token到sessionStorage');
    sessionStorage.setItem('token', lsToken);
  }
  
  return {
    hasToken: !!(lsToken || ssToken),
    hasUser: !!(lsUser || ssUser)
  };
}

// 应用启动时检查认证数据一致性
ensureAuthConsistency();

// 导出API客户端和认证相关函数
API.clearAuthData = clearAuthData;
API.ensureAuthConsistency = ensureAuthConsistency;

export default API;