const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');
const { v4: uuidv4 } = require('uuid');

class User {
  /**
   * 根据邮箱查找用户
   * @param {string} email 邮箱
   * @returns {object|null} 用户对象或null
   */
  static async findByEmail(email) {
    try {
      console.log(`正在查找用户，邮箱: ${email}`);
      const [rows] = await pool.query(
        'SELECT * FROM users WHERE email = ?', 
        [email]
      );
      console.log(`查找结果: ${rows.length > 0 ? '找到用户' : '未找到用户'}`);
      if (rows.length > 0) {
        console.log(`找到用户数据: ${JSON.stringify(rows[0])}`);
      }
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      console.error('查找用户出错:', error);
      return null;
    }
  }

  /**
   * 创建新用户
   * @param {object} userData 用户数据
   * @returns {object|null} 创建的用户或null
   */
  static async create(userData) {
    try {
      console.log(`正在创建新用户，数据: ${JSON.stringify(userData)}`);
      
      // 检查邮箱是否已存在
      const existingUser = await this.findByEmail(userData.email);
      if (existingUser) {
        console.log('邮箱已被注册，注册失败');
        return { error: '邮箱已被注册' };
      }
      
      // 生成用户ID
      const id = uuidv4();
      console.log(`生成的用户ID: ${id}`);
      
      // 加密密码
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(userData.password, salt);
      
      // 当前时间
      const now = new Date();
      
      // 创建新用户
      console.log('正在执行SQL插入...');
      const [result] = await pool.query(
        `INSERT INTO users (id, username, email, password, createdAt, updatedAt) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          id,
          userData.username,
          userData.email,
          hashedPassword,
          now,
          now
        ]
      );
      
      console.log(`SQL插入结果: ${JSON.stringify(result)}`);
      
      // 返回用户数据（不包含密码）
      const newUser = {
        id,
        username: userData.username,
        email: userData.email,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString()
      };
      
      console.log(`用户创建成功: ${JSON.stringify(newUser)}`);
      return newUser;
    } catch (error) {
      console.error('创建用户出错:', error);
      return { error: '创建用户失败' };
    }
  }

  /**
   * 验证用户密码
   * @param {string} password 明文密码
   * @param {string} hashedPassword 加密后的密码
   * @returns {Promise<boolean>} 是否匹配
   */
  static async verifyPassword(password, hashedPassword) {
    return await bcrypt.compare(password, hashedPassword);
  }
}

module.exports = User;