import { createRouter, createWebHistory } from 'vue-router'
import Home from '../views/Home.vue'

const routes = [
  {
    path: '/',
    name: 'home',
    component: Home
  },
  {
    path: '/about',
    name: 'about',
    component: () => import('../views/About.vue')
  },
  {
    path: '/login',
    name: 'login',
    component: () => import('../views/Login.vue')
  },
  {
    path: '/register',
    name: 'register',
    component: () => import('../views/Register.vue')
  },
  {
    path: '/dashboard',
    name: 'dashboard',
    component: () => import('../views/Dashboard.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/agents',
    name: 'agents',
    component: () => import('../views/Agents.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/voice-recognition',
    name: 'voiceRecognition',
    component: () => import('../views/VoiceRecognition.vue'),
    meta: { requiresAuth: true }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// 导航守卫
router.beforeEach(async (to, from, next) => {
  const token = localStorage.getItem('token') || sessionStorage.getItem('token');
  const isAuthenticated = !!token;
  
  // 如果路由需要认证
  if (to.matched.some(record => record.meta.requiresAuth)) {
    if (!isAuthenticated) {
      // 用户未登录，重定向到登录页
      return next('/login');
    }
    
    // 验证token有效性（通过向服务器发送请求）
    if (token) {
      try {
        // 创建一个简单的请求来验证token
        const response = await fetch('http://localhost:3001/api/auth/verify', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (!response.ok) {
          // Token无效，清除存储并重定向到登录页
          console.warn('令牌验证失败，需要重新登录');
          localStorage.removeItem('token');
          sessionStorage.removeItem('token');
          return next('/login');
        }
        
        // Token有效，继续导航
        return next();
      } catch (error) {
        console.error('验证令牌时出错:', error);
        // 出错时默认继续导航，让API调用自己处理错误
        return next();
      }
    }
  }
  
  // 如果用户已登录且要访问登录/注册页面，重定向到控制台
  if (isAuthenticated && (to.path === '/login' || to.path === '/register')) {
    return next('/dashboard');
  }
  
  // 其他情况允许导航
  next();
});

export default router