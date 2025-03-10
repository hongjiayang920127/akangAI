const { v4: uuidv4 } = require('uuid');
const { executeQuery } = require('../config/db');

class Device {
  constructor(data) {
    this.id = data.id || uuidv4();
    this.deviceId = data.deviceId;
    this.name = data.name || '未命名设备';
    this.status = data.status || 'disconnected'; // connected, disconnected, pending
    this.userId = data.userId || null;
    this.agentId = data.agentId || null;
    this.connectionKey = data.connectionKey || null;
    this.lastConnected = data.lastConnected || null;
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
  }

  // 创建新设备
  static async create(deviceData) {
    try {
      const device = new Device(deviceData);
      const now = new Date();
      
      const query = `
        INSERT INTO devices (
          id, deviceId, name, status, userId, agentId, connectionKey, 
          lastConnected, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      const params = [
        device.id,
        device.deviceId,
        device.name,
        device.status,
        device.userId,
        device.agentId,
        device.connectionKey,
        device.lastConnected,
        now,
        now
      ];
      
      await executeQuery(query, params);
      return device;
    } catch (error) {
      console.error('创建设备失败:', error);
      throw error;
    }
  }

  // 通过ID查找设备
  static async findById(id) {
    try {
      const query = 'SELECT * FROM devices WHERE id = ?';
      const devices = await executeQuery(query, [id]);
      
      if (devices.length === 0) return null;
      
      return new Device(devices[0]);
    } catch (error) {
      console.error('查找设备失败:', error);
      throw error;
    }
  }

  // 通过设备ID查找设备
  static async findByDeviceId(deviceId) {
    try {
      const query = 'SELECT * FROM devices WHERE deviceId = ?';
      const devices = await executeQuery(query, [deviceId]);
      
      if (devices.length === 0) return null;
      
      return new Device(devices[0]);
    } catch (error) {
      console.error('查找设备失败:', error);
      throw error;
    }
  }

  // 获取用户的所有设备
  static async findByUserId(userId) {
    try {
      const query = 'SELECT * FROM devices WHERE userId = ?';
      const devices = await executeQuery(query, [userId]);
      
      return devices.map(device => new Device(device));
    } catch (error) {
      console.error('查找用户设备失败:', error);
      throw error;
    }
  }

  // 获取所有未关联设备
  static async findUnassociatedDevices() {
    try {
      const query = 'SELECT * FROM devices WHERE userId IS NULL';
      const devices = await executeQuery(query);
      
      return devices.map(device => new Device(device));
    } catch (error) {
      console.error('查找未关联设备失败:', error);
      throw error;
    }
  }

  // 更新设备
  async update() {
    try {
      this.updatedAt = new Date();
      
      const query = `
        UPDATE devices 
        SET deviceId = ?, name = ?, status = ?, userId = ?, 
            agentId = ?, connectionKey = ?, lastConnected = ?, updatedAt = ?
        WHERE id = ?
      `;
      
      const params = [
        this.deviceId,
        this.name,
        this.status,
        this.userId,
        this.agentId,
        this.connectionKey,
        this.lastConnected,
        this.updatedAt,
        this.id
      ];
      
      await executeQuery(query, params);
      return this;
    } catch (error) {
      console.error('更新设备失败:', error);
      throw error;
    }
  }

  // 删除设备
  static async delete(id) {
    try {
      const query = 'DELETE FROM devices WHERE id = ?';
      await executeQuery(query, [id]);
      return true;
    } catch (error) {
      console.error('删除设备失败:', error);
      throw error;
    }
  }
}

module.exports = Device;