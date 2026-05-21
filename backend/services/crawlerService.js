const axios = require('axios');
const cheerio = require('cheerio');
const config = require('../config');

/**
 * 统一 URL 规范化：处理搜索引擎重定向链接 & 相对路径
 */
function normalizeUrl(rawUrl, source) {
  if (!rawUrl) return '';
  let url = rawUrl.trim();

  // DuckDuckGo 重定向解密
  if (url.startsWith('/l/?uddg=')) {
    try {
      url = decodeURIComponent(url.replace('/l/?uddg=', ''));
    } catch { /* ignore */ }
  }

  // 搜狗搜索结果中的相对重定向链接 → 补全为绝对 URL
  if (source === '搜狗搜索' && url.startsWith('/')) {
    url = `https://www.sogou.com${url}`;
  }

  // 通用兜底：如果仍不是 http 开头则丢弃
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return '';
  }

  return url;
}

/**
 * DuckDuckGo HTML 搜索（免费、无需 API Key、不被墙）
 */
async function searchWeb(keyword) {
  const results = [];
  const query = encodeURIComponent(keyword);
  const url = `https://html.duckduckgo.com/html/?q=${query}+news`;

  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      },
      timeout: 8000,
    });

    const $ = cheerio.load(response.data);
    const links = $('.result__body');

    links.each((i, el) => {
      if (i >= config.crawler.maxResultsPerSource) return false;
      const titleEl = $(el).find('.result__title a');
      const title = titleEl.text().trim();
      const snippetEl = $(el).find('.result__snippet');
      const summary = snippetEl.text().trim();

      let link = titleEl.attr('href') || '';
      if (link.startsWith('/l/?uddg=')) {
        link = decodeURIComponent(link.replace('/l/?uddg=', ''));
      }

      if (title && link) {
        const cleanUrl = normalizeUrl(link, 'DuckDuckGo');
        if (!cleanUrl) return;
        results.push({
          title: cleanHtml(title),
          url: cleanUrl,
          source: 'DuckDuckGo',
          summary: cleanHtml(summary).substring(0, 300),
          published_at: null, // HTML 搜索结果无真实时间戳
        });
      }
    });

    console.log(`[Crawler] DuckDuckGo for "${keyword}" => ${results.length} results`);
  } catch (err) {
    console.error(`[Crawler] DuckDuckGo error for "${keyword}":`, err.message);
  }

  return results;
}

/**
 * Twitter/X API - twitterapi.io
 * 文档: https://docs.twitterapi.io/api-reference/endpoint/tweet_advanced_search
 */
async function searchTwitter(keyword) {
  const results = [];
  if (!config.twitter.apiKey) {
    console.warn('[Crawler] Twitter API key not configured, skipping');
    return results;
  }

  try {
    const response = await axios.get(
      `${config.twitter.baseUrl}/twitter/tweet/advanced_search`,
      {
        params: { query: keyword, queryType: 'Latest' },
        headers: { 'X-API-Key': config.twitter.apiKey },
        timeout: 15000,
      }
    );

    const tweets = response.data.tweets || [];

    for (const tweet of tweets) {
      const text = tweet.text || '';
      if (!text) continue;

      results.push({
        title: text.substring(0, 120) + (text.length > 120 ? '...' : ''),
        url: tweet.url || `https://x.com/i/status/${tweet.id}`,
        source: 'Twitter/X',
        summary: text.substring(0, 300),
        published_at: tweet.createdAt || null,
      });
    }

    console.log(`[Crawler] Twitter for "${keyword}" => ${results.length} results`);
  } catch (err) {
    const status = err.response?.status;
    const msg = err.response?.data?.message || err.message;
    console.error(`[Crawler] Twitter error for "${keyword}" [${status}]:`, msg);
  }

  return results;
}

/**
 * Bing 新闻搜索（用通用搜索 + news 后缀，专用新闻页已被封）
 */
