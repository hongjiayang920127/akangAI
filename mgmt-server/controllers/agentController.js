const Agent = require('../models/Agent');
const User = require('../models/User');

// 创建新智能体
exports.createAgent = async (req, res) => {
  try {
    const { name, voice, model } = req.body;
    const userId = req.user.id;
    
    // 验证输入
    if (!name) {
      return res.status(400).json({ success: false, message: '请提供智能体名称' });
    }
    
    // 创建智能体
    const newAgent = await Agent.create({ 
      name, 
      voice, 
      model, 
      userId 
    });
    
    if (newAgent.error) {
      return res.status(400).json({ success: false, message: newAgent.error });
    }
    
    // 返回成功响应
    res.status(201).json({
      success: true,
      message: '智能体创建成功',
      agent: newAgent
    });
  } catch (error) {
    console.error('创建智能体错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
};

// 获取用户的所有智能体
exports.getUserAgents = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // 获取用户的所有智能体
    const agents = await Agent.findByUserId(userId);
    
    // 返回成功响应
    res.json({
      success: true,
      agents
    });
  } catch (error) {
    console.error('获取智能体错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
};

// 获取单个智能体
exports.getAgentById = async (req, res) => {
  try {
    const agentId = req.params.id;
    const userId = req.user.id;
    
    // 获取智能体
    const agent = await Agent.findById(agentId);
    
    // 验证智能体是否存在
    if (!agent) {
      return res.status(404).json({ success: false, message: '未找到智能体' });
    }
    
    // 验证智能体是否属于当前用户
    if (agent.userId !== userId) {
      return res.status(403).json({ success: false, message: '没有权限访问此智能体' });
    }
    
    // 返回成功响应
    res.json({
      success: true,
      agent
    });
  } catch (error) {
    console.error('获取智能体错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
};