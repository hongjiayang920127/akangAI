const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const auth = require('../middleware/auth');

// 注册路由
router.post('/register', authController.register);

// 登录路由
router.post('/login', authController.login);

// 验证令牌路由
router.get('/verify', auth, (req, res) => {
  // 如果能到达这里，说明令牌有效（auth中间件已经验证）
  res.json({ success: true, message: '令牌有效', user: req.user });
});

module.exports = router;