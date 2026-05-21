/**
 * AI 相关性审核评估工具
 *
 * 用法:
 *   node tests/evaluate.js stats     查看决策统计
 *   node tests/evaluate.js review    交互式审核最近决策（标 ✅/❌）
 *   node tests/evaluate.js test      用 golden set 回归测试
 *   node tests/evaluate.js export    导出 golden set（从已审核记录）
 *   node tests/evaluate.js compare <file>  对比另一个日志文件
 */

const fs = require('fs');
const path = require('path');

const DECISION_LOG = path.join(__dirname, 'ai_decisions.jsonl');
const GOLDEN_SET = path.join(__dirname, 'golden_set.jsonl');
const BACKUP_DIR = path.join(__dirname, 'backups');

// ============ 工具函数 ============

function loadDecisions(filePath = DECISION_LOG) {
  if (!fs.existsSync(filePath)) return [];
  const lines = fs.readFileSync(filePath, 'utf-8').trim().split('\n').filter(Boolean);
  return lines.map(l => {
    try { return JSON.parse(l); } catch { return null; }
  }).filter(Boolean);
}

function fmtPct(num, total) {
  if (total === 0) return '0%';
  return (num / total * 100).toFixed(1) + '%';
}

// ============ stats ============

function showStats(filePath) {
  const decisions = loadDecisions(filePath);
  if (decisions.length === 0) {
    console.log('📭 无决策记录。先运行一次扫描产生数据。');
    return;
  }

  const total = decisions.length;
  const saved = decisions.filter(d => d.saved).length;
  const discarded = total - saved;
  const reviewed = decisions.filter(d => d.reviewed).length;
  const correct = decisions.filter(d => d.reviewed && d.correct).length;
  const incorrect = decisions.filter(d => d.reviewed && !d.correct).length;

  // 按 matchMode 统计
  const byMode = {};
  decisions.forEach(d => {
    const m = d.matchMode || 'unknown';
    if (!byMode[m]) byMode[m] = { total: 0, saved: 0 };
    byMode[m].total++;
    if (d.saved) byMode[m].saved++;
  });

  // 按来源统计
  const bySource = {};
  decisions.forEach(d => {
    const s = d.source || 'unknown';
    if (!bySource[s]) bySource[s] = { total: 0, saved: 0 };
    bySource[s].total++;
    if (d.saved) bySource[s].saved++;
  });

  // 分数分布
  const buckets = { '0.0-0.2': 0, '0.2-0.4': 0, '0.4-0.6': 0, '0.6-0.8': 0, '0.8-1.0': 0 };
  decisions.forEach(d => {
    const s = d.finalScore || d.aiScore || 0;
    if (s < 0.2) buckets['0.0-0.2']++;
    else if (s < 0.4) buckets['0.2-0.4']++;
    else if (s < 0.6) buckets['0.4-0.6']++;
    else if (s < 0.8) buckets['0.6-0.8']++;
    else buckets['0.8-1.0']++;
  });

  console.log('\n═══════════════════════════════════════');
  console.log('   📊 AI 审核决策统计');
  console.log('═══════════════════════════════════════\n');
  console.log(`  总决策数:       ${total}`);
  console.log(`  已保存(通过):   ${saved} (${fmtPct(saved, total)})`);
  console.log(`  已丢弃:         ${discarded} (${fmtPct(discarded, total)})`);
  console.log(`  已人工审核:     ${reviewed} (${fmtPct(reviewed, total)})`);
  if (reviewed > 0) {
    console.log(`  审核准确率:     ${fmtPct(correct, reviewed)} (${correct}/${reviewed})`);
  }
  console.log('\n  ── 按匹配模式 ──');
  for (const [mode, v] of Object.entries(byMode)) {
    console.log(`  ${mode.padEnd(16)} 总数:${String(v.total).padStart(4)}  保存:${String(v.saved).padStart(4)} (${fmtPct(v.saved, v.total)})`);
  }
  console.log('\n  ── 按来源 ──');
  const topSources = Object.entries(bySource).sort((a, b) => b[1].total - a[1].total).slice(0, 8);
  for (const [src, v] of topSources) {
    console.log(`  ${src.padEnd(16)} 总数:${String(v.total).padStart(4)}  保存:${String(v.saved).padStart(4)} (${fmtPct(v.saved, v.total)})`);
  }
  console.log('\n  ── 分数分布 ──');
  for (const [range, count] of Object.entries(buckets)) {
    const bar = '█'.repeat(Math.round(count / Math.max(1, total) * 30));
    console.log(`  ${range.padEnd(10)} ${String(count).padStart(4)} ${bar}`);
  }
  console.log('\n═══════════════════════════════════════\n');
}

// ============ review ============

