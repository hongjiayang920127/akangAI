const Device = require('../models/Device');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const Agent = require('../models/Agent');
const VerificationStore = require('../utils/verificationStore');
const path = require('path');
const fs = require('fs');

// 加载验证适配器
let verifyDeviceCode, storeVerificationCode;
try {
  const adapterPath = path.join(__dirname, '../../server-implementation/verification-adapter.js');
  if (fs.existsSync(adapterPath)) {
    const adapter = require(adapterPath);
    verifyDeviceCode = adapter.verifyDeviceCode;
    storeVerificationCode = adapter.storeVerificationCode;
    console.log('设备控制器: 验证适配器加载成功');
  } else {
    console.warn('设备控制器: 验证适配器文件不存在，将回退到验证存储');
    verifyDeviceCode = (deviceId, code) => {
      return false; // 默认不通过
    };
  }
} catch (error) {
  console.error('设备控制器: 加载验证适配器失败:', error);
  verifyDeviceCode = (deviceId, code) => {
    return false; // 出错时不通过
  };
}

// 生成随机验证码
const generateVerificationCode = () => {
  // 生成6位数字验证码
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// 生成连接密钥
const generateConnectionKey = () => {
  return crypto.randomBytes(16).toString('hex');
};

// 获取用户所有设备
exports.getUserDevices = async (req, res) => {
  try {
    const userId = req.user.id;
    const devices = await Device.findByUserId(userId);
    
    res.status(200).json({
      success: true,
      data: devices
    });
  } catch (error) {
    console.error('获取用户设备失败:', error);
    res.status(500).json({
      success: false,
      message: '获取设备列表失败',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// 获取设备详情
exports.getDeviceById = async (req, res) => {
  try {
    const { id } = req.params;
    const device = await Device.findById(id);
    
    if (!device) {
      return res.status(404).json({
        success: false,
        message: '设备不存在'
      });
    }
    
    // 验证设备是否属于当前用户
    if (device.userId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: '无权访问此设备'
      });
    }
    
    res.status(200).json({
      success: true,
      data: device
    });
  } catch (error) {
    console.error('获取设备详情失败:', error);
    res.status(500).json({
      success: false,
      message: '获取设备详情失败',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// 更新设备
exports.updateDevice = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    
    let device = await Device.findById(id);
    
    if (!device) {
      return res.status(404).json({
        success: false,
        message: '设备不存在'
      });
    }
    
    // 验证设备是否属于当前用户
    if (device.userId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: '无权修改此设备'
      });
    }
    
    // 更新设备信息
    if (name) device.name = name;
    
    await device.update();
    
    res.status(200).json({
      success: true,
      message: '设备更新成功',
      data: device
    });
  } catch (error) {
    console.error('更新设备失败:', error);
    res.status(500).json({
      success: false,
      message: '更新设备失败',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// 删除设备
exports.deleteDevice = async (req, res) => {
  try {
    const { id } = req.params;
    const device = await Device.findById(id);
    
    if (!device) {
      return res.status(404).json({
        success: false,
        message: '设备不存在'
      });
    }
    
    // 验证设备是否属于当前用户
    if (device.userId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: '无权删除此设备'
      });
    }
    
    await Device.delete(id);
    
    res.status(200).json({
      success: true,
      message: '设备删除成功'
    });
  } catch (error) {
    console.error('删除设备失败:', error);
    res.status(500).json({
      success: false,
      message: '删除设备失败',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// 初始化设备添加流程（生成验证码）
exports.initiateDeviceAddition = async (req, res) => {
  try {
    // 生成验证码并存储在会话中
    const verificationCode = generateVerificationCode();
    
    // 将验证码与用户关联，存储在会话中
    req.session = req.session || {};
    req.session.deviceVerification = {
      code: verificationCode,
      userId: req.user.id,
      expiresAt: Date.now() + 5 * 60 * 1000 // 5分钟过期
    };
    
    res.status(200).json({
      success: true,
      message: '验证码生成成功',
      data: {
        verificationInitiated: true
      }
    });
  } catch (error) {
    console.error('初始化设备添加失败:', error);
    res.status(500).json({
      success: false,
      message: '初始化设备添加失败',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// 验证并关联设备
exports.verifyAndAssociateDevice = async (req, res) => {
  try {
    const { verificationCode, deviceId } = req.body;
    
    // 验证会话中的验证码
    if (!req.session || !req.session.deviceVerification) {
      return res.status(400).json({
        success: false,
        message: '验证会话已过期，请重新开始添加流程'
      });
    }
    
    const { code, userId, expiresAt } = req.session.deviceVerification;
    
    // 验证码过期检查
    if (Date.now() > expiresAt) {
      delete req.session.deviceVerification;
      return res.status(400).json({
        success: false,
        message: '验证码已过期，请重新开始添加流程'
      });
    }
    
    // 验证码匹配检查
    if (code !== verificationCode) {
      return res.status(400).json({
        success: false,
        message: '验证码不正确'
      });
    }
    
    // 检查设备是否已存在
    let device = await Device.findByDeviceId(deviceId);
    
    if (!device) {
      return res.status(404).json({
        success: false,
        message: '设备不存在或未连接，请确保设备已连接并重试'
      });
    }
    
    // 生成连接密钥
    const connectionKey = generateConnectionKey();
    
    // 更新设备信息
    device.userId = userId;
    device.connectionKey = connectionKey;
    device.status = 'connected';
    device.lastConnected = new Date();
    
    await device.update();
    
    // 清除验证会话
    delete req.session.deviceVerification;
    
    res.status(200).json({
      success: true,
      message: '设备关联成功',
      data: {
        device,
        connectionKey
      }
    });
  } catch (error) {
    console.error('设备关联失败:', error);
    res.status(500).json({
      success: false,
      message: '设备关联失败',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// 验证设备
exports.verifyDevice = async (req, res) => {
  try {
    const { deviceId, code } = req.body;
    
    // 验证输入
    if (!deviceId || !code) {
      return res.status(400).json({
        success: false,
        message: '缺少必要参数'
      });
    }
    
    // 使用验证适配器验证
    const isValid = await verifyDeviceCode(deviceId, code);
    
    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: '验证码无效'
      });
    }
    
    res.status(200).json({
      success: true,
      message: '验证成功'
    });
  } catch (error) {
    console.error('设备验证失败:', error);
    res.status(500).json({
      success: false,
      message: '设备验证失败',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// 注册验证码
exports.registerVerificationCode = async (req, res) => {
  try {
    const { deviceId, code } = req.body;
    
    // 验证输入
    if (!deviceId || !code) {
      return res.status(400).json({
        success: false,
        message: '缺少必要参数'
      });
    }
    
    // 存储验证码
    const stored = await storeVerificationCode(deviceId, code);
    
    if (!stored) {
      return res.status(500).json({
        success: false,
        message: '存储验证码失败'
      });
    }
    
    res.status(200).json({
      success: true,
      message: '验证码注册成功'
    });
  } catch (error) {
    console.error('注册验证码失败:', error);
    res.status(500).json({
      success: false,
      message: '注册验证码失败',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// 使验证码过期
exports.expireVerificationCode = async (req, res) => {
  try {
    const { code } = req.params;
    
    // 从验证存储中移除验证码
    await VerificationStore.remove(code);
    
    res.status(200).json({
      success: true,
      message: '验证码已过期'
    });
  } catch (error) {
    console.error('使验证码过期失败:', error);
    res.status(500).json({
      success: false,
      message: '使验证码过期失败',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// 手动注册验证码（仅用于测试）
exports.manualRegisterCode = async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({
      success: false,
      message: '此功能仅在开发环境可用'
    });
  }
  
  try {
    const { deviceId, code } = req.body;
    
    // 验证输入
    if (!deviceId || !code) {
      return res.status(400).json({
        success: false,
        message: '缺少必要参数'
      });
    }
    
    // 存储验证码
    await VerificationStore.store(deviceId, code);
    
    res.status(200).json({
      success: true,
      message: '验证码手动注册成功',
      data: { deviceId, code }
    });
  } catch (error) {
    console.error('手动注册验证码失败:', error);
    res.status(500).json({
      success: false,
      message: '手动注册验证码失败',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};