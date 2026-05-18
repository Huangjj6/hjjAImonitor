const axios = require('axios');
const cheerio = require('cheerio');
const config = require('../config');

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
      timeout: 15000,
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
        results.push({
          title: cleanHtml(title),
          url: link,
          source: 'DuckDuckGo',
          summary: cleanHtml(summary).substring(0, 300),
          published_at: new Date().toISOString(),
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
 * Bing News RSS 搜索
 */
async function searchBingNews(keyword) {
  const results = [];
  const query = encodeURIComponent(keyword);
  const searchUrl = `https://www.bing.com/news/search?q=${query}&format=rss`;

  try {
    const response = await axios.get(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/rss+xml, application/xml, text/xml',
        'Accept-Language': 'zh-CN,zh;q=0.9',
      },
      timeout: 15000,
    });

    const $ = cheerio.load(response.data, { xmlMode: true });
    const items = $('item');

    items.each((i, el) => {
      if (i >= config.crawler.maxResultsPerSource) return false;
      const title = $(el).find('title').text().trim();
      const link = $(el).find('link').text().trim();
      const pubDate = $(el).find('pubDate').text().trim();
      const description = $(el).find('description').text().trim();

      if (title && link) {
        results.push({
          title: cleanHtml(title),
          url: link,
          source: 'Bing News',
          summary: cleanHtml(description).substring(0, 300),
          published_at: pubDate ? new Date(pubDate).toISOString() : null,
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
    const resultsList = $('.results .vrwrap, .results .rb');

    resultsList.each((i, el) => {
      if (i >= config.crawler.maxResultsPerSource) return false;
      const titleEl = $(el).find('.vr-title a, .pt');
      const title = titleEl.text().trim();
      const link = titleEl.attr('href') || '';
      const summary = $(el).find('.star-wiki, .str-text, .space-txt, .str_info_div, .fb-hint').text().trim()
                    || $(el).find('.abstract, .str-text').text().trim();

      if (title && link && !link.startsWith('javascript')) {
        results.push({
          title: cleanHtml(title),
          url: link,
          source: '搜狗搜索',
          summary: cleanHtml(summary).substring(0, 300),
          published_at: new Date().toISOString(),
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
        'Referer': 'https://www.bilibili.com',
        'Accept-Language': 'zh-CN,zh;q=0.9',
      },
      timeout: 15000,
    });

    const data = response.data;
    if (data.code !== 0) {
      console.warn(`[Crawler] Bilibili API error: code=${data.code}, msg=${data.message}`);
      return results;
    }

    const videos = (data.data && data.data.result) || [];
    for (const video of videos) {
      if (results.length >= config.crawler.maxResultsPerSource) break;

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
  const url = `https://hn.algolia.com/api/v1/search?query=${query}&tags=story&hitsPerPage=${config.crawler.maxResultsPerSource}`;

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
  const url = `https://news.google.com/rss/search?q=${query}&hl=zh-CN&gl=CN&ceid=CN:zh-Hans`;

  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/rss+xml, application/xml, text/xml',
        'Accept-Language': 'zh-CN,zh;q=0.9',
      },
      timeout: 15000,
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
 * 综合多源爬取
 */
async function crawlAllSources(keyword, category = 'general') {
  const allResults = [];
  const sources = config.crawler.sources || ['web', 'twitter'];

  const tasks = [];
  if (sources.includes('web')) {
    tasks.push(searchWeb(keyword));          // DuckDuckGo
    tasks.push(searchBingNews(keyword));     // Bing News
    tasks.push(searchSogou(keyword));        // 搜狗搜索
    tasks.push(searchGoogleNews(keyword));   // Google News
  }
  if (sources.includes('twitter')) {
    tasks.push(searchTwitter(keyword));
  }
  if (sources.includes('bilibili')) {
    tasks.push(searchBilibili(keyword));
  }
  if (sources.includes('hackernews')) {
    tasks.push(searchHackerNews(keyword));
  }

  const settled = await Promise.allSettled(tasks);
  for (const r of settled) {
    if (r.status === 'fulfilled') allResults.push(...r.value);
  }

  // URL 去重
  const seen = new Set();
  const unique = allResults.filter(item => {
    if (!item.url || seen.has(item.url)) return false;
    seen.add(item.url);
    return true;
  });

  await sleep(config.crawler.requestDelay);
  return unique;
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

module.exports = {
  crawlAllSources,
  searchWeb,
  searchTwitter,
  searchBingNews,
  searchSogou,
  searchBilibili,
  searchHackerNews,
  searchGoogleNews,
};
