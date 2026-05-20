const axios = require('axios');
const config = require('../config');

/**
 * 使用 OpenRouter AI 验证热点内容是否真实相关
 * @param {string} keyword - 监控的关键词
 * @param {string} title - 热点标题
 * @param {string} summary - 热点摘要
 * @param {string} source - 来源
 * @returns {Object} { isRelevant, isFake, score, reason }
 */
async function verifyHotspot(keyword, title, summary, source) {
  if (!config.openrouter.apiKey) {
    console.warn('[AI] OpenRouter API key not configured, skipping AI verification');
    return { isRelevant: true, isFake: false, score: 0.5, reason: 'AI未配置，默认通过' };
  }

  const prompt = `你是一个热点信息验证专家。请分析以下信息是否与监控关键词"${keyword}"真正相关，以及是否是虚假/蹭热度内容。

信息来源: ${source}
标题: ${title}
摘要: ${summary || '无摘要'}

请以JSON格式返回分析结果:
{
  "isRelevant": true/false,     // 是否与关键词真正相关
  "isFake": true/false,         // 是否为虚假/标题党/蹭热度内容
  "score": 0.0-1.0,            // 综合相关度评分
  "reason": "简短分析理由(50字以内)"
}

注意:
- 如果内容只是恰好包含关键词但主题不相关，标记 isRelevant=false
- 如果是标题党、谣言、广告软文，标记 isFake=true
- 来自官方渠道、权威媒体的内容应给予更高评分`;

  try {
    const response = await axios.post(
      `${config.openrouter.baseUrl}/chat/completions`,
      {
        model: config.openrouter.model,
        messages: [
          { role: 'system', content: '你是一个严格的信息验证助手。你必须只返回JSON，不要包含任何其他文字。' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.1,
        max_tokens: 300,
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
    // 尝试提取 JSON（有些模型会在 JSON 外加 markdown 代码块）
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in response');
    const result = JSON.parse(jsonMatch[0]);
    console.log(`[AI] Verified "${title.substring(0, 30)}..." => score: ${result.score}, fake: ${result.isFake}`);
    return result;
  } catch (err) {
    const detail = err.response?.status 
      ? `HTTP ${err.response.status}: ${JSON.stringify(err.response.data).substring(0, 200)}`
      : err.message;
    console.error(`[AI] Verification error:`, detail);
    return { isRelevant: true, isFake: false, score: 0.5, reason: 'AI验证异常，默认通过' };
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
