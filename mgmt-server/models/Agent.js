const { pool } = require('../config/db');
const { v4: uuidv4 } = require('uuid');

class Agent {
  /**
   * 创建新智能体
   * @param {object} agentData 智能体数据
   * @returns {object|null} 创建的智能体或null
   */
  static async create(agentData) {
    try {
      console.log(`正在创建新智能体，数据: ${JSON.stringify(agentData)}`);
      
      // 生成智能体ID
      const id = uuidv4();
      console.log(`生成的智能体ID: ${id}`);
      
      // 当前时间
      const now = new Date();
      
      // 创建新智能体
      console.log('正在执行SQL插入...');
      const [result] = await pool.query(
        `INSERT INTO agents (id, name, voice, model, userId, createdAt, updatedAt) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          agentData.name,
          agentData.voice || '龙老铁 男',
          agentData.model || 'Qwen 实时（推荐）',
          agentData.userId,
          now,
          now
        ]
      );
      
      console.log(`SQL插入结果: ${JSON.stringify(result)}`);
      
      // 返回智能体数据
      const newAgent = {
        id,
        name: agentData.name,
        voice: agentData.voice || '龙老铁 男',
        model: agentData.model || 'Qwen 实时（推荐）',
        userId: agentData.userId,
        lastConversation: '无',
        createdAt: now.toISOString(),
        updatedAt: now.toISOString()
      };
      
      console.log(`智能体创建成功: ${JSON.stringify(newAgent)}`);
      return newAgent;
    } catch (error) {
      console.error('创建智能体出错:', error);
      return { error: '创建智能体失败' };
    }
  }

  /**
   * 根据用户ID获取所有智能体
   * @param {string} userId 用户ID
   * @returns {array} 智能体数组
   */
  static async findByUserId(userId) {
    try {
      console.log(`正在查找用户的智能体，用户ID: ${userId}`);
      const [rows] = await pool.query(
        'SELECT * FROM agents WHERE userId = ? ORDER BY createdAt DESC', 
        [userId]
      );
      console.log(`查找结果: 找到 ${rows.length} 个智能体`);
      return rows;
    } catch (error) {
      console.error('查找智能体出错:', error);
      return [];
    }
  }

  /**
   * 根据ID获取智能体
   * @param {string} id 智能体ID
   * @returns {object|null} 智能体对象或null
   */
  static async findById(id) {
    try {
      console.log(`正在查找智能体，ID: ${id}`);
      const [rows] = await pool.query(
        'SELECT * FROM agents WHERE id = ?', 
        [id]
      );
      console.log(`查找结果: ${rows.length > 0 ? '找到智能体' : '未找到智能体'}`);
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      console.error('查找智能体出错:', error);
      return null;
    }
  }
}

module.exports = Agent;