const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const db = require('../models/database');
const { crawlAllSources } = require('./crawlerService');
const { verifyHotspot, classifyKeyword } = require('./aiService');
const { sendNotification } = require('./notifierService');
const config = require('../config');

let cronJob = null;
let isScanning = false;
let scanStartTime = null;     // 扫描开始时间戳，用于超时自愈
let lastScanResult = null;
const SCAN_TIMEOUT_MS = 5 * 60 * 1000; // 单次扫描最长 5 分钟，超时自动重置

// 缓存关键词分类结果
const keywordTypeCache = new Map();

// AI 决策日志路径（用于评估）
const DECISION_LOG = path.join(__dirname, '..', 'tests', 'ai_decisions.jsonl');

/** 根据 URL/来源名确定可信度层级 */
function getCredibilityTier(source, url) {
  const host = (() => {
    try { return new URL(url).hostname; } catch { return ''; }
  })();
  const combined = (source + ' ' + host).toLowerCase();
  const tiers = config.sourceCredibility;
  for (const [tier, cfg] of Object.entries(tiers)) {
    if (!cfg.domains) continue;
    if (cfg.domains.some(d => combined.includes(d))) return tier;
  }
  return 'unknown';
}

/** 综合评分：AI原始分 × 来源可信度权重 + 标题命中加分 */
function computeFinalScore(aiScore, credibilityTier, keyword, title) {
  const credCfg = config.sourceCredibility[credibilityTier] || config.sourceCredibility.unknown;
  const { titleKeywordBonus, notifyScore } = config.relevance;

  // 来源可信度加权
  let score = aiScore * credCfg.weight;

  // 关键词原词命中标题加分
  if (title && title.toLowerCase().includes(keyword.toLowerCase())) {
    score += titleKeywordBonus;
  }

  // 上限 1.0
  return Math.min(1, Math.round(score * 100) / 100);
}

/** 记录 AI 决策到日志（用于评估） */
function logDecision(entry) {
  try {
    fs.appendFileSync(DECISION_LOG, JSON.stringify(entry) + '\n');
  } catch { /* 日志写入失败不影响主流程 */ }
}

/**
 * 执行一轮完整的监控扫描
 */
async function runScan() {
  if (isScanning) {
    // 超时自愈：如果扫描运行超过 5 分钟仍未结束，强制重置
    if (scanStartTime && (Date.now() - scanStartTime) > SCAN_TIMEOUT_MS) {
      console.warn('[Scheduler] ⚠️ 扫描超时（>5分钟），强制重置 isScanning');
      isScanning = false;
      scanStartTime = null;
    } else {
      console.log('[Scheduler] ⚠️ 扫描正在进行中，跳过本次');
      return lastScanResult;
    }
  }

  isScanning = true;
  scanStartTime = Date.now();
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
      const { minSaveScore, notifyScore } = config.relevance;

      for (let i = 0; i < newItems.length; i += CONCURRENCY) {
        const batch = newItems.slice(i, i + CONCURRENCY);
        const batchResults = await Promise.allSettled(
          batch.map(item => {
            const credibility = getCredibilityTier(item.source, item.url);
            return verifyHotspot(kw.keyword, item.title, item.summary, item.source, credibility);
          })
        );
        // 逐条实时处理
        for (let j = 0; j < batch.length; j++) {
          const item = batch[j];
          const aiRaw = batchResults[j];
          const aiResult = aiRaw.status === 'fulfilled'
            ? aiRaw.value
            : { isRelevant: true, isFake: false, score: 0.5, reason: 'AI验证失败，默认通过', contentSubject: '', matchMode: 'error' };

          const credibilityTier = getCredibilityTier(item.source, item.url);
          const finalScore = computeFinalScore(aiResult.score, credibilityTier, kw.keyword, item.title);

          // 低于入库阈值 → 直接丢弃
          if (finalScore < minSaveScore) {
            logDecision({
              ts: new Date().toISOString(), keyword: kw.keyword, title: item.title.substring(0, 80),
              source: item.source, credibilityTier,
              aiScore: aiResult.score, finalScore,
              contentSubject: aiResult.contentSubject, matchMode: aiResult.matchMode,
              isRelevant: aiResult.isRelevant, isFake: aiResult.isFake,
              saved: false, action: 'low_score',
              reviewed: false,
            });
            console.log(`[Scheduler] ⏭️ 低分跳过(${finalScore}): "${item.title.substring(0, 50)}"`);
            continue;
          }

          if (aiResult.isFake) {
            db.addHotspot({
              keyword_id: kw.id,
              title: item.title,
              url: item.url,
              source: item.source,
              summary: item.summary,
              ai_score: finalScore,
              ai_reason: aiResult.reason,
              is_verified: 1,
              is_fake: 1,
              published_at: item.published_at,
            });
            totalFake++;
            logDecision({
              ts: new Date().toISOString(), keyword: kw.keyword, title: item.title.substring(0, 80),
              source: item.source, credibilityTier,
              aiScore: aiResult.score, finalScore,
              contentSubject: aiResult.contentSubject, matchMode: aiResult.matchMode,
              isRelevant: false, isFake: true,
              saved: true, action: 'fake',
              reviewed: false,
            });
            console.log(`[Scheduler] ❌ 虚假/蹭热度: "${item.title.substring(0, 50)}"`);
            continue;
          }

          if (!aiResult.isRelevant) {
            logDecision({
              ts: new Date().toISOString(), keyword: kw.keyword, title: item.title.substring(0, 80),
              source: item.source, credibilityTier,
              aiScore: aiResult.score, finalScore,
              contentSubject: aiResult.contentSubject, matchMode: aiResult.matchMode,
              isRelevant: false, isFake: false,
              saved: false, action: 'irrelevant',
              reviewed: false,
            });
            console.log(`[Scheduler] ⏭️ AI判定无关: "${item.title.substring(0, 50)}"`);
            continue;
          }

          // 通过所有过滤 → 入库
          const hotspot = db.addHotspot({
            keyword_id: kw.id,
            title: item.title,
            url: item.url,
            source: item.source,
            summary: item.summary,
            ai_score: finalScore,
            ai_reason: `${aiResult.reason} | 主题:${aiResult.contentSubject}`,
            is_verified: 1,
            is_fake: 0,
            published_at: item.published_at,
          });

          logDecision({
            ts: new Date().toISOString(), keyword: kw.keyword, title: item.title.substring(0, 80),
            source: item.source, credibilityTier,
            aiScore: aiResult.score, finalScore,
            contentSubject: aiResult.contentSubject, matchMode: aiResult.matchMode,
            isRelevant: true, isFake: false,
            saved: true, action: 'saved',
            reviewed: false,
          });

          if (finalScore >= notifyScore) {
            await sendNotification(hotspot);
            db.addNotification(hotspot.id, 'browser', null);
            if (config.email.user) {
              db.addNotification(hotspot.id, 'email', config.email.to);
            }
          }

          kwNewCount++;
          totalNew++;
          console.log(`[Scheduler] 🟢 入库(${finalScore}): "${item.title.substring(0, 50)}" [${aiResult.matchMode}]`);
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
    scanStartTime = null;
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
