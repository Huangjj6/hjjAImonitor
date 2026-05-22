const axios = require('axios');
const config = require('../config');

// ─── 同义/缩写映射表 ───
const SYNONYM_MAP = {
  // AI / 大模型
  'ai': ['人工智能', 'artificial intelligence', 'a.i'],
  '人工智能': ['ai', 'artificial intelligence'],
  '大模型': ['llm', 'large language model', '大语言模型', 'foundation model', '基础模型'],
  '大语言模型': ['大模型', 'llm', 'large language model'],
  'llm': ['大模型', '大语言模型', 'large language model'],
  'gpt': ['chatgpt', 'gpt-4', 'gpt4', 'gpt35', 'gpt-3.5'],
  'chatgpt': ['gpt', 'gpt-4', 'openai'],
  'openai': ['chatgpt', 'gpt', 'sam altman', 'sora'],
  'gpt-5': ['gpt5', 'gpt 5', 'chatgpt 5'],
  'gpt5': ['gpt-5', 'gpt 5'],
  'deepseek': ['深度求索', 'deep seek'],
  '深度求索': ['deepseek', 'deep seek'],
  '智能体': ['ai agent', 'agent', 'AI Agent', '自主智能体', '智能代理', 'agentic'],
  'ai agent': ['智能体', 'agent', '自主智能体', '智能代理'],
  'agent': ['智能体', 'ai agent', '自主智能体', '智能代理', 'agentic'],
  'vibe coding': ['vibe', 'vibecoding', 'vibe-coding', 'cursor ai', 'cursor', 'windsurf', 'bolt.new', 'lovable', 'ai coding', 'ai programming'],
  'vibe': ['vibe coding', 'vibecoding', 'vibe-coding'],
  'cursor': ['cursor ai', 'cursor ide', 'vibe coding', 'ai coding assistant'],

  // 编程语言 / 框架
  'js': ['javascript', 'node.js', 'nodejs', 'node', 'ecmascript'],
  'javascript': ['js', 'ecmascript', 'es6', 'es8', 'es2024'],
  'ts': ['typescript'],
  'typescript': ['ts'],
  'react': ['reactjs', 'react.js', 'react 19', 'nextjs', 'next.js'],
  'vue': ['vuejs', 'vue.js', 'vue 3', 'nuxt', 'nuxtjs'],
  'node': ['nodejs', 'node.js', 'javascript runtime', 'express'],
  'nodejs': ['node', 'node.js'],
  'python': ['py', 'python3', 'django', 'flask', 'pytorch'],

  // 技术名词
  'docker': ['container', '容器', 'docker compose', 'dockerfile'],
  'kubernetes': ['k8s', 'kube', '容器编排'],
  'k8s': ['kubernetes', 'kube'],
  'rust': ['rustlang', 'rust-lang', 'rustc'],
  '区块链': ['blockchain', 'web3', 'web3.0', 'crypto', '加密货币', 'nft'],
  'blockchain': ['区块链', 'web3', '分布式账本'],

  // 公司 / 品牌
  'google': ['谷歌', 'alphabet', 'gemini', 'gmail', 'pixel'],
  '苹果': ['apple', 'iphone', 'ios', 'mac', 'macos', 'tim cook'],
  'apple': ['苹果', 'iphone', 'mac', 'ios', 'macos', 'tim cook'],
  'microsoft': ['微软', 'windows', 'azure', 'copilot', 'msft', 'satya'],
  '微软': ['microsoft', 'windows', 'azure', 'copilot', 'satya nadella'],
  'meta': ['facebook', 'instagram', 'whatsapp', 'llama', '扎克伯格'],
  'tesla': ['特斯拉', '马斯克', 'elon musk', 'cybertruck', 'model y'],
  '特斯拉': ['tesla', '马斯克', 'elon musk'],

  // 通用技术
  'api': ['api接口', 'rest api', 'restful', 'web api', 'application programming interface', 'open api'],
  'sdk': ['软件开发包', 'software development kit', '开发工具包'],
  'ui': ['用户界面', 'user interface', 'ux', '界面设计'],
};

/**
 * 获取关键词的所有同义/缩写/变体
 * @param {string} keyword
 * @returns {string[]}
 */