async function interactiveReview(limit = 50) {
  const decisions = loadDecisions();
  const unreviewed = decisions.filter(d => !d.reviewed).slice(0, limit);

  if (unreviewed.length === 0) {
    console.log('✅ 所有记录已审核完毕。');
    return;
  }

  console.log(`\n🔍 待审核: ${unreviewed.length} 条（共 ${decisions.length} 条）`);
  console.log('  输入 y=相关  n=无关  f=虚假  s=跳过  q=退出\n');

  const readline = require('readline');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = q => new Promise(resolve => rl.question(q, resolve));

  let count = 0;
  for (const d of unreviewed) {
    count++;
    const score = d.finalScore || d.aiScore || 0;
    const icon = d.saved ? '🟢' : '⏭️';
    console.log(`\n── ${count}/${unreviewed.length} ${icon} [${d.source}] score:${score} ──`);
    console.log(`  关键词: ${d.keyword}`);
    console.log(`  标题:   ${d.title}`);
    if (d.contentSubject) console.log(`  主题:   ${d.contentSubject}`);
    console.log(`  模式:   ${d.matchMode} | 可信度: ${d.credibilityTier}`);

    const ans = (await ask('  [y]相关 [n]无关 [f]虚假 [s]跳过 [q]退出: ')).toLowerCase();

    if (ans === 'q') break;
    if (ans === 's') continue;
    if (ans === 'y') d.correct = true;
    else if (ans === 'n') d.correct = false;
    else if (ans === 'f') { d.correct = false; d.isFake = true; }
    else continue;

    d.reviewed = true;
    updateDecision(d);
  }

  rl.close();

  // 统计本次
  const reviewedNow = decisions.filter(d => d.reviewed);
  const correctNow = reviewedNow.filter(d => d.correct);
  console.log(`\n📊 本次审核: ${reviewedNow.length} 条 | 准确: ${correctNow.length} (${fmtPct(correctNow.length, reviewedNow.length)})`);
  console.log('审核结果已写回日志。运行 `node tests/evaluate.js export` 导出 golden set。');
}

function updateDecision(entry) {
  const lines = fs.readFileSync(DECISION_LOG, 'utf-8').split('\n').filter(Boolean);
  const updated = [];
  for (const line of lines) {
    try {
      const d = JSON.parse(line);
      if (d.ts === entry.ts && d.title === entry.title) {
        d.reviewed = entry.reviewed;
        d.correct = entry.correct;
        if (entry.reviewedLabel) d.reviewedLabel = entry.reviewedLabel;
      }
      updated.push(JSON.stringify(d));
    } catch { updated.push(line); }
  }
  fs.writeFileSync(DECISION_LOG, updated.join('\n') + '\n');
}

// ============ export golden set ============

function exportGoldenSet() {
  const decisions = loadDecisions();
  const reviewed = decisions.filter(d => d.reviewed);
  if (reviewed.length === 0) {
    console.log('⚠️ 没有已审核的记录。先运行 `node tests/evaluate.js review`。');
    return;
  }

  // 只导出关键字段
  const golden = reviewed.map(d => ({
    keyword: d.keyword,
    title: d.title,
    source: d.source,
    credibilityTier: d.credibilityTier,
    matchMode: d.matchMode,
    finalScore: d.finalScore || d.aiScore,
    expectedRelevant: d.correct && !d.isFake,
    expectedFake: d.isFake || false,
    expectedScore: d.finalScore || d.aiScore, // 可后续手动调整
  }));

  fs.writeFileSync(GOLDEN_SET, golden.map(g => JSON.stringify(g)).join('\n') + '\n');
  console.log(`✅ Golden set 已导出: ${golden.length} 条 → ${GOLDEN_SET}`);
}

// ============ regression test ============

async function runRegressionTest() {
  if (!fs.existsSync(GOLDEN_SET)) {
    console.log('⚠️ Golden set 不存在。先运行 `node tests/evaluate.js review` 然后 `node tests/evaluate.js export`。');
    return;
  }

  const golden = loadDecisions(GOLDEN_SET);
  if (golden.length === 0) {
    console.log('⚠️ Golden set 为空。');
    return;
  }

  console.log(`\n🧪 回归测试: ${golden.length} 条 golden 样本\n`);

  // 注意：这需要实际调用 AI。为避免费用，仅对比已有的 finalScore
  // 如果日志中已有同标题的决策，直接对比
  const decisions = loadDecisions();
  const titleMap = new Map();
  decisions.forEach(d => { titleMap.set(d.title, d); });

  let matched = 0;
  let correctPredictions = 0;
  let falsePositives = 0; // 应该无关但 AI 判定相关
  let falseNegatives = 0; // 应该相关但 AI 判定无关

  for (const g of golden) {
    const d = titleMap.get(g.title);
    if (!d) continue;
    matched++;

    const aiRelevant = d.saved;
    const expectedRelevant = g.expectedRelevant;

    if (aiRelevant === expectedRelevant) {
      correctPredictions++;
    } else if (aiRelevant && !expectedRelevant) {
      falsePositives++;
      console.log(`  ❌ 假阳性: "${d.title.substring(0, 60)}" | score:${d.finalScore}`);
    } else if (!aiRelevant && expectedRelevant) {
      falseNegatives++;
      console.log(`  ⚠️ 假阴性: "${d.title.substring(0, 60)}" | score:${d.finalScore}`);
    }
  }

  console.log(`\n  ── 结果 ──`);
  console.log(`  匹配样本:     ${matched}/${golden.length}`);
  console.log(`  正确预测:     ${correctPredictions} (${fmtPct(correctPredictions, matched)})`);
  console.log(`  假阳性(误收): ${falsePositives}`);
  console.log(`  假阴性(误拒): ${falseNegatives}`);
  if (matched > 0) {
    const precision = correctPredictions / (correctPredictions + falsePositives) || 0;
    const recall = correctPredictions / (correctPredictions + falseNegatives) || 0;
    const f1 = precision + recall > 0 ? 2 * precision * recall / (precision + recall) : 0;
    console.log(`  Precision:     ${(precision * 100).toFixed(1)}%`);
    console.log(`  Recall:        ${(recall * 100).toFixed(1)}%`);
    console.log(`  F1 Score:      ${(f1 * 100).toFixed(1)}%`);
  }
  console.log('');
}

