const express = require('express');
const router = express.Router();
const db = require('../models/database');
const { startScheduler, stopScheduler, runScan, getSchedulerStatus } = require('../services/schedulerService');

// 获取所有设置
router.get('/', (req, res) => {
  // 过滤敏感信息后返回
  const settings = db.getAllSettings();
  res.json({ success: true, data: settings });
});

// 更新设置
router.put('/', (req, res) => {
  const updates = req.body;
  for (const [key, value] of Object.entries(updates)) {
    db.setSetting(key, String(value));
  }

  // 如果更新了爬取间隔，重启调度器
  if (updates.crawler_interval) {
    startScheduler(parseInt(updates.crawler_interval));
  }

  res.json({ success: true, data: db.getAllSettings() });
});

// 获取调度器状态
router.get('/scheduler-status', (req, res) => {
  res.json({ success: true, data: getSchedulerStatus() });
});

// 手动触发扫描
router.post('/trigger-scan', async (req, res) => {
  const status = getSchedulerStatus();
  if (status.isScanning) {
    return res.json({ success: false, message: '扫描正在进行中，请稍后再试' });
  }
  // 先异步启动扫描，确保 isScanning 在响应前已置位
  const scanPromise = runScan();
  res.json({ success: true, message: '扫描已启动' });
  // 等待扫描完成，记录结果
  scanPromise.then(result => {
    console.log(`[Manual Scan] 完成: ${JSON.stringify(result)}`);
  }).catch(err => console.error('[Manual Scan] Error:', err));
});

module.exports = router;
