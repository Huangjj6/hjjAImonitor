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
    maxResultsPerSource: 5,    // 每个源最大结果数
    requestDelay: 2000,        // 请求间延迟（ms）
    sources: ['web', 'twitter', 'bilibili', 'hackernews'], // 启用的信息源: web(DuckDuckGo+Bing+搜狗+Google), twitter, bilibili, hackernews
  },
};