async function searchBingNews(keyword) {
  const results = [];
  const query = encodeURIComponent(`${keyword} news`);
  const url = `https://www.bing.com/search?q=${query}&setlang=en-US`;

  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://www.bing.com/',
      },
      timeout: 10000,
    });

    const $ = cheerio.load(response.data);
    const links = $('.b_algo, .b_algo h2 a');

    links.each((i, el) => {
      if (i >= config.crawler.maxResultsPerSource) return false;
      const titleEl = $(el).is('h2 a') ? $(el) : $(el).find('h2 a').first();
      const title = titleEl.text().trim();
      const link = titleEl.attr('href') || '';
      const summaryEl = $(el).find('.b_caption p, .b_lineclamp2');
      const summary = summaryEl.text().trim();

      if (title && link && link.startsWith('http')) {
        results.push({
          title: cleanHtml(title),
          url: link,
          source: 'Bing News',
          summary: cleanHtml(summary).substring(0, 300),
          published_at: null,
        });
      }
    });

    console.log(`[Crawler] Bing News for "${keyword}" => ${results.length} results`);
  } catch (err) {
    console.error(`[Crawler] Bing News error for "${keyword}":`, err.message);
  }

  return results;
}

/**
 * 搜狗搜索（免费、支持中文）
 */
async function searchSogou(keyword) {
  const results = [];
  const query = encodeURIComponent(keyword);
  const url = `https://www.sogou.com/web?query=${query}`;

  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html',
        'Accept-Language': 'zh-CN,zh;q=0.9',
      },
      timeout: 15000,
    });

    const $ = cheerio.load(response.data);
    // 多种选择器覆盖不同页面结构
    const resultsList = $('.results .vrwrap, .results .rb, .vrwrap, .rb, .result, .res-item');

    if (resultsList.length === 0) {
      console.warn(`[Crawler] 搜狗 页面结构可能变化，尝试通用选择器`);
      // 备用：直接找所有带链接的标题
      $('h3 a, .vr-title a, .pt a, a[href*="http"]').each((i, el) => {
        if (i >= config.crawler.maxResultsPerSource) return false;
        const $el = $(el);
        const title = $el.text().trim();
        const link = $el.attr('href') || '';
        if (title && link && !link.startsWith('javascript') && link.length > 20 && results.length < config.crawler.maxResultsPerSource) {
          const cleanUrl = normalizeUrl(link, '搜狗搜索');
          if (!cleanUrl) return;
          results.push({
            title: cleanHtml(title),
            url: cleanUrl,
            source: '搜狗搜索',
            summary: '',
            published_at: null,
          });
        }
      });
      console.log(`[Crawler] 搜狗(fallback) for "${keyword}" => ${results.length} results`);
      return results;
    }

    resultsList.each((i, el) => {
      if (i >= config.crawler.maxResultsPerSource) return false;
      const titleEl = $(el).find('.vr-title a, .pt');
      const title = titleEl.text().trim();
      const link = titleEl.attr('href') || '';
      const summary = $(el).find('.star-wiki, .str-text, .space-txt, .str_info_div, .fb-hint').text().trim()
                    || $(el).find('.abstract, .str-text').text().trim();

      if (title && link && !link.startsWith('javascript')) {
        const cleanUrl = normalizeUrl(link, '搜狗搜索');
        if (!cleanUrl) return;
        results.push({
          title: cleanHtml(title),
          url: cleanUrl,
          source: '搜狗搜索',
          summary: cleanHtml(summary).substring(0, 300),
          published_at: null,
        });
      }
    });

    console.log(`[Crawler] 搜狗 for "${keyword}" => ${results.length} results`);
  } catch (err) {
    console.error(`[Crawler] 搜狗 error for "${keyword}":`, err.message);
  }

  return results;
}

/**
 * Bilibili 搜索（免费 API，无需 Key）
 * 文档: https://api.bilibili.com/x/web-interface/search/type
 */
async function searchBilibili(keyword) {
  const results = [];
  const query = encodeURIComponent(keyword);
  const url = `https://api.bilibili.com/x/web-interface/search/type?search_type=video&keyword=${query}&order=new`;

  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://search.bilibili.com/all?keyword=' + query,
        'Origin': 'https://search.bilibili.com',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Cookie': 'buvid3=local; b_nut=1700000000; _uuid=local',
      },
      timeout: 10000,
    });

    const data = response.data;
    if (data.code !== 0) {
      console.warn(`[Crawler] Bilibili API error: code=${data.code}, msg=${data.message}`);
      // API 失败 → 尝试 HTML 降级
      return searchBilibiliHtml(keyword);
    }

    const videos = (data.data && data.data.result) || [];
    for (const video of videos) {
      if (results.length >= 3) break;
      results.push({
        title: cleanHtml(video.title || '').substring(0, 120),
        url: `https://www.bilibili.com/video/${video.bvid || video.aid}`,
        source: 'Bilibili',
        summary: cleanHtml(video.description || video.tag || video.title || '').substring(0, 300),
        published_at: video.pubdate ? new Date(video.pubdate * 1000).toISOString() : new Date().toISOString(),
      });
    }

    console.log(`[Crawler] Bilibili for "${keyword}" => ${results.length} results`);
  } catch (err) {
    console.error(`[Crawler] Bilibili error for "${keyword}":`, err.message);
    // 请求失败 → 尝试 HTML 降级
    const htmlResults = await searchBilibiliHtml(keyword);
    results.push(...htmlResults);
  }

  return results;
}

