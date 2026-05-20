const cron = require('node-cron');
const db = require('../models/database');
const { crawlAllSources } = require('./crawlerService');
const { verifyHotspot, classifyKeyword } = require('./aiService');
const { sendNotification } = require('./notifierService');
const config = require('../config');

let cronJob = null;
let isScanning = false;
let lastScanResult = null;

// 缓存关键词分类结果
const keywordTypeCache = new Map();

/**
 * 执行一轮完整的监控扫描
 */
async function runScan() {
  if (isScanning) {
    console.log('[Scheduler] ⚠️ 扫描正在进行中，跳过本次');
    return lastScanResult;
  }

  isScanning = true;
  const startTime = Date.now();
  console.log('\n========================================');
  console.log(`[Scheduler] 🚀 开始扫描热点 - ${new Date().toLocaleString()}`);
  console.log('========================================\n');

  try {
    const keywords = db.getAllKeywords().filter(k => k.enabled === 1);

    if (keywords.length === 0) {
      console.log('[Scheduler] 没有启用中的关键词，跳过扫描');
      lastScanResult = { total: 0, new: 0, fake: 0, duration: 0 };
      return lastScanResult;
    }

    let totalNew = 0;
    let totalFake = 0;

    for (const kw of keywords) {
      console.log(`\n[Scheduler] 📡 扫描关键词: "${kw.keyword}"`);

      // 分类关键词类型（首次扫描时缓存）
      if (!keywordTypeCache.has(kw.keyword)) {
        const kType = await classifyKeyword(kw.keyword);
        keywordTypeCache.set(kw.keyword, kType);
      }
      const keywordType = keywordTypeCache.get(kw.keyword);

      // 1. 从多源爬取（按类型优化搜索）
      const results = await crawlAllSources(kw.keyword, kw.category, keywordType);
      console.log(`[Scheduler] 共获取 ${results.length} 条原始结果`);

      // 过滤已存在的 URL 和相似标题
      const newItems = results.filter(item => {
        if (db.urlAlreadyExists(item.url)) return false;
        if (db.titleAlreadyExists(item.title)) return false;
        return true;
      });
      console.log(`[Scheduler] 去重后剩余 ${newItems.length} 条新结果`);

      if (newItems.length === 0) continue;

      // 2. AI 验证 + 实时入库（完成一条入库一条，不等全部）
      const CONCURRENCY = 3;
      let kwNewCount = 0;
      for (let i = 0; i < newItems.length; i += CONCURRENCY) {
        const batch = newItems.slice(i, i + CONCURRENCY);
        const batchResults = await Promise.allSettled(
          batch.map(item => verifyHotspot(kw.keyword, item.title, item.summary, item.source))
        );
        // 逐条实时处理
        for (let j = 0; j < batch.length; j++) {
          const item = batch[j];
          const aiRaw = batchResults[j];
          const aiResult = aiRaw.status === 'fulfilled' ? aiRaw.value : { isRelevant: true, isFake: false, score: 0.5, reason: 'AI验证失败，默认通过' };

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

            if (aiResult.score >= 0.6) {
              await sendNotification(hotspot);
              db.addNotification(hotspot.id, 'browser', null);
              if (config.email.user) {
                db.addNotification(hotspot.id, 'email', config.email.to);
              }
            }

            kwNewCount++;
            totalNew++;
            console.log(`[Scheduler] 🟢 实时入库: "${item.title.substring(0, 50)}" (${aiResult.score})`);
          } else if (aiResult.isFake) {
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
            totalFake++;
            console.log(`[Scheduler] ❌ 识别为假/无关: "${item.title.substring(0, 50)}"`);
          }
        }
      }

      console.log(`[Scheduler] ✅ "${kw.keyword}" 新增 ${kwNewCount} 条真实热点`);
    }

    const duration = Math.round((Date.now() - startTime) / 1000);
    lastScanResult = { total: totalNew + totalFake, new: totalNew, fake: totalFake, duration };
    console.log(`\n[Scheduler] ✅ 本轮扫描完成（耗时 ${duration}s）: ${totalNew} 条真实, ${totalFake} 条过滤\n`);
    return lastScanResult;
  } catch (err) {
    console.error('[Scheduler] 扫描异常:', err);
    lastScanResult = { total: 0, new: 0, fake: 0, duration: 0, error: err.message };
    return lastScanResult;
  } finally {
    isScanning = false;
  }
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
    isScanning,
    intervalMinutes: db.getSetting('crawler_interval') || config.crawler.intervalMinutes,
    lastScan: lastScanResult,
  };
}

module.exports = { startScheduler, stopScheduler, runScan, getSchedulerStatus };
