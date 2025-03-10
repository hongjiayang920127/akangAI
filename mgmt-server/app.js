const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const http = require('http');
const session = require('express-session');
require('dotenv').config();

// 导入路由
const authRoutes = require('./routes/auth');
const agentRoutes = require('./routes/agents');
const deviceRoutes = require('./routes/devices');

// 导入数据库配置
const { testConnection } = require('./config/db');

// 导入Socket.IO模块
const { initializeSocketIO } = require('./socket');

// 创建Express应用
const app = express();
const PORT = process.env.PORT || 3001;

// 创建HTTP服务器
const server = http.createServer(app);

// 中间件
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// 使用会话中间件
app.use(session({
  secret: process.env.SESSION_SECRET || 'xiaozhi-ai-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: process.env.NODE_ENV === 'production', maxAge: 24 * 60 * 60 * 1000 }
}));

// 静态文件托管
app.use(express.static(path.join(__dirname, 'public')));

// 测试路由
app.get('/', (req, res) => {
  res.json({ message: '小智 AI 服务器正在运行' });
});

// 路由
app.use('/api/auth', authRoutes);
app.use('/api/agents', agentRoutes);
app.use('/api/devices', deviceRoutes);

// 添加一个客户端模拟器路由
app.get('/windows-client', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'windows-client-simulator.html'));
});

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error('服务器错误:', err.stack);
  res.status(500).json({ 
    success: false, 
    message: '服务器内部错误',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 初始化数据库并启动服务器
async function startServer() {
  try {
    // 测试数据库连接
    const dbConnected = await testConnection();
    if (!dbConnected) {
      console.error('无法连接到数据库，请检查配置后重试');
      process.exit(1);
    }
    
    // 初始化数据库表
    require('./models/init');
    
    // 初始化Socket.IO
    const io = initializeSocketIO(server);
    
    // 启动HTTP服务器
    server.listen(PORT, () => {
      console.log(`服务器运行在 http://localhost:${PORT}`);
      console.log('WebSocket服务已启动');
    });
  } catch (error) {
    console.error('服务器启动失败:', error);
    process.exit(1);
  }
}

// 启动服务器
startServer();