/**
 * Bilibili HTML 搜索降级（当 API 不可用时直接爬搜索页）
 */
async function searchBilibiliHtml(keyword) {
  const results = [];
  const query = encodeURIComponent(keyword);
  const url = `https://search.bilibili.com/all?keyword=${query}&order=pubdate`;

  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://www.bilibili.com',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Cookie': 'buvid3=local; b_nut=1700000000; _uuid=local',
      },
      timeout: 15000,
    });

    const $ = cheerio.load(response.data);
    const items = $('.video-list .bili-video-card, .bili-video-list .video-item, .search-content .video-list-item');

    items.each((i, el) => {
      if (i >= 3) return false;

      const titleEl = $(el).find('.bili-video-card__info__tit, .video-title a, .info .title a');
      const title = titleEl.text().trim();
      const link = titleEl.attr('href') || '';
      const href = link.startsWith('http') ? link : `https:${link}`;
      const desc = $(el).find('.bili-video-card__info__author, .up-name, .des').text().trim();

      if (title && href) {
        results.push({
          title: cleanHtml(title).substring(0, 120),
          url: href,
          source: 'Bilibili',
          summary: cleanHtml(desc).substring(0, 300),
          published_at: new Date().toISOString(),
        });
      }
    });

    console.log(`[Crawler] Bilibili HTML "${keyword}" => ${results.length} results`);
  } catch (err) {
    console.error(`[Crawler] Bilibili HTML error:`, err.message);
  }

  return results;
}

/**
 * HackerNews 搜索（通过 Algolia API，免费、无需 Key）
 * 文档: https://hn.algolia.com/api
 */
async function searchHackerNews(keyword) {
  const results = [];
  const query = encodeURIComponent(keyword);
  const url = `https://hn.algolia.com/api/v1/search?query=${query}&tags=story&hitsPerPage=7`;

  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      },
      timeout: 15000,
    });

    const hits = response.data.hits || [];
    for (const hit of hits) {
      if (!hit.title) continue;

      results.push({
        title: cleanHtml(hit.title).substring(0, 120),
        url: hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`,
        source: 'HackerNews',
        summary: cleanHtml(hit.story_text || hit.comment_text || '').substring(0, 300)
                || `Points: ${hit.points || 0} | Comments: ${hit.num_comments || 0}`,
        published_at: hit.created_at || new Date().toISOString(),
      });
    }

    console.log(`[Crawler] HackerNews for "${keyword}" => ${results.length} results`);
  } catch (err) {
    console.error(`[Crawler] HackerNews error for "${keyword}":`, err.message);
  }

  return results;
}

/**
 * Google News RSS 搜索（免费，全球覆盖）
 */
async function searchGoogleNews(keyword) {
  const results = [];
  const query = encodeURIComponent(keyword);
  // 去掉 gl=CN 参数，避免在某些网络环境下被阻断
  const url = `https://news.google.com/rss/search?q=${query}&hl=en-US`;

  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/rss+xml, application/xml, text/xml',
        'Accept-Language': 'zh-CN,zh;q=0.9',
      },
      timeout: 8000,
    });

    const $ = cheerio.load(response.data, { xmlMode: true });
    const items = $('item');

    items.each((i, el) => {
      if (i >= config.crawler.maxResultsPerSource) return false;
      const title = $(el).find('title').text().trim();
      const link = $(el).find('link').text().trim();
      const pubDate = $(el).find('pubDate').text().trim();
      const description = $(el).find('description').text().trim();
      const sourceName = $(el).find('source').attr('url') || $(el).find('source').text().trim() || 'Google News';

      if (title && link) {
        results.push({
          title: cleanHtml(title).replace(/\s*-\s*[^-]+$/, ''),
          url: link,
          source: typeof sourceName === 'string' && sourceName.length < 30 ? sourceName : 'Google News',
          summary: cleanHtml(description).substring(0, 300),
          published_at: pubDate ? new Date(pubDate).toISOString() : null,
        });
      }
    });

    console.log(`[Crawler] Google News for "${keyword}" => ${results.length} results`);
  } catch (err) {
    console.error(`[Crawler] Google News error for "${keyword}":`, err.message);
  }

  return results;
}

