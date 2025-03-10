const socketIo = require('socket.io');
const Device = require('../models/Device');
const Agent = require('../models/Agent');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const { promisify } = require('util');
const writeFileAsync = promisify(fs.writeFile);
const unlinkAsync = promisify(fs.unlink);
const { exec } = require('child_process');
const execAsync = promisify(exec);
const axios = require('axios');
const fetch = require('node-fetch');

// 硅基流动API配置
const SILICONFLOW_API = {
  baseUrl: 'https://api.siliconflow.cn/v1',
  token: process.env.SILICONFLOW_API_TOKEN,
  ttsModel: 'FunAudioLLM/CosyVoice2-0.5B',
  asrModel: 'whisper/whisper-large-v3',
  llmModel: 'Qwen/Qwen1.5-7B-Chat'
};

// Cloudflare Workers AI配置
const CLOUDFLARE_API = {
  baseUrl: 'https://api.cloudflare.com/client/v4/accounts',
  accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
  token: process.env.CLOUDFLARE_API_TOKEN,
  asrModel: '@cf/openai/whisper-large-v3-turbo'
};

// 导入验证码匹配系统适配器
let verifyDeviceCode, storeVerificationCode;
try {
  const adapterPath = path.join(__dirname, '../../server-implementation/verification-adapter.js');
  console.log('尝试加载验证适配器:', adapterPath);
  
  // 检查文件是否存在
  if (fs.existsSync(adapterPath)) {
    console.log('验证适配器文件存在');
    const adapter = require(adapterPath);
    storeVerificationCode = adapter.storeVerificationCode;
    verifyDeviceCode = adapter.verifyDeviceCode;
    console.log('验证适配器加载成功');
  } else {
    console.error('验证适配器文件不存在，将使用默认验证');
    // 使用默认实现
    const deviceCodes = new Map();
    storeVerificationCode = (deviceId, code) => {
      console.log(`默认存储验证码: ${deviceId} -> ${code}`);
      deviceCodes.set(deviceId, code);
      return true;
    };
    verifyDeviceCode = (deviceId, code) => {
      console.log(`默认验证: ${deviceId} -> ${code}`);
      const storedCode = deviceCodes.get(deviceId);
      console.log(`存储的验证码: ${storedCode}`);
      const isValid = storedCode === code;
      console.log(`验证结果: ${isValid}`);
      return isValid;
    };
  }
} catch (error) {
  console.error('加载验证适配器失败:', error);
  throw error; // 让服务器启动失败，这样问题更明显
}

// 存储连接的设备和验证码
const connectedDevices = new Map();

// 临时文件目录
const TEMP_DIR = path.join(__dirname, '../temp');
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

