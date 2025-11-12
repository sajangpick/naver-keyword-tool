const axios = require('axios');
const iconv = require('iconv-lite');
const { JSDOM } = require('jsdom');
const { Readability } = require('@mozilla/readability');

const DEFAULT_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
  'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
  'Cache-Control': 'no-cache',
  Pragma: 'no-cache',
  Referer: 'https://www.kihoilbo.co.kr/',
  'Sec-Fetch-Site': 'same-origin',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-User': '?1',
  'Sec-Fetch-Dest': 'document',
  'Accept-Encoding': 'gzip, deflate, br',
  'Upgrade-Insecure-Requests': '1',
  'sec-ch-ua': '"Chromium";v="128", "Not=A?Brand";v="24", "Google Chrome";v="128"',
  'sec-ch-ua-platform': '"Windows"',
  'sec-ch-ua-mobile': '?0',
};

const ARTICLE_SELECTORS = [
  'article',
  '#articleBody',
  '#articeBody',
  '#newsEndContents',
  '#news_body_area',
  '.article_body',
  '.articleBody',
  '.news_body',
  '.article-text',
  '.articleView',
  '.article-view',
  '.article-view-content',
  '#article-view-content',
  '#article-view-content-div',
  '.article-veiw-body',
  'div[itemprop="articleBody"]',
  '.articleViewWrap',
  '.artText',
  '.article_txt',
  '.article_content',
  '.article-content',
  '.articleText',
  '.view-content',
  '.view_cont',
  '.view_con',
  '.post-view',
  '.entry-content',
  '.board_con',
  '.news-article',
  '.news_article',
  '.txt',
  '.text',
  '#content',
  '.content',
];

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: '지원하지 않는 메서드입니다.' });
  }

  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ success: false, error: 'url 파라미터가 필요합니다.' });
  }

  let targetUrl;
  try {
    targetUrl = new URL(url);
  } catch (error) {
    return res.status(400).json({ success: false, error: '유효한 URL이 아닙니다.' });
  }

  try {
    const { html, finalUrl } = await fetchArticleHtml(targetUrl.toString());
    const { articleHtml, plainText, rawHtml, rawText, title, byline, excerpt, imageUrl } = parseArticle(html, finalUrl);

    if (!articleHtml) {
      throw new Error('본문을 추출할 수 없습니다.');
    }

    return res.status(200).json({
      success: true,
      data: {
        title,
        byline,
        excerpt,
        content: articleHtml,
        text: plainText,
        rawHtml,
        rawText,
        imageUrl,
        wordCount: countWords(plainText || rawText),
        sourceUrl: finalUrl,
        rawPage: html,
        fetchedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[news-fetch] 원문 추출 실패:', {
      message: error.message,
      url: targetUrl.toString(),
    });

    return res.status(500).json({
      success: false,
      error: '뉴스 원문을 불러오는데 실패했습니다.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

async function fetchArticleHtml(url) {
  const origin = (() => {
    try {
      return new URL(url).origin;
    } catch (error) {
      return undefined;
    }
  })();

  const headers = {
    ...DEFAULT_HEADERS,
    Referer: origin ? `${origin}/` : DEFAULT_HEADERS.Referer,
    Origin: origin || DEFAULT_HEADERS.Referer,
    Host: (() => {
      try {
        return new URL(url).host;
      } catch (error) {
        return undefined;
      }
    })(),
  };

  const response = await axios.get(url, {
    responseType: 'arraybuffer',
    headers,
    timeout: 10000,
    maxRedirects: 5,
    validateStatus: (status) => status >= 200 && status < 400,
  });

  const buffer = Buffer.from(response.data);
  const encoding = detectEncoding(response.headers, buffer);
  const html = iconv.decode(buffer, encoding);
  const finalUrl = response.request?.res?.responseUrl || url;

  return { html, finalUrl };
}

function detectEncoding(headers, buffer) {
  const contentType = headers['content-type'] || headers['Content-Type'];

  if (contentType) {
    const match = contentType.match(/charset=([^;]+)/i);
    if (match && iconv.encodingExists(match[1].trim())) {
      return normalizeEncoding(match[1].trim());
    }
  }

  const head = buffer.toString('ascii', 0, 2048);
  const metaMatch = head.match(/charset=["']?([^"'>\s]+)/i);
  if (metaMatch && iconv.encodingExists(metaMatch[1].trim())) {
    return normalizeEncoding(metaMatch[1].trim());
  }

  return 'utf-8';
}

function normalizeEncoding(value) {
  const lower = value.toLowerCase();
  if (lower === 'euc-kr' || lower === 'ks_c_5601-1987') return 'euc-kr';
  if (lower === 'utf8') return 'utf-8';
  return lower;
}

function parseArticle(html, baseUrl) {
  const dom = new JSDOM(html, { url: baseUrl, pretendToBeVisual: true });
  const { document } = dom.window;

  removeUnwantedNodes(document);

  // 이미지 추출 (메타 태그 우선, 그 다음 본문)
  const imageUrl = extractImageUrl(document, baseUrl);

  const reader = new Readability(document);
  const article = reader.parse();

  if (article && article.content) {
    const normalized = normalizeContent(article.content, baseUrl);
    return {
      articleHtml: normalized.html,
      plainText: normalized.text,
      rawHtml: normalized.rawHtml,
      rawText: normalized.rawText,
      title: article.title || document.title || '',
      byline: article.byline || '',
      excerpt: article.excerpt || '',
      imageUrl: imageUrl || normalized.imageUrl || null,
    };
  }

  // Readability가 실패한 경우 수동 추출
  const fallback = fallbackExtract(document, baseUrl);
  return {
    articleHtml: fallback.html,
    plainText: fallback.text,
    rawHtml: fallback.rawHtml,
    rawText: fallback.rawText,
    title: document.title || '',
    byline: '',
    excerpt: fallback.text.slice(0, 200),
    imageUrl: imageUrl || fallback.imageUrl || null,
  };
}

function removeUnwantedNodes(document) {
  const selectors = [
    'script',
    'style',
    'noscript',
    'iframe',
    'header',
    'footer',
    'nav',
    'form',
    'aside',
    '.ad',
    '.advertisement',
    '.sns_area',
    '.share_area',
  ];

  selectors.forEach((selector) => {
    document.querySelectorAll(selector).forEach((node) => {
      try {
        node.remove();
      } catch (error) {
        // ignore
      }
    });
  });
}

function extractImageUrl(document, baseUrl) {
  // 1. Open Graph 이미지 메타 태그 확인
  const ogImage = document.querySelector('meta[property="og:image"]');
  if (ogImage) {
    const src = ogImage.getAttribute('content');
    if (src) {
      try {
        return new URL(src, baseUrl).toString();
      } catch (error) {
        // continue
      }
    }
  }

  // 2. Twitter 카드 이미지 확인
  const twitterImage = document.querySelector('meta[name="twitter:image"]');
  if (twitterImage) {
    const src = twitterImage.getAttribute('content');
    if (src) {
      try {
        return new URL(src, baseUrl).toString();
      } catch (error) {
        // continue
      }
    }
  }

  // 3. article 내부의 첫 번째 이미지 확인
  const article = document.querySelector('article');
  if (article) {
    const articleImg = article.querySelector('img');
    if (articleImg) {
      const src = articleImg.getAttribute('src') || articleImg.getAttribute('data-src');
      if (src) {
        try {
          const absoluteUrl = new URL(src, baseUrl).toString();
          // 광고나 아이콘 이미지는 제외 (작은 이미지나 특정 경로)
          if (!absoluteUrl.includes('icon') && !absoluteUrl.includes('logo') && !absoluteUrl.includes('ad')) {
            return absoluteUrl;
          }
        } catch (error) {
          // continue
        }
      }
    }
  }

  // 4. 본문 영역의 적절한 크기의 이미지 찾기
  const contentSelectors = [
    '#articleBody img',
    '.article_body img',
    '.articleBody img',
    '#news_body_area img',
    '.news_body img',
    'article img',
    'main img',
  ];

  for (const selector of contentSelectors) {
    const imgs = document.querySelectorAll(selector);
    for (const img of imgs) {
      const src = img.getAttribute('src') || img.getAttribute('data-src');
      if (src) {
        try {
          const absoluteUrl = new URL(src, baseUrl).toString();
          // 광고나 아이콘, 작은 이미지는 제외
          if (
            !absoluteUrl.includes('icon') &&
            !absoluteUrl.includes('logo') &&
            !absoluteUrl.includes('ad') &&
            !absoluteUrl.includes('banner') &&
            !absoluteUrl.includes('sponsor')
          ) {
            // 너비나 높이 속성이 있는 경우 크기 확인
            const width = img.getAttribute('width') || img.getAttribute('data-width');
            const height = img.getAttribute('height') || img.getAttribute('data-height');
            if (width && parseInt(width) > 200) {
              return absoluteUrl;
            }
            if (height && parseInt(height) > 200) {
              return absoluteUrl;
            }
            // 크기 정보가 없으면 일단 반환
            return absoluteUrl;
          }
        } catch (error) {
          // continue
        }
      }
    }
  }

  return null;
}

function normalizeContent(contentHtml, baseUrl) {
  const dom = new JSDOM(`<body>${contentHtml}</body>`, { url: baseUrl });
  const { document } = dom.window;
  let firstImageUrl = null;

  document.querySelectorAll('script, style, noscript, iframe, form').forEach((node) => node.remove());

  document.querySelectorAll('br').forEach((br) => {
    const newline = document.createTextNode('\n');
    br.replaceWith(newline);
  });

  document.querySelectorAll('img').forEach((img) => {
    const src = img.getAttribute('src') || img.getAttribute('data-src');
    if (!src) {
      img.remove();
      return;
    }

    try {
      const absoluteSrc = new URL(src, baseUrl).toString();
      img.setAttribute('src', absoluteSrc);
      img.removeAttribute('srcset');
      img.removeAttribute('data-src');
      
      // 첫 번째 적절한 이미지를 저장
      if (!firstImageUrl && !absoluteSrc.includes('icon') && !absoluteSrc.includes('logo') && !absoluteSrc.includes('ad')) {
        firstImageUrl = absoluteSrc;
      }
    } catch (error) {
      img.remove();
    }
  });

  document.querySelectorAll('a').forEach((anchor) => {
    const href = anchor.getAttribute('href');
    if (!href) {
      anchor.removeAttribute('href');
      return;
    }

    try {
      const absoluteHref = new URL(href, baseUrl).toString();
      anchor.setAttribute('href', absoluteHref);
      anchor.setAttribute('target', '_blank');
      anchor.setAttribute('rel', 'noopener');
    } catch (error) {
      anchor.removeAttribute('href');
    }
  });

  const paragraphs = Array.from(document.querySelectorAll('p'))
    .map((p) => p.textContent.replace(/\s+/g, ' ').trim())
    .filter((text) => text.length > 0);

  let plainText;
  if (paragraphs.length > 0) {
    plainText = paragraphs.join('\n\n');
  } else {
    const rawNodes = Array.from(document.body.childNodes)
      .map((node) => node.textContent)
      .filter(Boolean)
      .join('\n');
    plainText = rawNodes
      .replace(/\u00a0/g, ' ')
      .replace(/\r?\n+/g, '\n')
      .split('\n')
      .map((line) => line.replace(/\s+/g, ' ').trim())
      .filter((line) => line.length > 0)
      .join('\n\n');
  }

  const rawHtml = contentHtml || '';

  const rawText = document.body.textContent
    .replace(/\u00a0/g, ' ')
    .replace(/\r?\n+/g, '\n')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => line.length > 0)
    .join('\n\n');

  const cleanedHtml = document.body.innerHTML.trim();
  const htmlOutput = cleanedHtml || wrapPlainText(plainText) || rawHtml.trim();

  return {
    html: htmlOutput,
    text: plainText,
    rawHtml: rawHtml.trim(),
    rawText,
    imageUrl: firstImageUrl || null,
  };
}

function fallbackExtract(document, baseUrl) {
  for (const selector of ARTICLE_SELECTORS) {
    const node = document.querySelector(selector);
    if (node && node.textContent && node.textContent.trim().length > 60) {
      const normalized = normalizeContent(node.innerHTML, baseUrl);
      if (normalized.text.length > 0 || sanitizedLength(normalized.rawHtml) > 0) {
        return normalized;
      }
    }
  }

  const paragraphs = Array.from(document.querySelectorAll('p'))
    .map((p) => p.textContent.replace(/\s+/g, ' ').trim())
    .filter((text) => text.length > 0);

  const text = paragraphs.join('\n\n');
  return {
    html: wrapPlainText(text),
    text,
    rawHtml: document.body.innerHTML.trim(),
    rawText: text,
    imageUrl: null,
  };
}

function wrapPlainText(text) {
  if (!text) return '';
  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join('\n');
}

function escapeHtml(unsafe) {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function countWords(text) {
  if (!text) {
    return 0;
  }

  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function sanitizedLength(html) {
  if (!html) return 0;
  const dom = new JSDOM(`<body>${html}</body>`);
  const text = dom.window.document.body.textContent || '';
  return text.replace(/\s+/g, ' ').trim().length;
}