/**
 * 综合多源爬取（支持 Query Expansion）
 * @param {string} keyword - 原始关键词
 * @param {string} category - 分类
 * @param {string} keywordType - person/organization/topic
 * @param {Object} [expansions] - 扩展搜索词（可选）
 * @param {string[]} [expansions.chinese] - 中文扩展词
 * @param {string[]} [expansions.english] - 英文扩展词
 */
async function crawlAllSources(keyword, category = 'general', keywordType = 'topic', expansions = null) {
  const allResults = [];
  const sources = config.crawler.sources || ['web', 'twitter'];

  // 检测关键词主要语言：英文关键词不扩展为中文搜索
  const isEnglish = /^[a-zA-Z0-9\s\-_.+]+$/.test(keyword.trim());

  // 为不同语言源分配搜索词
  const cnQueries = expansions?.chinese?.length && !isEnglish
    ? [keyword, ...expansions.chinese]
    : [keyword];
  const enQueries = expansions?.english?.length
    ? [keyword, ...expansions.english]
    : [keyword];

  const tasks = [];
  // 英文关键词：所有源统一用英文扩展，避免中文翻译曲解原意
  const webQueries = isEnglish ? enQueries : cnQueries;
  const newsQueries = enQueries;

  if (sources.includes('web')) {
    for (const q of newsQueries) tasks.push(searchWeb(q));
    for (const q of newsQueries) tasks.push(searchBingNews(q));
    for (const q of webQueries) tasks.push(searchSogou(q));
    for (const q of newsQueries) tasks.push(searchGoogleNews(q));
  }
  if (sources.includes('twitter')) {
    for (const q of newsQueries) tasks.push(searchTwitter(q));
  }
  if (sources.includes('bilibili')) {
    for (const q of webQueries) tasks.push(searchBilibili(q));
    if (keywordType === 'person') {
      for (const q of webQueries) tasks.push(searchBilibiliForPerson(q));
    }
  }
  if (sources.includes('hackernews')) {
    for (const q of (expansions?.english?.length ? expansions.english : [keyword])) {
      tasks.push(searchHackerNews(q));
    }
  }
  if (sources.includes('gitee')) {
    for (const q of enQueries) tasks.push(searchGitee(q));
  }
  if (sources.includes('reddit')) {
    for (const q of enQueries) tasks.push(searchReddit(q));
  }
  if (sources.includes('oschina')) {
    for (const q of webQueries) tasks.push(searchOschina(q));
  }
  if (sources.includes('github')) {
    // GitHub Trending 不按关键词搜索，直接拉当日榜单
    tasks.push(searchGitHubTrending());
  }

  if (keywordType === 'organization') {
    for (const q of webQueries) tasks.push(searchOrgInfo(q));
  }

  const settled = await Promise.allSettled(tasks);
  for (const r of settled) {
    if (r.status === 'fulfilled') allResults.push(...r.value);
  }

  // URL 去重 + 来源自动修正
  const seen = new Set();
  const unique = allResults.filter(item => {
    if (!item.url || seen.has(item.url)) return false;
    seen.add(item.url);
    item.source = detectSourceByUrl(item.url, item.source);
    return true;
  });

  // 按源设置上限：控制不可信时间源的占比
  const sourceLimits = config.crawler.sourceMaxResults || {};
  const sourceCount = {};
  const capped = unique.filter(item => {
    const limit = sourceLimits[item.source];
    if (!limit) return true;
    sourceCount[item.source] = (sourceCount[item.source] || 0) + 1;
    return sourceCount[item.source] <= limit;
  });

  // 按发布时间倒序排列（最新优先），无时间戳的排末尾
  capped.sort((a, b) => {
    const ta = a.published_at ? new Date(a.published_at).getTime() : 0;
    const tb = b.published_at ? new Date(b.published_at).getTime() : 0;
    return tb - ta;
  });

  await sleep(config.crawler.requestDelay);
  return capped;
}

