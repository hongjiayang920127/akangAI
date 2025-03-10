const jwt = require('jsonwebtoken');
const User = require('../models/User');
require('dotenv').config();

// JWT密钥
const JWT_SECRET = process.env.JWT_SECRET;

// 注册控制器
exports.register = async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    // 验证输入
    if (!username || !email || !password) {
      return res.status(400).json({ success: false, message: '请提供所有必需的字段' });
    }
    
    // 创建用户
    const newUser = await User.create({ username, email, password });
    
    if (newUser.error) {
      return res.status(400).json({ success: false, message: newUser.error });
    }
    
    // 返回成功响应
    res.status(201).json({
      success: true,
      message: '注册成功',
      user: newUser
    });
  } catch (error) {
    console.error('注册错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
};

// 登录控制器
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // 验证输入
    if (!email || !password) {
      return res.status(400).json({ success: false, message: '请提供邮箱和密码' });
    }
    
    // 查找用户
    const user = await User.findByEmail(email);
    if (!user) {
      return res.status(401).json({ success: false, message: '邮箱或密码不正确' });
    }
    
    // 验证密码
    const isMatch = await User.verifyPassword(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: '邮箱或密码不正确' });
    }
    
    // 生成JWT
    const token = jwt.sign(
      { id: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: '1d' }
    );
    
    // 返回成功响应和令牌
    const { password: _, ...userWithoutPassword } = user;
    res.json({
      success: true,
      message: '登录成功',
      token,
      user: userWithoutPassword
    });
  } catch (error) {
    console.error('登录错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
};