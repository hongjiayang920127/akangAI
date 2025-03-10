const { pool, testConnection, executeQuery } = require('../config/db');

// 初始化数据库
async function initDatabase() {
  try {
    // 测试数据库连接
    const connected = await testConnection();
    if (!connected) {
      console.error('无法连接到数据库，请检查配置');
      process.exit(1);
    }

    // 创建用户表
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(36) PRIMARY KEY,
        username VARCHAR(50) NOT NULL,
        email VARCHAR(100) NOT NULL UNIQUE,
        password VARCHAR(100) NOT NULL,
        createdAt DATETIME NOT NULL,
        updatedAt DATETIME NOT NULL
      )
    `);
    
    // 创建智能体表
    await pool.query(`
      CREATE TABLE IF NOT EXISTS agents (
        id VARCHAR(36) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        voice VARCHAR(100) DEFAULT '龙老铁 男',
        model VARCHAR(100) DEFAULT 'Qwen 实时（推荐）',
        userId VARCHAR(36) NOT NULL,
        lastConversation VARCHAR(255) DEFAULT '无',
        createdAt DATETIME NOT NULL,
        updatedAt DATETIME NOT NULL,
        FOREIGN KEY (userId) REFERENCES users(id)
      )
    `);
    
    // 创建设备表
    await pool.query(`
      CREATE TABLE IF NOT EXISTS devices (
        id VARCHAR(36) PRIMARY KEY,
        deviceId VARCHAR(100) NOT NULL UNIQUE,
        name VARCHAR(100) NOT NULL,
        status ENUM('connected', 'disconnected', 'pending') DEFAULT 'disconnected',
        userId VARCHAR(36) NULL,
        connectionKey VARCHAR(100) NULL,
        lastConnected DATETIME NULL,
        createdAt DATETIME NOT NULL,
        updatedAt DATETIME NOT NULL,
        FOREIGN KEY (userId) REFERENCES users(id)
      )
    `);
    
    console.log('数据库表初始化完成');

    // 检查表结构
    console.log('验证users表结构...');
    const tableInfo = await executeQuery(`
      DESCRIBE users
    `);
    console.log('users表结构:', tableInfo);

    // 检查表中的数据
    console.log('检查users表中的数据...');
    const existingUsers = await executeQuery(`
      SELECT id, username, email, createdAt, updatedAt FROM users
    `);
    console.log(`users表中有 ${existingUsers.length} 条记录`);
    if (existingUsers.length > 0) {
      console.log('现有用户示例:', existingUsers[0]);
    }
    
    // 检查智能体表结构
    console.log('验证agents表结构...');
    const agentsTableInfo = await executeQuery(`
      DESCRIBE agents
    `);
    console.log('agents表结构:', agentsTableInfo);
    
    // 检查设备表结构
    console.log('验证devices表结构...');
    const devicesTableInfo = await executeQuery(`
      DESCRIBE devices
    `);
    console.log('devices表结构:', devicesTableInfo);
  } catch (error) {
    console.error('数据库初始化失败:', error);
    process.exit(1);
  }
}

// 执行初始化
initDatabase();