/**
 * 根据 URL 域名自动修正信息来源
 */
function detectSourceByUrl(url, defaultSource) {
  if (!url) return defaultSource;
  try {
    const host = new URL(url).hostname;
    if (host.includes('bilibili.com')) return 'Bilibili';
    if (host.includes('zhihu.com')) return '知乎';
    if (host.includes('weibo.com')) return '微博';
    if (host.includes('github.com')) return 'GitHub';
    if (host.includes('twitter.com') || host.includes('x.com')) return 'Twitter/X';
    if (host.includes('ycombinator.com')) return 'HackerNews';
    if (host.includes('sogou.com')) return '搜狗搜索';
  } catch {}
  return defaultSource;
}

function cleanHtml(html) {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 按发布时间过滤旧数据
 * @param {Array} results - 搜索结果
 * @param {number} maxAgeHours - 保留 N 小时内，0=不限
 * @returns {Array} 过滤后的结果
 */
function filterByAge(results, maxAgeHours) {
  if (!maxAgeHours || maxAgeHours <= 0) return results;
  const cutoff = Date.now() - maxAgeHours * 3600000;
  return results.filter(item => {
    if (!item.published_at) return true; // 无时间戳的保留
    try {
      return new Date(item.published_at).getTime() >= cutoff;
    } catch {
      return true;
    }
  });
}

/**
 * 人物专题搜索：Bilibili 用户空间
 * 搜索 UP 主主页，获取简介 + 最新视频
 */
async function searchBilibiliForPerson(keyword) {
  const results = [];
  const query = encodeURIComponent(keyword);
  const url = `https://api.bilibili.com/x/web-interface/search/type?search_type=bili_user&keyword=${query}`;

  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://search.bilibili.com/all?keyword=' + query,
        'Origin': 'https://search.bilibili.com',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Cookie': 'buvid3=local; b_nut=1700000000; _uuid=local',
      },
      timeout: 10000,
    });

    const data = response.data;
    if (data.code !== 0) {
      console.warn(`[Crawler] Bilibili 人物API error: code=${data.code}`);
      return searchBilibiliForPersonHtml(keyword);
    }

    const users = (data.data && data.data.result) || [];
    for (const user of users.slice(0, 2)) {
      results.push({
        title: `${user.uname} - Bilibili UP主`,
        url: `https://space.bilibili.com/${user.mid}`,
        source: 'Bilibili',
        summary: `简介: ${user.usign || '无'} | 粉丝: ${(user.fans || 0).toLocaleString()} | 视频: ${(user.videos || 0).toLocaleString()}`,
        published_at: new Date().toISOString(),
      });

      // 同时获取该 UP 主的最新视频
      const videoResults = await searchBilibiliSpaceVideos(user.mid);
      results.push(...videoResults);
    }

    console.log(`[Crawler] Bilibili 人物搜索 "${keyword}" => ${results.length} 条结果（含最新视频）`);
  } catch (err) {
    console.error(`[Crawler] Bilibili 人物搜索 error:`, err.message);
    const htmlResults = await searchBilibiliForPersonHtml(keyword);
    results.push(...htmlResults);
  }

  return results;
}

/**
 * 获取 Bilibili UP 主空间最新视频
 * @param {number} mid - UP 主的 mid
 * @returns {Array} 最新视频列表
 */
async function searchBilibiliSpaceVideos(mid) {
  const results = [];
  if (!mid) return results;
  const url = `https://api.bilibili.com/x/space/arc/search?mid=${mid}&ps=5&pn=1`;

  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': `https://space.bilibili.com/${mid}`,
        'Origin': 'https://space.bilibili.com',
        'Accept': 'application/json, text/plain, */*',
        'Cookie': 'buvid3=local; b_nut=1700000000; _uuid=local',
      },
      timeout: 10000,
    });

    const data = response.data;
    if (data.code !== 0 || !data.data?.list?.vlist) {
      console.warn(`[Crawler] Bilibili space API error: code=${data.code}`);
      return results;
    }

    const videos = data.data.list.vlist.slice(0, 5);
    for (const video of videos) {
      results.push({
        title: cleanHtml(video.title || '').substring(0, 120),
        url: `https://www.bilibili.com/video/${video.bvid}`,
        source: 'Bilibili',
        summary: cleanHtml(video.description || '').substring(0, 300) ||
                 `播放: ${(video.play || 0).toLocaleString()} | 弹幕: ${(video.video_review || 0).toLocaleString()}`,
        published_at: video.created ? new Date(video.created * 1000).toISOString() : new Date().toISOString(),
      });
    }
  } catch (err) {
    console.error(`[Crawler] Bilibili space videos error:`, err.message);
  }

  return results;
}

