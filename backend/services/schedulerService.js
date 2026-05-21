const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const db = require('../models/database');
const { crawlAllSources } = require('./crawlerService');
const { verifyHotspot, classifyKeyword, expandQuery } = require('./aiService');
const { sendNotification } = require('./notifierService');
const config = require('../config');

let cronJob = null;
let isScanning = false;
let scanStartTime = null;     // 扫描开始时间戳，用于超时自愈
let lastScanResult = null;
const SCAN_TIMEOUT_MS = 5 * 60 * 1000; // 单次扫描最长 5 分钟，超时自动重置

// 缓存关键词分类结果
const keywordTypeCache = new Map();
// 缓存 Query Expansion 结果（TTL: 1 小时）
const queryExpansionCache = new Map();
const EXPANSION_TTL = 60 * 60 * 1000;

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

/** 综合评分：AI原始分 × 来源可信度权重 + 标题命中加分 × 时间新颖度因子 */
function computeFinalScore(aiScore, credibilityTier, keyword, title, publishedAt) {
  const credCfg = config.sourceCredibility[credibilityTier] || config.sourceCredibility.unknown;
  const { titleKeywordBonus } = config.relevance;

  // 来源可信度加权
  let score = aiScore * credCfg.weight;

  // 关键词原词命中标题加分
  if (title && title.toLowerCase().includes(keyword.toLowerCase())) {
    score += titleKeywordBonus;
  }

  // 时间新颖度因子：有真实时间的文章按新旧程度加权
  if (publishedAt) {
    try {
      const daysSince = (Date.now() - new Date(publishedAt).getTime()) / 86400000;
      const freshness = Math.max(0.7, 1 - daysSince / 14); // 14天半衰，最低 0.7
      score *= freshness;
    } catch { /* 时间解析失败不扣分 */ }
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

/** 标题相似度去重：保留每组中来源可信度最高的那条，其余继承 AI 结果 */
function deduplicateByTitle(items) {
  if (items.length <= 1) return items;

  const groups = []; // [{ keeper: item, duplicates: [item, ...] }]

  for (const item of items) {
    let matched = false;
    for (const grp of groups) {
      if (titleSimilarity(item.title, grp.keeper.title) > 0.8) {
        grp.duplicates.push(item);
        matched = true;
        break;
      }
    }
    if (!matched) {
      groups.push({ keeper: item, duplicates: [] });
    }
  }

  // 从每组选 keeper（来源可信度最高的），其余跳过 AI 调用
  for (const grp of groups) {
    if (grp.duplicates.length > 0) {
      const all = [grp.keeper, ...grp.duplicates];
      const bestIdx = all.reduce((best, curr, i, arr) => {
        const bt = getCredibilityTier(curr.source, curr.url);
        const ct = getCredibilityTier(arr[best].source, arr[best].url);
        return (config.sourceCredibility[bt]?.tier || 5) < (config.sourceCredibility[ct]?.tier || 5) ? i : best;
      }, 0);
      // 将 keeper 换为来源最佳的那条
      if (bestIdx !== 0) {
        [grp.keeper, all[bestIdx]] = [all[bestIdx], grp.keeper];
      }
    }
  }

  const deduped = groups.map(g => g.keeper);
  if (deduped.length < items.length) {
    console.log(`[Scheduler] 标题去重: ${items.length} → ${deduped.length} 条 (减少 ${items.length - deduped.length} 次 AI 调用)`);
  }
  return deduped;
}

/** 简单标题相似度：基于 3-gram Jaccard */
function titleSimilarity(a, b) {
  if (!a || !b) return 0;
  const norm = s => s.toLowerCase().replace(/[^a-zA-Z0-9\u4e00-\u9fff]/g, '');
  const sa = norm(a), sb = norm(b);
  if (!sa || !sb) return 0;

  const trigrams = s => {
    const set = new Set();
    for (let i = 0; i <= s.length - 3; i++) set.add(s.slice(i, i + 3));
    return set;
  };
  const ta = trigrams(sa), tb = trigrams(sb);
  const intersection = [...ta].filter(x => tb.has(x)).length;
  const union = ta.size + tb.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * 执行一轮完整的监控扫描
 */
async function runScan() {
  if (isScanning) {
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

    // P1: 关键词并行扫描（并发上限 3 个词）
    const KW_CONCURRENCY = 3;
    const allResults = [];
    for (let i = 0; i < keywords.length; i += KW_CONCURRENCY) {
      const batch = keywords.slice(i, i + KW_CONCURRENCY);
      const batchResults = await Promise.allSettled(
        batch.map(kw => scanKeyword(kw))
      );
      for (const r of batchResults) {
        if (r.status === 'fulfilled') allResults.push(r.value);
      }
    }

    let totalNew = 0;
    let totalFake = 0;
    for (const r of allResults) {
      totalNew += r.new;
      totalFake += r.fake;
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

/** 单个关键词扫描（供并行调用） */
async function scanKeyword(kw) {
  let kwNew = 0;
  let kwFake = 0;

  console.log(`\n[Scheduler] 📡 扫描关键词: "${kw.keyword}"`);

  // 分类关键词类型
  if (!keywordTypeCache.has(kw.keyword)) {
    const kType = await classifyKeyword(kw.keyword);
    keywordTypeCache.set(kw.keyword, kType);
  }
  const keywordType = keywordTypeCache.get(kw.keyword);

  // Query Expansion
  let expansions = null;
  const cached = queryExpansionCache.get(kw.keyword);
  if (cached && (Date.now() - cached.ts) < EXPANSION_TTL) {
    expansions = cached.data;
  } else if (config.queryExpansion.enabled) {
    expansions = await expandQuery(kw.keyword, keywordType);
    queryExpansionCache.set(kw.keyword, { ts: Date.now(), data: expansions });
  }

  const results = await crawlAllSources(kw.keyword, kw.category, keywordType, expansions);
  console.log(`[Scheduler] "${kw.keyword}" 共获取 ${results.length} 条原始结果`);

  const newItems = results.filter(item => {
    if (db.urlAlreadyExists(item.url)) return false;
    if (db.titleAlreadyExists(item.title)) return false;
    return true;
  });
  console.log(`[Scheduler] "${kw.keyword}" 去重后剩余 ${newItems.length} 条新结果`);

  if (newItems.length === 0) return { new: 0, fake: 0 };

  const toVerify = config.queryExpansion.enabled
    ? deduplicateByTitle(newItems)
    : newItems;

  // P2: AI 并发从 3 提升到 5
  const AI_CONCURRENCY = 5;
  const { minSaveScore, notifyScore } = config.relevance;

  for (let i = 0; i < toVerify.length; i += AI_CONCURRENCY) {
    const batch = toVerify.slice(i, i + AI_CONCURRENCY);
    const batchResults = await Promise.allSettled(
      batch.map(item => {
        const credibility = getCredibilityTier(item.source, item.url);
        return verifyHotspot(kw.keyword, item.title, item.summary, item.source, credibility);
      })
    );
    for (let j = 0; j < batch.length; j++) {
      const item = batch[j];
      const aiRaw = batchResults[j];
      const aiResult = aiRaw.status === 'fulfilled'
        ? aiRaw.value
        : { isRelevant: true, isFake: false, score: 0.5, reason: 'AI验证失败，默认通过', contentSubject: '', matchMode: 'error', confidence: 0, sentiment: 'neutral', entities: [] };

      const credibilityTier = getCredibilityTier(item.source, item.url);
      const finalScore = computeFinalScore(aiResult.score, credibilityTier, kw.keyword, item.title, item.published_at);

      if (finalScore < minSaveScore) {
        logDecision({
          ts: new Date().toISOString(), keyword: kw.keyword, title: item.title.substring(0, 80),
          source: item.source, credibilityTier,
          aiScore: aiResult.score, finalScore,
          contentSubject: aiResult.contentSubject, matchMode: aiResult.matchMode,
          isRelevant: aiResult.isRelevant, isFake: aiResult.isFake,
          confidence: aiResult.confidence, sentiment: aiResult.sentiment, entities: aiResult.entities,
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
        kwFake++;
        logDecision({
          ts: new Date().toISOString(), keyword: kw.keyword, title: item.title.substring(0, 80),
          source: item.source, credibilityTier,
          aiScore: aiResult.score, finalScore,
          contentSubject: aiResult.contentSubject, matchMode: aiResult.matchMode,
          isRelevant: false, isFake: true,
          confidence: aiResult.confidence, sentiment: aiResult.sentiment, entities: aiResult.entities,
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
          confidence: aiResult.confidence, sentiment: aiResult.sentiment, entities: aiResult.entities,
          saved: false, action: 'irrelevant',
          reviewed: false,
        });
        console.log(`[Scheduler] ⏭️ AI判定无关: "${item.title.substring(0, 50)}"`);
        continue;
      }

      const hotspot = db.addHotspot({
        keyword_id: kw.id,
        title: item.title,
        url: item.url,
        source: item.source,
        summary: item.summary,
        ai_score: finalScore,
        ai_reason: `${aiResult.reason} | 主题:${aiResult.contentSubject} | 情感:${aiResult.sentiment} | 确信:${aiResult.confidence}`,
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
        confidence: aiResult.confidence, sentiment: aiResult.sentiment, entities: aiResult.entities,
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

      kwNew++;
      console.log(`[Scheduler] 🟢 入库(${finalScore}): "${item.title.substring(0, 50)}" [${aiResult.matchMode}]`);
    }
  }

  console.log(`[Scheduler] ✅ "${kw.keyword}" 新增 ${kwNew} 条真实热点`);
  return { new: kwNew, fake: kwFake };
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
