const express = require('express');
const router = express.Router();
const agentController = require('../controllers/agentController');
const auth = require('../middleware/auth');

// 所有路由都需要认证
router.use(auth);

// 创建新智能体
router.post('/', agentController.createAgent);

// 获取用户的所有智能体
router.get('/', agentController.getUserAgents);

// 获取单个智能体
router.get('/:id', agentController.getAgentById);

module.exports = router;