// ============ compare ============

function compareLogs(otherFile) {
  if (!fs.existsSync(otherFile)) {
    console.log(`⚠️ 文件不存在: ${otherFile}`);
    return;
  }

  const current = loadDecisions();
  const other = loadDecisions(otherFile);

  const curSaved = current.filter(d => d.saved).length;
  const curDisc = current.length - curSaved;
  const othSaved = other.filter(d => d.saved).length;
  const othDisc = other.length - othSaved;

  console.log('\n📊 A/B 对比\n');
  console.log(`              当前          对比文件`);
  console.log(`  ──────────  ──────────    ──────────`);
  console.log(`  总决策:     ${String(current.length).padStart(5)}        ${String(other.length).padStart(5)}`);
  console.log(`  已保存:     ${String(curSaved).padStart(5)} (${fmtPct(curSaved, current.length)})   ${String(othSaved).padStart(5)} (${fmtPct(othSaved, other.length)})`);
  console.log(`  已丢弃:     ${String(curDisc).padStart(5)} (${fmtPct(curDisc, current.length)})   ${String(othDisc).padStart(5)} (${fmtPct(othDisc, other.length)})`);

  // 分数分布对比
  const avg = arr => arr.length ? (arr.reduce((a, b) => a + (b.finalScore || b.aiScore || 0), 0) / arr.length).toFixed(3) : 'N/A';
  console.log(`  均分(全部): ${avg(current).padStart(7)}        ${avg(other).padStart(7)}`);
  console.log(`  均分(保存): ${avg(current.filter(d => d.saved)).padStart(7)}        ${avg(other.filter(d => d.saved)).padStart(7)}`);
  console.log('');
}

// ============ main ============

async function main() {
  const cmd = process.argv[2] || 'stats';
  const arg = process.argv[3];

  // 确保备份目录存在
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

  switch (cmd) {
    case 'stats':
      showStats(arg);
      break;
    case 'review':
      await interactiveReview(arg ? parseInt(arg) : 50);
      break;
    case 'test':
      await runRegressionTest();
      break;
    case 'export':
      exportGoldenSet();
      break;
    case 'compare':
      compareLogs(arg);
      break;
    case 'backup':
      if (fs.existsSync(DECISION_LOG)) {
        const ts = new Date().toISOString().replace(/[:.]/g, '-');
        const dest = path.join(BACKUP_DIR, `ai_decisions_${ts}.jsonl`);
        fs.copyFileSync(DECISION_LOG, dest);
        console.log(`✅ 备份: ${dest}`);
      } else {
        console.log('⚠️ 无决策日志可备份。');
      }
      break;
    case 'reset':
      if (fs.existsSync(DECISION_LOG)) {
        // 先备份再清空
        const ts = new Date().toISOString().replace(/[:.]/g, '-');
        const dest = path.join(BACKUP_DIR, `ai_decisions_${ts}.jsonl`);
        fs.copyFileSync(DECISION_LOG, dest);
        fs.writeFileSync(DECISION_LOG, '');
        console.log(`✅ 已备份到 ${dest}并清空决策日志。`);
      }
      break;
    default:
      console.log(`
AI 相关性审核评估工具

用法: node tests/evaluate.js <command>

命令:
  stats [file]     查看决策统计（默认读取 ai_decisions.jsonl）
  review [n]       交互式审核最近 n 条未审核决策（默认 50）
  test             用 golden set 做回归测试
  export           从已审核记录导出 golden set
  compare <file>   对比两个决策日志的统计差异
  backup           备份当前决策日志
  reset            备份并清空决策日志（开始新一轮评估）
`);
  }
}

main().catch(console.error);