/**
 * Bilibili 用户搜索 HTML 降级
 */
async function searchBilibiliForPersonHtml(keyword) {
  const results = [];
  const query = encodeURIComponent(keyword);
  const url = `https://search.bilibili.com/upuser?keyword=${query}`;

  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://www.bilibili.com',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'zh-CN,zh;q=0.9',
        'Cookie': 'buvid3=local; b_nut=1700000000; _uuid=local',
      },
      timeout: 15000,
    });

    const $ = cheerio.load(response.data);
    const items = $('.user-card, .bili-user-card, .user-item');

    items.each((i, el) => {
      if (i >= 3) return false;
      const nameEl = $(el).find('.user-name a, .name a, .title a');
      const name = nameEl.text().trim();
      const link = nameEl.attr('href') || '';
      const fans = $(el).find('.user-fans, .fans').text().trim();
      const desc = $(el).find('.user-desc, .desc, .sign').text().trim();
      const href = link.startsWith('http') ? link : `https:${link}`;

      if (name && href) {
        results.push({
          title: `${name} - Bilibili UP主`,
          url: href,
          source: 'Bilibili',
          summary: `${fans ? '粉丝: ' + fans : ''} ${desc ? '简介: ' + desc : ''}`.trim(),
          published_at: new Date().toISOString(),
        });
      }
    });

    console.log(`[Crawler] Bilibili 人物HTML搜索 "${keyword}" => ${results.length} 个用户`);
  } catch (err) {
    console.error(`[Crawler] Bilibili 人物HTML搜索 error:`, err.message);
  }

  return results;
}

/**
 * 组织/品牌专题搜索：直接搜索官网 + 百科信息
 */
async function searchOrgInfo(keyword) {
  const results = [];
  // 优先用搜狗搜索的百科信息
  const sogouResults = await searchBaiduBaike(keyword);
  results.push(...sogouResults);
  console.log(`[Crawler] 组织搜索 "${keyword}" => ${results.length} 条`);
  return results;
}

/**
 * 百度百科搜索（通过搜狗间接访问）
 */
async function searchBaiduBaike(keyword) {
  const results = [];
  const query = encodeURIComponent(keyword);
  const url = `https://www.sogou.com/web?query=${query}+百科`;

  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html',
        'Accept-Language': 'zh-CN,zh;q=0.9',
      },
      timeout: 10000,
    });

    const $ = cheerio.load(response.data);
    const baikeLinks = $('a[href*="baike.sogou.com"], a[href*="baike.baidu.com"]');

    baikeLinks.each((i, el) => {
      if (i >= 2) return false;
      const $el = $(el);
      const title = $el.text().trim();
      let link = $el.attr('href') || '';
      link = normalizeUrl(link, '搜狗搜索');

      if (title && link && link.startsWith('http')) {
        results.push({
          title: `${keyword} - 百科资料`,
          url: link,
          source: '百科',
          summary: `官方网站/百科信息: ${title}`,
          published_at: new Date().toISOString(),
        });
      }
    });

    console.log(`[Crawler] 百科搜索 "${keyword}" => ${results.length} 条`);
  } catch (err) {
    console.error(`[Crawler] 百科搜索 error:`, err.message);
  }

  return results;
}

/**
 * Gitee 搜索（免费 OpenAPI，无需 Key）
 * 文档: https://gitee.com/api/v5/swagger
 */
async function searchGitee(keyword) {
  const results = [];
  const query = encodeURIComponent(keyword);
  const url = `https://gitee.com/api/v5/search/repositories?q=${query}&sort=stars&order=desc&per_page=5`;

  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      },
      timeout: 10000,
    });

    const repos = (response.data || []).slice(0, 5);
    for (const repo of repos) {
      if (!repo.full_name) continue;
      results.push({
        title: `${repo.full_name}${repo.language ? ` [${repo.language}]` : ''}`,
        url: repo.html_url || '#',
        source: 'Gitee',
        summary: cleanHtml(repo.description || '').substring(0, 300)
                 || `Stars: ${repo.stargazers_count || 0} | Forks: ${repo.forks_count || 0}`,
        published_at: repo.updated_at || null,
      });
    }

    console.log(`[Crawler] Gitee for "${keyword}" => ${results.length} results`);
  } catch (err) {
    console.error(`[Crawler] Gitee error:`, err.message);
  }

  return results;
}

