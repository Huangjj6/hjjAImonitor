require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const express = require('express');
const cors = require('cors');
const http = require('http');
const { WebSocketServer } = require('ws');
const config = require('./config');
const errorHandler = require('./middleware/errorHandler');
const { addWsClient } = require('./services/notifierService');
const { startScheduler } = require('./services/schedulerService');
const { getDb } = require('./models/database');

// 路由
const keywordsRouter = require('./routes/keywords');
const hotspotsRouter = require('./routes/hotspots');
const settingsRouter = require('./routes/settings');

const app = express();
const server = http.createServer(app);

// WebSocket
const wss = new WebSocketServer({ server, path: '/ws' });
wss.on('connection', (ws) => {
  console.log('[WS] Client connected');
  addWsClient(ws);
  ws.send(JSON.stringify({ type: 'connected', message: '已连接到 Hot Monitor' }));
});

// 中间件
app.use(cors());
app.use(express.json());

// API 路由
app.use('/api/keywords', keywordsRouter);
app.use('/api/hotspots', hotspotsRouter);
app.use('/api/settings', settingsRouter);

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'running',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      openrouterConfigured: !!config.openrouter.apiKey,
      twitterConfigured: !!config.twitter.apiKey,
      emailConfigured: !!(config.email.user && config.email.to),
    },
  });
});

// OpenRouter 配置状态（隐藏 key 值）
app.get('/api/config-status', (req, res) => {
  res.json({
    success: true,
    data: {
      openrouter: !!config.openrouter.apiKey,
      twitter: !!config.twitter.apiKey,
      email: !!(config.email.user && config.email.to),
    },
  });
});

// 错误处理
app.use(errorHandler);

// 启动（先初始化数据库）
async function start() {
  await getDb();
  console.log('[DB] Database initialized');

  server.listen(config.port, () => {
    console.log(`
╔══════════════════════════════════════════════╗
║        🔍  Hot Monitor  Backend              ║
║        Server running on port ${config.port}          ║
║        http://localhost:${config.port}               ║
╠══════════════════════════════════════════════╣
║  OpenRouter: ${config.openrouter.apiKey ? '✅ configured' : '⚠️  not configured'}     ║
║  Twitter API: ${config.twitter.apiKey ? '✅ configured' : '⚠️  not configured'}     ║
║  Email:       ${config.email.user ? '✅ configured' : '⚠️  not configured'}     ║
╚══════════════════════════════════════════════╝
    `);

    // 启动定时调度
    startScheduler();
  });
}

start().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
