const express = require('express');
const router = express.Router();
const deviceController = require('../controllers/deviceController');
const authMiddleware = require('../middleware/auth');

// 所有路由都需要认证
router.use(authMiddleware);

// 获取用户的所有设备
router.get('/', deviceController.getUserDevices);

// 获取单个设备详情
router.get('/:id', deviceController.getDeviceById);

// 更新设备信息
router.put('/:id', deviceController.updateDevice);

// 删除设备
router.delete('/:id', deviceController.deleteDevice);

// 初始化设备添加流程（生成验证码）
router.post('/initiate-addition', deviceController.initiateDeviceAddition);

// 验证并关联设备
router.post('/verify-and-associate', deviceController.verifyAndAssociateDevice);

// 设备验证相关路由
router.post('/verify', deviceController.verifyDevice);
router.post('/register-code', deviceController.registerVerificationCode);
router.delete('/expire-code/:code', deviceController.expireVerificationCode);

// 测试路由 - 用于手动注册验证码（仅在开发环境使用）
if (process.env.NODE_ENV !== 'production') {
  router.post('/test/register-code', deviceController.manualRegisterCode);
}

module.exports = router;