function getKeywordSynonyms(keyword) {
  const kw = keyword.toLowerCase().trim();
  const results = [];

  // 正向查表
  if (SYNONYM_MAP[kw]) {
    results.push(...SYNONYM_MAP[kw]);
  }

  // 反向查表：找那些把 kw 列为同义词的 key
  for (const [key, values] of Object.entries(SYNONYM_MAP)) {
    if (key !== kw && values.some(v => v.toLowerCase() === kw)) {
      results.push(key);
    }
  }

  return [...new Set(results.map(s => s.toLowerCase()))];
}

/**
 * 多层预过滤：判断关键词是否可能出现在标题/摘要中
 * @returns {Object} { matched: boolean, matchLayer: string }
 */
function preFilterKeyword(keyword, title, summary) {
  const kw = (keyword || '').toLowerCase().trim();
  const ti = (title || '').toLowerCase();
  const su = (summary || '').toLowerCase();
  if (!kw) return { matched: false, matchLayer: 'empty' };

  // Layer 1: 精确子串匹配（最快路径）
  if (ti.includes(kw) || su.includes(kw)) {
    return { matched: true, matchLayer: 'exact' };
  }

  // Layer 2: 分词级匹配 — 按标点和空格分词后检查
  const tokens = kw.split(/[\s\-_.:/·・]+/).filter(t => t.length >= 2);
  if (tokens.length > 1) {
    const anyMatched = tokens.some(t => ti.includes(t) || su.includes(t));
    if (anyMatched) {
      return { matched: true, matchLayer: 'token' };
    }
  }

  // Layer 2b: 中文关键词渐进截断匹配
  // 对于"智能体开发"这种无分隔符的中文复合词，尝试去掉末尾1~2字再匹配
  if (tokens.length <= 1 && /[\u4e00-\u9fff]/.test(kw)) {
    for (let trimLen = 1; trimLen <= Math.min(2, kw.length - 1); trimLen++) {
      const subKw = kw.slice(0, kw.length - trimLen);
      if (subKw.length >= 2 && (ti.includes(subKw) || su.includes(subKw))) {
        return { matched: true, matchLayer: 'token' };
      }
    }
  }

  // Layer 3: 标准化匹配 — 去掉标点和空格后比较
  const normalize = s => s.replace(/[\s\-_.:·・、，。！？（）()\[\]【】「」{}'"：；]/g, '');
  const kwNorm = normalize(kw);
  if (kwNorm.length > 1) {
    const tiNorm = normalize(ti);
    const suNorm = normalize(su);
    if (tiNorm.includes(kwNorm) || suNorm.includes(kwNorm)) {
      return { matched: true, matchLayer: 'normalized' };
    }
  }

  // Layer 4: 同义/缩写映射匹配 + 中文同义关键词内部渐进匹配
  const synonyms = getKeywordSynonyms(kw);
  for (const syn of synonyms) {
    if (syn.length >= 2 && (ti.includes(syn) || su.includes(syn))) {
      return { matched: true, matchLayer: 'synonym' };
    }
  }
  // 同义词也做渐进截断匹配（如 "智能体开发" → synonyms里配到"智能体"）
  if (/[\u4e00-\u9fff]/.test(kw)) {
    for (const syn of synonyms) {
      for (let trimLen = 1; trimLen <= Math.min(2, syn.length - 1); trimLen++) {
        const subSyn = syn.slice(0, syn.length - trimLen);
        if (subSyn.length >= 2 && (ti.includes(subSyn) || su.includes(subSyn))) {
          return { matched: true, matchLayer: 'synonym' };
        }
      }
    }
  }

  return { matched: false, matchLayer: 'all_missed' };
}

/** AI 未返回 narration 时的兜底生成 */
function buildFallbackNarration(aiResult, title) {
  const matchLab = {
    exact_match: '核心讨论',
    partial_match: '部分提及',
    tangential: '间接关联',
    unrelated: '不相关',
  };
  const m = matchLab[aiResult.matchMode] || '未知';
  const subj = aiResult.contentSubject ? `涉及"${aiResult.contentSubject}"` : '';
  const t = title ? title.slice(0, 60) : '未知内容';
  return `内容"${t}"，${m}监控关键词${subj ? `，${subj}` : ''}。`;
}

/**
 * 使用 AI 验证热点内容是否与关键词真正相关
 * @param {string} keyword - 监控的关键词
 * @param {string} title - 热点标题
 * @param {string} summary - 热点摘要
 * @param {string} source - 来源
 * @param {string} credibilityTier - 来源可信度标签（official/media/blog/social/unknown）
 * @returns {Object} { isRelevant, isFake, score, reason, contentSubject, matchMode, confidence, sentiment, entities }
 */
async function verifyHotspot(keyword, title, summary, source, credibilityTier = 'unknown') {
  if (!config.openrouter.apiKey) {
    console.warn('[AI] OpenRouter API key not configured, skipping AI verification');
    return { isRelevant: true, isFake: false, score: 0.5, reason: 'AI未配置，默认通过', narration: `AI未配置，标题"${title.slice(0, 60)}"默认通过审核。`, contentSubject: '', matchMode: 'unknown', confidence: 0, entities: [] };
  }

  // 多层预过滤：判断关键词是否可能出现在内容中，避免无效 AI 调用
  if (config.preFilter.enabled) {
    const pf = preFilterKeyword(keyword, title, summary);
    if (!pf.matched) {
      console.log(`[AI] Pre-filter(Layer:${pf.matchLayer}): keyword "${keyword}" not found, skip AI call`);
      return {
        isRelevant: false, isFake: false,
        score: config.preFilter.scoreOnMiss,
        reason: `预过滤(${pf.matchLayer})：关键词未出现在标题/摘要中`,
        narration: `标题与摘要中未发现关键词"${keyword}"的匹配，判定为不相关内容。`,
        contentSubject: '', matchMode: 'unrelated',
        confidence: config.preFilter.confidenceOnMiss,
        entities: [],
      };
    }
    if (pf.matchLayer !== 'exact') {
      console.log(`[AI] Pre-filter(Layer:${pf.matchLayer}): "${keyword}" fuzzy matched, proceeding to AI`);
    }
  }

  const credibility = config.sourceCredibility[credibilityTier] || config.sourceCredibility.unknown;

  const prompt = `你是热点信息相关性审核专家。判断一条信息与监控关键词的相关性。

【监控关键词】"${keyword}"
【来源】${source}（可信度: ${credibility.label}, Tier ${credibility.tier}/5）
【标题】${title}
【摘要】${summary || '无摘要'}

评分标准（0-1）:
0.0-0.3=无关（关键词仅边栏出现/SEO蹭词）
0.3-0.5=弱相关（领域相关但非焦点）
0.5-0.7=直接相关（关键词是讨论对象之一）
0.7-1.0=高度相关（核心主题+来源权威）

请按以下步骤逐一推理分析:

第一步：提取真实主题
- 这条内容实际在讲什么？
- 它属于什么领域/话题？

第二步：对比关键词与主题
- 关键词是内容的讨论核心，还是只是顺带提及？
- 属于哪种匹配模式？（exact_match/partial_match/tangential/unrelated）

第三步：判断可信度
- 标题是否有标题党/夸大/诱导点击的嫌疑？
- 内容是否为广告软文、蹭热度、或虚假信息？

第四步：情感分析
- 内容对关键词的情感倾向是正面/负面/中立？

第五步：确信度评估
- 你对以上判断有多大把握？考虑信息完整性、来源可信度等因素

第六步：提取关联实体
- 文中还提到了哪些与关键词相关的关键实体？

=====

先输出推理过程，然后在最后输出JSON。

推理：
<你的逐步分析>

JSON：
{
  "narration": "一段80字内的自然语言总结：用一句话概括这篇内容讲什么，然后说明它与监控关键词的相关程度。例如：'这是一篇关于OpenAI发布GPT-5的报道，关键词GPT-5是文章核心讨论对象，内容来自TechCrunch可信度较高'",
  "contentSubject": "内容的实际主题(20字内)",
  "matchMode": "exact_match|partial_match|tangential|unrelated",
  "isRelevant": true/false,
  "isFake": true/false,
  "score": 0.0-1.0,
  "confidence": 0.0-1.0,
  "sentiment": "positive|negative|neutral",
  "entities": ["实体1", "实体2"],
  "reason": "判断理由(60字内)"
}`;

  try {
    const response = await axios.post(
      `${config.openrouter.baseUrl}/chat/completions`,
      {
        model: config.openrouter.model,
        messages: [
          { role: 'system', content: '你是严格的信息相关性审核助手。先逐步推理分析，再输出JSON。推理过程放在"推理："之后，JSON放在"JSON："之后。必须严格按评分标准打分。' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.1,
        max_tokens: 600,
      },
      {
        headers: {
          'Authorization': `Bearer ${config.openrouter.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'http://localhost:5173',
          'X-Title': 'Hot Monitor',
        },
        timeout: 30000,
      }
    );

    const aiResponse = response.data.choices[0].message.content;
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in response');
    const result = JSON.parse(jsonMatch[0]);

    // 规范化字段
    result.score = Math.max(0, Math.min(1, parseFloat(result.score) || 0.5));
    result.isRelevant = result.isRelevant !== false;
    result.isFake = result.isFake === true;
    result.contentSubject = result.contentSubject || '';
    result.matchMode = result.matchMode || 'unknown';
    result.reason = result.reason || '';
    result.narration = result.narration || buildFallbackNarration(result, title);
    result.confidence = Math.max(0, Math.min(1, parseFloat(result.confidence) || 0));
    result.entities = Array.isArray(result.entities) ? result.entities.slice(0, 5) : [];

    console.log(`[AI] "${title.substring(0, 40)}" => ${result.matchMode} | s:${result.score} | c:${result.confidence} | subj:"${result.contentSubject}"`);
    return result;
  } catch (err) {
    const status = err.response?.status;
    const detail = status
      ? `HTTP ${status}: ${JSON.stringify(err.response.data).substring(0, 200)}`
      : err.message;
    console.error(`[AI] Verification error:`, detail);
    const errMsg = status === 402 ? 'OpenRouter余额不足'
      : status === 429 ? 'API请求频率过高'
      : status === 401 || status === 403 ? 'API Key无效'
      : `AI验证异常(HTTP ${status || '?'})`;
    return { isRelevant: true, isFake: false, score: 0.5, reason: errMsg, narration: `${errMsg}，标题"${title.slice(0, 60)}"默认通过。`, contentSubject: '', matchMode: 'error', confidence: 0, entities: [] };
  }
}

/**
 * 使用 AI 对一批热点进行排序和去重
 * @param {Array} hotspots - 热点列表
 * @param {string} category - 分类
 */
async function rankAndDeduplicate(hotspots, category) {
  if (!config.openrouter.apiKey || hotspots.length <= 1) return hotspots;

  const items = hotspots.map((h, i) => `${i}: ${h.title} (来源: ${h.source})`).join('\n');
  const prompt = `请分析以下"${category}"领域的热点信息，完成排序和去重:

${items}

请以JSON格式返回:
{
  "ranked": [0, 2, 1, ...],     // 按重要性排序的索引（最重要的排前面）
  "duplicates": [[0, 3], ...],   // 发现的重复内容索引对
  "topSummary": "这批热点的总体摘要(50字)"
}`;

  try {
    const response = await axios.post(
      `${config.openrouter.baseUrl}/chat/completions`,
      {
        model: config.openrouter.model,
        messages: [
          { role: 'system', content: '你是信息分析助手，只返回JSON。' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.1,
        max_tokens: 500,
      },
      {
        headers: {
          'Authorization': `Bearer ${config.openrouter.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'http://localhost:5173',
          'X-Title': 'Hot Monitor',
        },
        timeout: 30000,
      }
    );

    const content = response.data.choices[0].message.content;
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in response');
    const result = JSON.parse(jsonMatch[0]);
    return result;
  } catch (err) {
    console.error('[AI] Rank error:', err.message);
    return null;
  }
}

/**
 * 智能分类关键词类型
 * @param {string} keyword - 关键词
 * @returns {'person'|'organization'|'topic'}
 */
async function classifyKeyword(keyword) {
  if (!config.openrouter.apiKey) {
    return 'topic';
  }

  const prompt = `请判断以下关键词的类型：
"${keyword}"

分类规则：
- "person" - 人名、博主、UP主、网红、名人、个人IP（如：程序员鱼皮、李佳琦、Tim Cook）
- "organization" - 公司、品牌、官方账号、开源项目、机构（如：OpenAI、Google、Vue.js、DeepSeek）
- "topic" - 技术话题、概念、事件、普通关键词（如：AI绘画、Rust编程、比特币、年终总结）

只返回一个单词：person、organization 或 topic`;

  try {
    const response = await axios.post(
      `${config.openrouter.baseUrl}/chat/completions`,
      {
        model: config.openrouter.model,
        messages: [
          { role: 'system', content: '你是信息分类助手。只返回person/organization/topic，不要任何额外文字。' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.1,
        max_tokens: 20,
      },
      {
        headers: {
          'Authorization': `Bearer ${config.openrouter.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'http://localhost:5173',
          'X-Title': 'Hot Monitor',
        },
        timeout: 10000,
      }
    );

    const result = response.data.choices[0].message.content.trim().toLowerCase();
    if (['person', 'organization'].includes(result)) {
      console.log(`[AI] Keyword "${keyword}" classified as: ${result}`);
      return result;
    }
    return 'topic';
  } catch (err) {
    console.error(`[AI] classifyKeyword error for "${keyword}":`, err.message);
    return 'topic';
  }
}

/**
 * Query Expansion：为关键词生成多语言扩展搜索词
 * @param {string} keyword - 原始关键词
 * @param {string} keywordType - person/organization/topic
 * @returns {Object} { original, chinese: string[], english: string[] }
 */
async function expandQuery(keyword, keywordType = 'topic') {
  if (!config.openrouter.apiKey || !config.queryExpansion.enabled) {
    return { original: keyword, chinese: [keyword], english: [keyword] };
  }

  const prompt = `你是一个搜索引擎查询扩展专家。请为以下监控关键词生成扩展搜索词，帮助从不同语言的信息源找到更多相关内容。

【关键词】"${keyword}"
【类型】${keywordType === 'person' ? '人名/个人IP' : keywordType === 'organization' ? '组织/品牌' : '技术话题/概念'}

请生成：
1. 与关键词意思相近的中文搜索词（同义词、别名、上位词）
2. 与关键词相关的英文搜索词（翻译、英文同义词、相关术语）
3. 各 2-3 个词，不要重复原词

要求：
- 扩展词之间用 "/" 分隔
- 不要编号，不要解释
- 中文词不能包含英文，英文词不能包含中文
- 如果关键词已经是英文，中文扩展词提供常见中文翻译

返回格式（严格按此格式，不要其他内容）：
中文扩展词: 词1/词2/词3
英文扩展词: 词1/词2/词3`;

  try {
    const response = await axios.post(
      `${config.openrouter.baseUrl}/chat/completions`,
      {
        model: config.openrouter.model,
        messages: [
          { role: 'system', content: '你是搜索查询扩展专家。只按指定格式返回，不要多余内容。' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.2,
        max_tokens: 150,
      },
      {
        headers: {
          'Authorization': `Bearer ${config.openrouter.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'http://localhost:5173',
          'X-Title': 'Hot Monitor',
        },
        timeout: 15000,
      }
    );

    const content = response.data.choices[0].message.content.trim();
    const chineseMatch = content.match(/中文扩展词:\s*(.+)/);
    const englishMatch = content.match(/英文扩展词:\s*(.+)/);

    const chinese = chineseMatch
      ? chineseMatch[1].split('/').map(s => s.trim()).filter(Boolean).slice(0, config.queryExpansion.maxExpansionsPerSource)
      : [];
    const english = englishMatch
      ? englishMatch[1].split('/').map(s => s.trim()).filter(Boolean).slice(0, config.queryExpansion.maxExpansionsPerSource)
      : [];

    const result = {
      original: keyword,
      chinese: chinese.length > 0 ? chinese : [keyword],
      english: english.length > 0 ? english : [keyword],
    };

    console.log(`[AI] expandQuery "${keyword}" => zh:${result.chinese.join('/')} en:${result.english.join('/')}`);
    return result;
  } catch (err) {
    console.error(`[AI] expandQuery error for "${keyword}":`, err.message);
    return { original: keyword, chinese: [keyword], english: [keyword] };
  }
}

module.exports = { verifyHotspot, rankAndDeduplicate, classifyKeyword, expandQuery };
