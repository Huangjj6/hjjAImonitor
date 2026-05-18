const express = require('express');
const router = express.Router();
const db = require('../models/database');

// 获取所有关键词
router.get('/', (req, res) => {
  const keywords = db.getAllKeywords();
  res.json({ success: true, data: keywords });
});

// 添加关键词
router.post('/', (req, res) => {
  const { keyword, category } = req.body;
  if (!keyword || !keyword.trim()) {
    return res.status(400).json({ success: false, error: '关键词不能为空' });
  }
  try {
    const kw = db.addKeyword(keyword.trim(), category || 'general');
    res.json({ success: true, data: kw });
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(400).json({ success: false, error: '该关键词已存在' });
    }
    res.status(500).json({ success: false, error: err.message });
  }
});

// 更新关键词
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const updates = {};
  if (req.body.keyword !== undefined) updates.keyword = req.body.keyword;
  if (req.body.category !== undefined) updates.category = req.body.category;
  if (req.body.enabled !== undefined) updates.enabled = req.body.enabled ? 1 : 0;

  try {
    const kw = db.updateKeyword(id, updates);
    if (!kw) return res.status(404).json({ success: false, error: '关键词不存在' });
    res.json({ success: true, data: kw });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 删除关键词
router.delete('/:id', (req, res) => {
  db.deleteKeyword(req.params.id);
  res.json({ success: true });
});

module.exports = router;
