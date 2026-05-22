const nodemailer = require('nodemailer');
const config = require('../config');

// WebSocket 连接池（由 server.js 管理）
let wsClients = new Set();
let notifyBrowserCallback = null;

function setNotifyCallback(callback) {
  notifyBrowserCallback = callback;
}

function addWsClient(ws) {
  wsClients.add(ws);
  ws.on('close', () => wsClients.delete(ws));
}

/**
 * 发送浏览器通知
 */
function notifyBrowser(data) {
  const message = JSON.stringify({
    type: 'notification',
    data,
    timestamp: new Date().toISOString(),
  });

  for (const ws of wsClients) {
    if (ws.readyState === 1) {
      ws.send(message);
    }
  }

  if (notifyBrowserCallback) {
    notifyBrowserCallback(data);
  }
}

/**
 * 发送扫描完成事件（用于前端恢复按钮状态）
 */
function notifyScanComplete(result) {
  const message = JSON.stringify({
    type: 'scan_complete',
    data: result,
    timestamp: new Date().toISOString(),
  });

  for (const ws of wsClients) {
    if (ws.readyState === 1) {
      ws.send(message);
    }
  }

  console.log(`[Notify] 已推送 scan_complete 事件: ${JSON.stringify(result)}`);
}

// 邮件发送器（懒初始化）
let mailTransporter = null;
function getMailTransporter() {
  if (!mailTransporter && config.email.user) {
    mailTransporter = nodemailer.createTransport({
      host: config.email.host,
      port: config.email.port,
      secure: config.email.port === 465,
      auth: {
        user: config.email.user,
        pass: config.email.pass,
      },
    });
  }
  return mailTransporter;
}

/**
 * 发送邮件通知
 */
async function sendEmail(subject, htmlContent) {
  const transporter = getMailTransporter();
  if (!transporter || !config.email.to) {
    console.warn('[Notify] Email not configured, skipping email notification');
    return false;
  }

  try {
    await transporter.sendMail({
      from: config.email.user,
      to: config.email.to,
      subject: `[Hot Monitor] ${subject}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #0a0a1a; color: #e0e0e0; border-radius: 12px; border: 1px solid #00ff88;">
          <h2 style="color: #00ff88;">🔍 Hot Monitor 热点提醒</h2>
          ${htmlContent}
          <hr style="border-color: #1a1a3a;">
          <p style="font-size: 12px; color: #666;">由 Hot Monitor AI 自动发送 · <a href="http://localhost:5173" style="color: #00ff88;">打开控制台</a></p>
        </div>
      `,
    });
    console.log('[Notify] Email sent to:', config.email.to);
    return true;
  } catch (err) {
    console.error('[Notify] Email error:', err.message);
    return false;
  }
}

/**
 * 综合通知：浏览器 + 邮件
 */
async function sendNotification(hotspot) {
  // 浏览器通知
  notifyBrowser({
    id: hotspot.id,
    title: hotspot.title,
    url: hotspot.url,
    source: hotspot.source,
    keyword: hotspot.keyword_text || hotspot.keyword_id,
    score: hotspot.ai_score,
    reason: hotspot.ai_reason,
  });

  // 邮件通知
  const emailEnabled = config.email.user && config.email.to;
  if (emailEnabled) {
    const html = `
      <div style="margin: 16px 0; padding: 16px; background: #111133; border-radius: 8px; border-left: 4px solid #00ff88;">
        <h3 style="margin: 0 0 8px; color: #00ff88;">${escapeHtml(hotspot.title)}</h3>
        <p style="margin: 4px 0; color: #aaa;">📌 来源: ${escapeHtml(hotspot.source)} | 相关度: ${Math.round((hotspot.ai_score || 0) * 100)}%</p>
        <p style="margin: 8px 0; color: #ccc;">${escapeHtml(hotspot.summary || '')}</p>
        <a href="${escapeHtml(hotspot.url)}" style="color: #00aaff;" target="_blank">查看详情 →</a>
      </div>
    `;
    await sendEmail(`新热点: ${hotspot.title.substring(0, 60)}`, html);
  }

  return true;
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

module.exports = {
  setNotifyCallback,
  addWsClient,
  notifyBrowser,
  sendEmail,
  sendNotification,
  notifyScanComplete,
};
