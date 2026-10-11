import { config } from '../config/index.js';

/**
 * Common fetch helper with timing-safe Bearer token auth for FAZIX website API
 */
export async function fazixApi(path, options = {}) {
  const baseUrl = config.fazixApiUrl || 'http://localhost:3000';
  const secret = config.fazixApiSecret || 'fazix_dev_discord_bot_secret_2026';
  const url = `${baseUrl.replace(/\/+$/, '')}${path}`;

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${secret}`,
    ...(options.headers || {}),
  };

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    const data = await response.json().catch(() => null);
    return {
      status: response.status,
      ok: response.ok,
      data,
    };
  } catch (error) {
    return {
      status: 0,
      ok: false,
      data: { success: false, error: error.message || 'Connection failed' },
    };
  }
}

/**
 * Create or update the top banner streaming across the website
 */
export async function setWebsiteBanner({ text, link, priority = 'normal' }) {
  return await fazixApi('/api/news/ticker', {
    method: 'POST',
    body: JSON.stringify({
      action: 'set_ticker',
      text,
      link: link || '#news',
      priority,
      isActive: true,
    }),
  });
}

/**
 * Publish an article to the FAZIX website Latest News section
 */
export async function createWebsiteNews({
  title,
  summary,
  content,
  badge = 'NEWS',
  image,
  readTime,
  showOnBanner = false,
}) {
  return await fazixApi('/api/news', {
    method: 'POST',
    body: JSON.stringify({
      action: 'create_article',
      title,
      summary,
      content: content || summary || title,
      badge: (badge || 'NEWS').toUpperCase(),
      image,
      readTime,
      setTicker: Boolean(showOnBanner),
      tickerText: showOnBanner ? title : undefined,
    }),
  });
}

/**
 * Clear the top banner
 */
export async function clearWebsiteBanner() {
  return await fazixApi('/api/news/ticker', {
    method: 'DELETE',
  });
}
