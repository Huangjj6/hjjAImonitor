require('dotenv').config();

module.exports = {
  // OpenRouter
  openrouter: {
    apiKey: process.env.OPENROUTER_API_KEY || '',
    model: process.env.OPENROUTER_MODEL || 'deepseek/deepseek-v3.2',
    baseUrl: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
  },

  // Twitter API
  twitter: {
    apiKey: process.env.TWITTER_API_KEY || '',
    baseUrl: process.env.TWITTER_API_BASE || 'https://api.twitterapi.io',
  },

  // Email
  email: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    to: process.env.NOTIFICATION_EMAIL || '',
  },

  // Server
  port: parseInt(process.env.PORT || '3001'),

  // Crawler settings
  crawler: {
    intervalMinutes: 10,       // 爬取间隔（分钟）
    maxResultsPerSource: 8,    // 每个源每次请求最大结果数
    requestDelay: 2000,        // 请求间延迟（ms）
    maxAgeHours: 720,          // 默认保留 30 天内的结果，超旧内容直接过滤
    sources: ['web', 'twitter', 'bilibili', 'hackernews', 'gitee', 'reddit', 'oschina', 'github'],
    sourceMaxResults: {         // 按源限制最终入库上限（覆盖 maxResultsPerSource）
      '搜狗搜索': 3,            // 搜狗无发布时间，降低权重避免旧文章占太多
    },
    excludeDomains: [            // 百科类域名，URL 匹配即过滤
      'baike.baidu.com',
      'baike.sogou.com',
      'baike.so.com',
      'wikipedia.org',
      'zh.wikipedia.org',
      'en.wikipedia.org',
      'wiki.mbalib.com',
    ],
    excludeTitlePatterns: [      // 标题含这些关键词也过滤
      '百科',
      'baike',
      '简介',
      '个人资料',
      '维基百科',
      '互动百科',
    ],
  },

  // AI 相关性审核
  relevance: {
    minSaveScore: 0.4,         // 低于此分不入库
    notifyScore: 0.6,          // 高于此分触发通知
    titleKeywordBonus: 0.15,   // 关键词原词命中标题加分
  },

  // Pre-filter：AI 调用前置过滤
  preFilter: {
    enabled: true,             // 是否启用多层预过滤
    scoreOnMiss: 0.05,         // 预过滤未命中时的默认分
    confidenceOnMiss: 0.95,    // 预过滤未命中时的确信度
  },

  // Query Expansion：搜索词扩展
  queryExpansion: {
    enabled: true,             // 是否启用搜索词扩展
    maxExpansionsPerSource: 2, // 每个源最多扩展词数
  },

  // 来源可信度加权（Tier 1 最高）
  sourceCredibility: {
    official:  { tier: 1, weight: 1.00, label: '官方媒体', domains: ['gov.cn', 'xinhuanet.com', 'people.com.cn', 'cctv.com', 'bbc.com', 'reuters.com', 'ap.org', 'bloomberg.com'] },
    media:     { tier: 2, weight: 0.95, label: '知名媒体', domains: ['36kr.com', 'ifeng.com', 'sina.com.cn', 'qq.com', 'sohu.com', 'thepaper.cn', 'ft.com', 'wsj.com', 'techcrunch.com', 'theverge.com', 'wired.com'] },
    blog:      { tier: 3, weight: 0.90, label: '知名博客', domains: ['zhihu.com', 'juejin.cn', 'csdn.net', 'cnblogs.com', 'medium.com', 'weixin.qq.com', 'mp.weixin.qq.com', 'segmentfault.com', 'v2ex.com', 'github.com'] },
    social:    { tier: 4, weight: 0.85, label: '社交媒体', domains: ['bilibili.com', 'weibo.com', 'twitter.com', 'x.com', 'douyin.com', 'reddit.com', 'tieba.baidu.com', 'xiaohongshu.com'] },
    unknown:   { tier: 5, weight: 0.80, label: '未知来源' },
  },
};
