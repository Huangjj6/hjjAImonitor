const axios = require('axios');
const config = require('../config');

/**
 * 使用 AI 验证热点内容是否与关键词真正相关
 * @param {string} keyword - 监控的关键词
 * @param {string} title - 热点标题
 * @param {string} summary - 热点摘要
 * @param {string} source - 来源
 * @param {string} credibilityTier - 来源可信度标签（official/media/blog/social/unknown）
 * @returns {Object} { isRelevant, isFake, score, reason, contentSubject, matchMode }
 */
async function verifyHotspot(keyword, title, summary, source, credibilityTier = 'unknown') {
  if (!config.openrouter.apiKey) {
    console.warn('[AI] OpenRouter API key not configured, skipping AI verification');
    return { isRelevant: true, isFake: false, score: 0.5, reason: 'AI未配置，默认通过', contentSubject: '', matchMode: 'unknown' };
  }

  // 预过滤：关键词完全不在标题也不在摘要中 → 快速跳过，节省AI调用
  const kwLower = keyword.toLowerCase();
  const titleLower = (title || '').toLowerCase();
  const summaryLower = (summary || '').toLowerCase();
  if (!titleLower.includes(kwLower) && !summaryLower.includes(kwLower)) {
    console.log(`[AI] Pre-filter: keyword "${keyword}" not found in title/summary, skip AI call`);
    return { isRelevant: false, isFake: false, score: 0.1, reason: '预过滤：关键词未出现在标题/摘要中', contentSubject: '', matchMode: 'unrelated' };
  }

  const credibility = config.sourceCredibility[credibilityTier] || config.sourceCredibility.unknown;

  const prompt = `你是热点信息相关性审核专家。请判断一条信息与监控关键词的相关性。

【监控关键词】"${keyword}"
【来源】${source}（可信度: ${credibility.label}，Tier ${credibility.tier}/5）
【标题】${title}
【摘要】${summary || '无摘要'}

### 评分标准（必须严格遵守）
| 分数区间 | 含义 | 典型场景 |
|----------|------|----------|
| 0.0-0.3  | 无关 | 关键词仅在页面边栏/推荐位出现，或纯SEO蹭词 |
| 0.3-0.5  | 弱相关 | 内容涉及相关领域但关键词非焦点，或仅一笔带过 |
| 0.5-0.7  | 直接相关 | 关键词是内容的讨论对象之一，有实质性内容 |
| 0.7-1.0  | 高度相关 | 关键词是唯一/核心主题，内容深入且来源权威 |

### 判断流程
1. 先提取内容真实主题(contentSubject)：独立判断"这篇文章在讲什么"
2. 对比监控关键词与 contentSubject 的交集程度
3. 如果关键词只是碰巧出现但内容不围绕它 → isRelevant=false
4. 如果是标题党/广告/纯蹭热度 → isFake=true
5. 来源可信度 Tier 越高，相同内容应给更高分

### 示例
- 关键词"OpenAI"，标题"OpenAI CEO当选年度人物" → exact_match, score 0.85
- 关键词"React"，标题"前端2025趋势：React vs Vue" → partial_match, score 0.6
- 关键词"比特币"，标题"区块链技术在教育领域的应用"（仅末段提了比特币）→ tangential, score 0.25
- 关键词"Vue.js"，标题"用AI写网页！5个神级提示词"（内容是AI工具）→ unrelated, isFake=true

返回JSON（不要markdown包裹）:
{
  "contentSubject": "内容的实际主题(20字内)",
  "matchMode": "exact_match|partial_match|tangential|unrelated",
  "isRelevant": true/false,
  "isFake": true/false,
  "score": 0.0-1.0,
  "reason": "判断理由(50字内，说明为什么是这个分数)"
}`;

  try {
    const response = await axios.post(
      `${config.openrouter.baseUrl}/chat/completions`,
      {
        model: config.openrouter.model,
        messages: [
          { role: 'system', content: '你是严格的信息相关性审核助手。只返回JSON，不要加```json```或其他格式。必须严格按评分标准打分。' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.05,
        max_tokens: 400,
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

    console.log(`[AI] "${title.substring(0, 40)}" => ${result.matchMode} | score:${result.score} | subject:"${result.contentSubject}"`);
    return result;
  } catch (err) {
    const detail = err.response?.status
      ? `HTTP ${err.response.status}: ${JSON.stringify(err.response.data).substring(0, 200)}`
      : err.message;
    console.error(`[AI] Verification error:`, detail);
    return { isRelevant: true, isFake: false, score: 0.5, reason: 'AI验证异常，默认通过', contentSubject: '', matchMode: 'error' };
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

module.exports = { verifyHotspot, rankAndDeduplicate, classifyKeyword };
