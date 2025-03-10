const jwt = require('jsonwebtoken');
require('dotenv').config();

// JWT密钥
const JWT_SECRET = process.env.JWT_SECRET;

// 验证用户是否已认证的中间件
module.exports = (req, res, next) => {
  try {
    // 获取请求头中的token
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    // 如果没有token
    if (!token) {
      return res.status(401).json({ success: false, message: '未提供认证令牌，拒绝访问' });
    }
    
    // 验证token
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
      if (err) {
        return res.status(401).json({ success: false, message: '认证令牌无效，拒绝访问' });
      }
      
      // 将用户信息添加到请求对象
      req.user = decoded;
      next();
    });
  } catch (error) {
    console.error('认证中间件错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
};