const express = require('express');
const router = express.Router();
const db = require('../models/database');

// 获取热点列表
router.get('/', (req, res) => {
  const { limit, offset, verified, keyword_id } = req.query;
  let hotspots;

  if (keyword_id) {
    hotspots = db.getHotspotsByKeyword(keyword_id, parseInt(limit) || 20);
  } else {
    hotspots = db.getHotspots(
      parseInt(limit) || 50,
      parseInt(offset) || 0,
      verified === 'true'
    );
  }

  res.json({ success: true, data: hotspots, total: hotspots.length });
});

// 获取单条热点
router.get('/:id', (req, res) => {
  const hotspot = db.getHotspotById(req.params.id);
  if (!hotspot) return res.status(404).json({ success: false, error: '不存在' });
  res.json({ success: true, data: hotspot });
});

// 手动标记假内容
router.post('/:id/mark-fake', (req, res) => {
  const { reason } = req.body;
  db.markHotspotFake(req.params.id, reason || '用户标记');
  res.json({ success: true });
});

// 获取通知历史
router.get('/notifications/history', (req, res) => {
  const notifications = db.getRecentNotifications(parseInt(req.query.limit) || 30);
  res.json({ success: true, data: notifications });
});

// 生成演示数据
router.post('/generate-demo', (req, res) => {
  const keywords = db.getAllKeywords().filter(k => k.enabled);
  if (keywords.length === 0) {
    return res.json({ success: false, error: '请先添加关键词' });
  }

  const demos = [
    { title: 'GPT-5 正式发布：多模态推理能力大幅提升', source: 'TechCrunch', summary: 'OpenAI 今日正式发布 GPT-5 模型，在代码生成、数学推理和多模态理解方面取得重大突破。', score: 0.95 },
    { title: 'Google DeepMind 推出 Gemini 3.0 Ultra', source: 'The Verge', summary: 'Google 发布了 Gemini 3.0 Ultra，在多项基准测试中超越了 GPT-5。', score: 0.92 },
    { title: 'AI 编程工具 Copilot X 用户突破 1 亿', source: 'GitHub Blog', summary: 'GitHub Copilot X 宣布全球用户突破 1 亿，成为最受欢迎的 AI 编程助手。', score: 0.88 },
    { title: '开源模型 Llama 4 在编程任务上媲美闭源模型', source: 'Hacker News', summary: 'Meta 开源的 Llama 4 模型在 HumanEval 基准测试中取得了与 GPT-5 相当的成绩。', score: 0.85 },
    { title: 'AI 安全法案在欧盟通过，大模型需强制评估', source: 'Reuters', summary: '欧盟议会通过了全球首个 AI 安全法案，要求所有大语言模型进行强制安全评估。', score: 0.78 },
    { title: '警惕：假冒 GPT-5 API 的钓鱼网站正在蔓延', source: '安全内参', summary: '安全研究人员发现大量假冒 GPT-5 API 的钓鱼网站，提醒开发者注意甄别。', score: 0.3 },
    { title: '某网红声称用 AI 预测彩票中奖号码', source: '社交媒体', summary: '近日有网红声称使用 AI 预测彩票号码，经核实为虚假宣传。', score: 0.1 },
  ];

  let added = 0;
  for (const demo of demos) {
    if (db.urlAlreadyExists(demo.title)) continue;

    const kw = keywords[added % keywords.length];
    const isFake = demo.score < 0.5;

    db.addHotspot({
      keyword_id: kw.id,
      title: demo.title,
      url: `https://example.com/demo/${Date.now()}-${added}`,
      source: demo.source,
      summary: demo.summary,
      ai_score: demo.score,
      ai_reason: isFake ? 'AI识别为虚假/蹭热度内容，与监控关键词相关性低' : 'AI确认与监控关键词高度相关，来源可信',
      is_verified: 1,
      is_fake: isFake ? 1 : 0,
      published_at: new Date(Date.now() - (demos.length - added) * 3600000).toISOString(),
    });
    added++;
  }

  res.json({ success: true, message: `已生成 ${added} 条演示数据` });
});

// 清空所有热点和通知
router.delete('/', (req, res) => {
  const count = db.clearAllHotspots();
  res.json({ success: true, message: `已清空 ${count} 条热点` });
});

module.exports = router;
