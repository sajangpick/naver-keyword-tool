const axios = require('axios');
const { JSDOM } = require('jsdom');
const iconv = require('iconv-lite');

const SECTION_MAP = {
  social: { id: '102', label: '사회' },
  economy: { id: '101', label: '경제' },
};

const MAX_ITEMS = Number(process.env.NAVER_SECTION_ITEMS_LIMIT || 8);
const CACHE_TTL = Number(process.env.NAVER_SECTION_CACHE_TTL_MS || 5 * 60 * 1000);

const REQUEST_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  Referer: 'https://news.naver.com/',
  'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
};

const CANDIDATE_SELECTORS = [
  'div.section_headline ul li',
  'ul.sa_list li',
  'div.section_list ul li',
  'div.cluster_group._cluster_content ul li',
  'div.section_latest_article_list ul li',
];

const cache = {};

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: '지원하지 않는 메서드입니다.' });
  }

  try {
    const sectionKeys = Object.keys(SECTION_MAP);
    const results = await Promise.all(sectionKeys.map((key) => fetchSection(key)));

    const payload = {};
    let latestFetchedAt = 0;

    sectionKeys.forEach((key, index) => {
      const { items, fetchedAt } = results[index];
      payload[key] = items;
      if (fetchedAt > latestFetchedAt) {
        latestFetchedAt = fetchedAt;
      }
    });

    return res.status(200).json({
      success: true,
      data: payload,
      fetchedAt: latestFetchedAt || Date.now(),
    });
  } catch (error) {
    console.error('[naver-section-news] 처리 중 오류:', error);
    return res.status(500).json({
      success: false,
      error: '네이버 뉴스를 불러오지 못했습니다.',
    });
  }
};

async function fetchSection(sectionKey) {
  const cached = cache[sectionKey];
  const now = Date.now();

  if (cached && now - cached.fetchedAt < CACHE_TTL) {
    return cached;
  }

  const section = SECTION_MAP[sectionKey];
  if (!section) {
    return { items: [], fetchedAt: now };
  }

  const url = `https://news.naver.com/section/${section.id}`;

  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 8000,
      headers: REQUEST_HEADERS,
    });

    const html = iconv.decode(Buffer.from(response.data), 'utf8');
    const dom = new JSDOM(html);
    const document = dom.window.document;
    const items = [];
    const seenTitles = new Set();

    document.querySelectorAll(CANDIDATE_SELECTORS.join(',')).forEach((node) => {
      if (items.length >= MAX_ITEMS) {
        return;
      }

      const anchor =
        node.querySelector('a.sa_text_title') ||
        node.querySelector('a.section_list_title') ||
        node.querySelector('a[href*="/mnews/"]') ||
        node.querySelector('a[href^="/article/"]');

      if (!anchor) {
        return;
      }

      const title = cleanText(anchor.textContent);
      if (!title || seenTitles.has(title)) {
        return;
      }

      seenTitles.add(title);

      const link = resolveLink(anchor.getAttribute('href'));
      const pressEl =
        node.querySelector('.sa_text_press') ||
        node.querySelector('.section_list_press') ||
        node.querySelector('.sa_item_info a') ||
        node.querySelector('.press');
      const summaryEl =
        node.querySelector('.sa_text_lede') ||
        node.querySelector('.section_list_lede') ||
        node.querySelector('.sa_text_summary') ||
        node.querySelector('.lede');
      const timeEl =
        node.querySelector('.sa_text_datetime') ||
        node.querySelector('.section_list_dt') ||
        node.querySelector('time');

      items.push({
        title,
        link,
        press: cleanText(pressEl && pressEl.textContent) || null,
        summary: cleanText(summaryEl && summaryEl.textContent) || null,
        publishedAt: cleanText(timeEl && timeEl.textContent) || null,
        modifiedAt: null,
        journalist: null,
        source: link,
      });
    });

    cache[sectionKey] = { items, fetchedAt: now };
    return cache[sectionKey];
  } catch (error) {
    console.error(`[naver-section-news] ${sectionKey} 섹션 파싱 실패:`, error.message);
    const fallback = { items: [], fetchedAt: now };
    cache[sectionKey] = fallback;
    return fallback;
  }
}

function resolveLink(rawHref = '') {
  const href = rawHref.trim();
  if (!href) return null;

  if (href.startsWith('//')) {
    return `https:${href}`;
  }

  if (href.startsWith('http')) {
    return href;
  }

  if (href.startsWith('/')) {
    return `https://news.naver.com${href}`;
  }

  if (href.startsWith('./')) {
    return `https://news.naver.com${href.slice(1)}`;
  }

  return `https://news.naver.com/${href}`;
}

function cleanText(value) {
  if (!value) return '';
  return String(value)
    .replace(/\s+/g, ' ')
    .replace(/\u00a0/g, ' ')
    .trim();
}

