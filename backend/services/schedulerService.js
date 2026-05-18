const cron = require('node-cron');
const db = require('../models/database');
const { crawlAllSources } = require('./crawlerService');
const { verifyHotspot } = require('./aiService');
const { sendNotification } = require('./notifierService');
const config = require('../config');

let cronJob = null;

/**
 * 执行一轮完整的监控扫描
 */
async function runScan() {
  console.log('\n========================================');
  console.log(`[Scheduler] 🚀 开始扫描热点 - ${new Date().toLocaleString()}`);
  console.log('========================================\n');

  const keywords = db.getAllKeywords().filter(k => k.enabled === 1);

  if (keywords.length === 0) {
    console.log('[Scheduler] 没有启用中的关键词，跳过扫描');
    return;
  }

  for (const kw of keywords) {
    console.log(`\n[Scheduler] 📡 扫描关键词: "${kw.keyword}"`);

    // 1. 从多源爬取
    const results = await crawlAllSources(kw.keyword, kw.category);
    console.log(`[Scheduler] 共获取 ${results.length} 条原始结果`);

    let newCount = 0;
    for (const item of results) {
      // 2. 去重（URL）
      if (db.urlAlreadyExists(item.url)) {
        continue;
      }

      // 3. AI 验证
      const aiResult = await verifyHotspot(kw.keyword, item.title, item.summary, item.source);

      // 4. 如果相关且非假新闻，入库
      if (aiResult.isRelevant && !aiResult.isFake) {
        const hotspot = db.addHotspot({
          keyword_id: kw.id,
          title: item.title,
          url: item.url,
          source: item.source,
          summary: item.summary,
          ai_score: aiResult.score,
          ai_reason: aiResult.reason,
          is_verified: 1,
          is_fake: 0,
          published_at: item.published_at,
        });

        // 5. 发送通知（高相关度的才通知）
        if (aiResult.score >= 0.6) {
          await sendNotification(hotspot);
          db.addNotification(hotspot.id, 'browser', null);
          if (config.email.user) {
            db.addNotification(hotspot.id, 'email', config.email.to);
          }
        }

        newCount++;
      } else if (aiResult.isFake) {
        // 记录假内容但不通知
        db.addHotspot({
          keyword_id: kw.id,
          title: item.title,
          url: item.url,
          source: item.source,
          summary: item.summary,
          ai_score: aiResult.score,
          ai_reason: aiResult.reason,
          is_verified: 1,
          is_fake: 1,
          published_at: item.published_at,
        });
        console.log(`[Scheduler] ❌ 识别为假/无关: "${item.title.substring(0, 50)}"`);
      }
    }

    console.log(`[Scheduler] ✅ "${kw.keyword}" 新增 ${newCount} 条真实热点`);
  }

  console.log('\n[Scheduler] ✅ 本轮扫描完成\n');
}

/**
 * 启动定时调度
 */
function startScheduler(intervalMinutes) {
  if (cronJob) {
    cronJob.stop();
  }

  const minutes = intervalMinutes || parseInt(db.getSetting('crawler_interval') || config.crawler.intervalMinutes);

  // 使用 node-cron: 每 N 分钟执行一次
  cronJob = cron.schedule(`*/${minutes} * * * *`, async () => {
    try {
      await runScan();
    } catch (err) {
      console.error('[Scheduler] Error:', err);
    }
  });

  console.log(`[Scheduler] 定时任务已启动，间隔: ${minutes} 分钟`);
}

function stopScheduler() {
  if (cronJob) {
    cronJob.stop();
    cronJob = null;
    console.log('[Scheduler] 定时任务已停止');
  }
}

function getSchedulerStatus() {
  return {
    running: !!cronJob,
    intervalMinutes: db.getSetting('crawler_interval') || config.crawler.intervalMinutes,
  };
}

module.exports = { startScheduler, stopScheduler, runScan, getSchedulerStatus };