// 初始化Socket.IO服务
function initializeSocketIO(server) {
  const io = socketIo(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  // 管理后台命名空间
  const adminNamespace = io.of('/admin');
  
  // 设备命名空间
  const deviceNamespace = io.of('/device');

  // 管理后台连接处理
  adminNamespace.on('connection', (socket) => {
    console.log('管理后台连接建立:', socket.id);
    
    // 发送验证码到设备
    socket.on('requestVerification', async (data) => {
      try {
        const { deviceId } = data;
        console.log('收到验证请求，设备ID:', deviceId);
        
        // 检查设备是否已连接
        const deviceSocket = connectedDevices.get(deviceId);
        if (!deviceSocket) {
          console.log('设备未连接，设备ID:', deviceId);
          socket.emit('verificationError', { 
            error: '设备未连接，请确保设备已连接到服务器' 
          });
          return;
        }
        
        // 请求设备生成验证码（Windows客户端由设备生成验证码）
        deviceNamespace.to(deviceSocket).emit('request_verification_code');
        
        socket.emit('verificationRequested', { 
          message: '验证请求已发送到设备，请等待设备显示验证码' 
        });
      } catch (error) {
        console.error('请求验证失败:', error);
        socket.emit('verificationError', { error: '请求验证失败，请重试' });
      }
    });
    
    // 验证设备
    socket.on('verifyDevice', async (data) => {
      try {
        const { deviceId, verificationCode } = data;
        console.log(`\n======================= 验证设备请求 =======================`);
        console.log(`设备ID: "${deviceId}"`);
        console.log(`输入验证码: "${verificationCode}"`);
        
        // 增强输入验证
        if (!deviceId || !verificationCode) {
          console.error('验证失败: 缺少设备ID或验证码');
          socket.emit('verificationError', { 
            error: '验证失败，缺少必要信息',
            deviceId: deviceId || null
          });
          console.log(`======================= 验证结束: 缺少信息 =======================\n`);
          return; // 确保提前返回
        }
        
        // 检查设备是否已连接
        if (!connectedDevices.has(deviceId)) {
          console.error(`验证失败: 设备 ${deviceId} 未连接`);
          socket.emit('verificationError', { 
            error: '设备未连接或已断开连接',
            deviceId: deviceId
          });
          console.log(`======================= 验证结束: 设备未连接 =======================\n`);
          return; // 确保提前返回
        }
        
        // 使用验证码匹配系统进行严格验证
        console.log(`准备调用验证适配器验证验证码...`);
        console.log(`验证信息 - 设备ID="${deviceId}", 验证码="${verificationCode}"`);
        
        // 调试: 打印当前连接设备信息
        console.log('当前连接的设备:');
        connectedDevices.forEach((socketId, devId) => {
          console.log(`  设备ID: ${devId}, Socket: ${socketId}`);
        });
        
        // 调用验证函数之前记录当前时间以测量性能
        const startTime = Date.now();
        const isValid = verifyDeviceCode(deviceId, verificationCode);
        const elapsedTime = Date.now() - startTime;
        
        console.log(`验证调用耗时: ${elapsedTime}ms`);
        console.log(`验证结果: ${isValid ? '成功' : '失败'}`);
        
        // 如果验证码不匹配，直接返回错误
        if (!isValid) {
          console.error(`验证失败: 设备ID=${deviceId}, 输入验证码="${verificationCode}"`);
          socket.emit('verificationError', { 
            error: '验证码不正确，请重新输入',
            deviceId: deviceId
          });
          console.log(`======================= 验证结束: 验证码不匹配 =======================\n`);
          return; // 确保提前返回，避免执行后续代码
        }
        
        // 以下仅在验证成功时执行
        console.log(`验证成功: 设备ID=${deviceId}, 验证码="${verificationCode}"`);
        
        // 生成连接密钥
        const connectionKey = require('crypto').randomBytes(16).toString('hex');
        console.log(`生成的连接密钥: ${connectionKey.substring(0, 8)}...`);
        
        // 查找或创建设备记录
        console.log(`查询数据库中的设备记录: ${deviceId}`);
        let device = await Device.findByDeviceId(deviceId);
        
        if (!device) {
          // 创建新设备记录
          console.log(`数据库中不存在此设备，准备创建新记录`);
          device = await Device.create({
            deviceId,
            name: `设备-${deviceId.substring(0, 6)}`,
            status: 'connected',
            userId: null, // 待关联用户
            connectionKey,
            lastConnected: new Date()
          });
          console.log(`创建新设备记录成功: ${deviceId}`);
        } else {
          // 更新现有设备
          console.log(`数据库中存在此设备，准备更新记录`);
          device.status = 'connected';
          device.connectionKey = connectionKey;
          device.lastConnected = new Date();
          await device.update();
          console.log(`更新现有设备记录成功: ${deviceId}`);
        }
        
        // 通知设备验证成功
        const deviceSocketId = connectedDevices.get(deviceId);
        if (deviceSocketId) {
          console.log(`通知设备验证成功: ${deviceId} -> socket ${deviceSocketId}`);
          deviceNamespace.to(deviceSocketId).emit('verificationSuccess', {
            connectionKey
          });
          console.log(`已发送验证成功消息到设备`);
        } else {
          console.warn(`无法通知设备验证成功：设备 ${deviceId} 未连接`);
        }
        
        // 通知管理后台验证成功
        console.log(`通知管理后台验证成功: ${deviceId}`);
        socket.emit('verificationSuccess', {
          deviceId,
          deviceName: device.name
        });
        console.log(`已发送验证成功消息到管理后台`);
        console.log(`======================= 验证结束: 成功 =======================\n`);
      } catch (error) {
        console.error('设备验证失败，发生异常:', error);
        socket.emit('verificationError', { 
          error: '设备验证失败，请重试',
          deviceId: data?.deviceId || null
        });
        console.log(`======================= 验证结束: 异常 =======================\n`);
      }
    });
    
    // 获取所有连接的设备列表
    socket.on('getConnectedDevices', () => {
      const devices = [];
      connectedDevices.forEach((socketId, deviceId) => {
        devices.push({ deviceId, socketId });
      });
      socket.emit('connectedDevices', devices);
    });
    
    // 断开连接处理
    socket.on('disconnect', () => {
      console.log('管理后台断开连接:', socket.id);
    });
  });

  // 设备连接处理
  deviceNamespace.on('connection', (socket) => {
    console.log('设备连接建立:', socket.id);
    let deviceId = null;
    
    // 设备注册
    socket.on('register', async (data) => {
      try {
        deviceId = data.deviceId;
        console.log('设备注册:', deviceId);
        
        // 存储设备连接
        connectedDevices.set(deviceId, socket.id);
        
        // 通知设备注册成功
        socket.emit('registered', { 
          message: '设备注册成功',
          deviceId 
        });
        
        // 通知管理后台设备连接
        adminNamespace.emit('deviceConnected', { deviceId });
      } catch (error) {
        console.error('设备注册失败:', error);
        socket.emit('registerError', { error: '设备注册失败' });
      }
    });
    
    // 设备生成验证码
    socket.on('verification_code_generated', async (data) => {
      try {
        const { deviceId, code } = data;
        console.log(`设备 ${deviceId} 生成验证码:`, code);
        
        // 存储验证码
        const stored = storeVerificationCode(deviceId, code);
        if (!stored) {
          throw new Error('存储验证码失败');
        }
        
        // 通知设备验证码已存储
        socket.emit('verification_code_stored', {
          message: '验证码已存储',
          deviceId
        });
      } catch (error) {
        console.error('处理验证码失败:', error);
        socket.emit('verification_error', { 
          error: '处理验证码失败',
          deviceId 
        });
      }
    });

    // 语音转文本请求
    socket.on('performASR', async (data) => {
      try {
        const { audioData, deviceId } = data;
        console.log(`收到ASR请求 - 设备ID: ${deviceId}`);
        
        // 检查音频数据
        if (!audioData) {
          throw new Error('未收到音频数据');
        }
        
        // 保存音频数据到临时文件
        const tempFilePath = path.join(TEMP_DIR, `${uuidv4()}.wav`);
        await writeFileAsync(tempFilePath, Buffer.from(audioData, 'base64'));
        console.log(`音频数据已保存到临时文件: ${tempFilePath}`);
        
        try {
          // 调用 Cloudflare Workers AI 进行语音识别
          const response = await fetch(`${CLOUDFLARE_API.baseUrl}/${CLOUDFLARE_API.accountId}/ai/run/${CLOUDFLARE_API.asrModel}`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${CLOUDFLARE_API.token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              input: {
                audio: audioData
              }
            })
          });
          
          if (!response.ok) {
            throw new Error(`Cloudflare API 请求失败: ${response.status} ${response.statusText}`);
          }
          
          const result = await response.json();
          console.log('ASR结果:', result);
          
          // 发送识别结果
          socket.emit('asrResult', {
            success: true,
            text: result.result.text,
            deviceId
          });
        } catch (error) {
          console.error('Cloudflare ASR 失败:', error);
          throw error;
        } finally {
          // 清理临时文件
          try {
            await unlinkAsync(tempFilePath);
            console.log(`临时文件已删除: ${tempFilePath}`);
          } catch (error) {
            console.error('删除临时文件失败:', error);
          }
        }
      } catch (error) {
        console.error('ASR处理失败:', error);
        socket.emit('asrResult', {
          success: false,
          error: error.message,
          deviceId: data?.deviceId
        });
      }
    });
    
    // 文本转语音请求
    socket.on('performTTS', async (data) => {
      try {
        const { text, deviceId } = data;
        console.log(`收到TTS请求 - 设备ID: ${deviceId}, 文本: ${text}`);
        
        // 调用硅基流动API进行语音合成
        const response = await axios.post(`${SILICONFLOW_API.baseUrl}/tts`, {
          text,
          model: SILICONFLOW_API.ttsModel
        }, {
          headers: {
            'Authorization': `Bearer ${SILICONFLOW_API.token}`,
            'Content-Type': 'application/json'
          },
          responseType: 'arraybuffer'
        });
        
        // 将音频数据转换为Base64
        const audioData = Buffer.from(response.data).toString('base64');
        
        // 发送合成结果
        socket.emit('ttsResult', {
          success: true,
          audioData,
          deviceId
        });
      } catch (error) {
        console.error('TTS处理失败:', error);
        socket.emit('ttsResult', {
          success: false,
          error: error.message,
          deviceId: data?.deviceId
        });
      }
    });
    
    // 对话请求
    socket.on('chat', async (data) => {
      try {
        const { text, deviceId } = data;
        console.log(`收到对话请求 - 设备ID: ${deviceId}, 文本: ${text}`);
        
        // 调用硅基流动API进行对话
        const response = await axios.post(`${SILICONFLOW_API.baseUrl}/chat`, {
          messages: [{ role: 'user', content: text }],
          model: SILICONFLOW_API.llmModel
        }, {
          headers: {
            'Authorization': `Bearer ${SILICONFLOW_API.token}`,
            'Content-Type': 'application/json'
          }
        });
        
        // 发送对话结果
        socket.emit('chatResult', {
          success: true,
          reply: response.data.choices[0].message.content,
          deviceId
        });
      } catch (error) {
        console.error('对话处理失败:', error);
        socket.emit('chatResult', {
          success: false,
          error: error.message,
          deviceId: data?.deviceId
        });
      }
    });
    
    // 断开连接处理
    socket.on('disconnect', async () => {
      console.log('设备断开连接:', socket.id);
      if (deviceId) {
        // 从连接设备列表中移除
        connectedDevices.delete(deviceId);
        
        // 更新设备状态
        try {
          const device = await Device.findByDeviceId(deviceId);
          if (device) {
            device.status = 'disconnected';
            device.lastDisconnected = new Date();
            await device.update();
          }
        } catch (error) {
          console.error('更新设备状态失败:', error);
        }
        
        // 通知管理后台设备断开连接
        adminNamespace.emit('deviceDisconnected', { deviceId });
      }
    });
  });
  
  return io;
}

module.exports = { initializeSocketIO };