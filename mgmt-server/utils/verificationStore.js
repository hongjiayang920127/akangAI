/**
 * 验证码存储工具
 * 使用内存存储验证码和设备信息
 */

// 内存存储实现
const memoryStore = (() => {
  const store = new Map();
  const timers = new Map();
  
  return {
    async set(code, data, ttl = 300) {
      try {
        console.log(`存储验证码: ${code}, 数据:`, data);
        
        // 存储数据
        store.set(code, data);
        
        // 清除之前的定时器（如果存在）
        if (timers.has(code)) {
          clearTimeout(timers.get(code));
        }
        
        // 设置过期定时器
        if (ttl > 0) {
          const timer = setTimeout(() => {
            store.delete(code);
            timers.delete(code);
            console.log(`验证码 ${code} 已过期（自动）`);
          }, ttl * 1000);
          
          timers.set(code, timer);
        }
        
        return true;
      } catch (error) {
        console.error('存储验证码错误:', error);
        return false;
      }
    },
    
    async get(code) {
      console.log(`查询验证码: ${code}`);
      const data = store.get(code);
      console.log(`查询结果:`, data || '未找到');
      return data || null;
    },
    
    async remove(code) {
      try {
        console.log(`移除验证码: ${code}`);
        
        // 清除定时器
        if (timers.has(code)) {
          clearTimeout(timers.get(code));
          timers.delete(code);
        }
        
        // 删除数据
        return store.delete(code);
      } catch (error) {
        console.error('移除验证码错误:', error);
        return false;
      }
    }
  };
})();

// 导出存储实现
const VerificationStore = memoryStore;

module.exports = VerificationStore;