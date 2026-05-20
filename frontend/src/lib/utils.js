import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

/**
 * 对搜索引擎来源的 URL 做规范化，确保跳转有效。
 * 兜底处理后端未及时修复的脏数据。
 */
export function normalizeUrl(rawUrl, source) {
  if (!rawUrl) return '#';
  let url = rawUrl.trim();

  // DuckDuckGo 重定向解密
  if (url.startsWith('/l/?uddg=')) {
    try { url = decodeURIComponent(url.replace('/l/?uddg=', '')); } catch {}
  }
  // 搜狗相对路径 → 补全为绝对 URL
  else if (url.startsWith('/link?url=')) {
    url = 'https://www.sogou.com' + url;
  }
  // 其他相对路径 → 根据来源补全
  else if (url.startsWith('/') && source === 'DuckDuckGo') {
    url = 'https://duckduckgo.com' + url;
  }

  // 仍然无效的给 fallback
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return '#';
  }

  return url;
}