/**
 * Reddit 搜索（JSON feed，免费）
 */
async function searchReddit(keyword) {
  const results = [];
  const query = encodeURIComponent(keyword);
  const url = `https://www.reddit.com/search.json?q=${query}&sort=new&limit=7`;

  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      },
      timeout: 10000,
    });

    const posts = response.data?.data?.children || [];
    for (const post of posts.slice(0, 7)) {
      const d = post.data;
      if (!d.title) continue;
      results.push({
        title: cleanHtml(d.title).substring(0, 120),
        url: `https://www.reddit.com${d.permalink || ''}`,
        source: 'Reddit',
        summary: cleanHtml(d.selftext || '').substring(0, 300)
                 || `Subreddit: r/${d.subreddit || 'unknown'} | Upvotes: ${d.ups || 0} | Comments: ${d.num_comments || 0}`,
        published_at: d.created_utc ? new Date(d.created_utc * 1000).toISOString() : null,
      });
    }

    console.log(`[Crawler] Reddit for "${keyword}" => ${results.length} results`);
  } catch (err) {
    console.error(`[Crawler] Reddit error:`, err.message);
  }

  return results;
}

/**
 * 开源中国搜索（HTML 抓取）
 */
async function searchOschina(keyword) {
  const results = [];
  const query = encodeURIComponent(keyword);
  const url = `https://www.oschina.net/search?q=${query}&scope=news`;

  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'zh-CN,zh;q=0.9',
        'Referer': 'https://www.oschina.net',
      },
      timeout: 10000,
    });

    const $ = cheerio.load(response.data);

    // 新闻/问答/博客列表
    const items = $('.item, .search-item, .blog-item, .news-item');
    if (items.length > 0) {
      items.each((i, el) => {
        if (i >= config.crawler.maxResultsPerSource) return false;
        const titleEl = $(el).find('a.title, .header a, h3 a').first();
        const title = titleEl.text().trim();
        const link = titleEl.attr('href') || '';
        const desc = $(el).find('.description, .abstract, p').first().text().trim();

        if (title && link) {
          results.push({
            title: cleanHtml(title),
            url: link.startsWith('http') ? link : `https://www.oschina.net${link}`,
            source: '开源中国',
            summary: cleanHtml(desc).substring(0, 300),
            published_at: null,
          });
        }
      });
    }

    console.log(`[Crawler] 开源中国 for "${keyword}" => ${results.length} results`);
  } catch (err) {
    console.error(`[Crawler] 开源中国 error:`, err.message);
  }

  return results;
}

/**
 * GitHub Trending（HTML 抓取，免费）
 */
async function searchGitHubTrending() {
  const results = [];
  const url = 'https://github.com/trending';

  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      },
      timeout: 10000,
    });

    const $ = cheerio.load(response.data);
    const repos = $('article.Box-row');

    repos.each((i, el) => {
      if (i >= 5) return false;
      const titleEl = $(el).find('h2 a');
      const title = titleEl.text().trim().replace(/\s+/g, ' ');
      const link = titleEl.attr('href') || '';
      const desc = $(el).find('p').first().text().trim();
      const lang = $(el).find('[itemprop="programmingLanguage"]').text().trim();

      if (title && link) {
        results.push({
          title: `${title}${lang ? ` [${lang}]` : ''}`,
          url: `https://github.com${link}`,
          source: 'GitHub Trending',
          summary: cleanHtml(desc).substring(0, 300),
          published_at: new Date().toISOString(), // Trending 是当日榜单
        });
      }
    });

    console.log(`[Crawler] GitHub Trending => ${results.length} results`);
  } catch (err) {
    console.error(`[Crawler] GitHub Trending error:`, err.message);
  }

  return results;
}

module.exports = {
  crawlAllSources,
  searchWeb,
  searchTwitter,
  searchBingNews,
  searchSogou,
  searchBilibili,
  searchHackerNews,
  searchGoogleNews,
  searchBilibiliForPerson,
  searchOrgInfo,
  searchGitee,
  searchReddit,
  searchOschina,
  searchGitHubTrending,
};
