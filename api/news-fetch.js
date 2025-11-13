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
  '#dic_area',
  'article#dic_area',
  'article._article_content',
  'article.go_trans',
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
  '._article_content',
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
    const { articleHtml, plainText, rawHtml, rawText, title, byline, excerpt, imageUrl, press } = parseArticle(html, finalUrl);

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
        plainText: plainText, // plainText 필드도 명시적으로 추가
        rawHtml,
        rawText,
        imageUrl,
        press: press || '', // 언론사 정보 추가
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
  
  // 언론사 정보 추출 (Naver 뉴스)
  let pressName = '';
  // Naver 뉴스의 경우 여러 방법으로 언론사 추출 시도
  const pressSelectors = [
    'meta[property="og:article:author"]',
    'meta[name="og:article:author"]',
    '.media_end_head_top a',
    '.press_logo',
    '[class*="press"]',
    '[class*="media"]',
    'meta[property="article:publisher"]',
    'meta[name="article:publisher"]'
  ];
  
  for (const selector of pressSelectors) {
    const element = document.querySelector(selector);
    if (element) {
      if (element.tagName === 'META') {
        pressName = element.getAttribute('content') || '';
      } else {
        pressName = element.textContent?.trim() || element.getAttribute('alt') || element.getAttribute('title') || '';
      }
      if (pressName) break;
    }
  }
  
  // URL에서 언론사 코드 추출 시도 (n.news.naver.com/mnews/article/{pressCode}/...)
  if (!pressName && baseUrl.includes('n.news.naver.com')) {
    const urlMatch = baseUrl.match(/\/mnews\/article\/(\d+)\//);
    if (urlMatch) {
      // 언론사 코드를 이름으로 변환하는 로직은 복잡하므로 일단 URL에서 추출
      // 실제로는 언론사 코드 매핑이 필요하지만, 일단은 페이지에서 추출한 값 사용
    }
  }

  // 네이버 뉴스의 경우 #dic_area를 우선 확인
  const dicArea = document.querySelector('#dic_area');
  console.log('[news-fetch] #dic_area 찾기:', {
    found: !!dicArea,
    textLength: dicArea ? dicArea.textContent?.trim().length : 0,
    preview: dicArea ? dicArea.textContent?.substring(0, 100) : 'not found'
  });
  
  if (dicArea && dicArea.textContent && dicArea.textContent.trim().length > 60) {
    // #dic_area의 HTML을 복사하여 처리
    const dicAreaClone = dicArea.cloneNode(true);
    
    // 불필요한 요소 제거 (비디오 플레이어, 광고, 스크립트, 제보 섹션 등)
    // 이미지는 유지 (end_photo_org, img 등)
    dicAreaClone.querySelectorAll('script, style, noscript, iframe, form, .ad, .advertisement, .sns_area, .share_area, .vod_player_wrap, .VOD_PLAYER_ERROR_WRAP, .video_area, ._VIDEO_AREA, .pzp, [class*="pzp"], [id*="video"], [id*="VOD"], [class*="vod"], .artical-btm, [class*="artical"]').forEach((node) => {
      try { node.remove(); } catch (e) {}
    });
    
    // 비디오 관련 요소도 제거 (이미지는 유지)
    const videoElements = dicAreaClone.querySelectorAll('video, canvas, [class*="player"]:not([class*="photo"]), [class*="Player"]');
    videoElements.forEach((node) => {
      try { 
        // 부모 요소가 비디오 관련이면 부모도 제거
        let parent = node.parentElement;
        while (parent && parent !== dicAreaClone) {
          if (parent.classList.contains('vod_player_wrap') || 
              parent.classList.contains('_VIDEO_AREA_WRAP') ||
              parent.id?.includes('video') ||
              parent.id?.includes('VOD')) {
            parent.remove();
            break;
          }
          parent = parent.parentElement;
        }
        if (!parent || parent === dicAreaClone) {
          node.remove();
        }
      } catch (e) {}
    });
    
    // SVG는 비디오 플레이어 관련만 제거 (이미지 설명용 SVG는 유지)
    const svgElements = dicAreaClone.querySelectorAll('svg');
    svgElements.forEach((svg) => {
      let parent = svg.parentElement;
      let shouldRemove = false;
      while (parent && parent !== dicAreaClone) {
        if (parent.classList.contains('pzp') || 
            parent.classList.contains('vod_player_wrap') ||
            parent.id?.includes('video') ||
            parent.id?.includes('VOD')) {
          shouldRemove = true;
          break;
        }
        parent = parent.parentElement;
      }
      if (shouldRemove) {
        let svgParent = svg.parentElement;
        while (svgParent && svgParent !== dicAreaClone) {
          if (svgParent.classList.contains('vod_player_wrap') || 
              svgParent.classList.contains('_VIDEO_AREA_WRAP')) {
            svgParent.remove();
            break;
          }
          svgParent = svgParent.parentElement;
        }
      }
    });
    
    // <br> 태그를 줄바꿈으로 변환 (연속된 <br><br>는 하나의 줄바꿈으로)
    const brElements = dicAreaClone.querySelectorAll('br');
    brElements.forEach((br, index) => {
      // 이전 요소가 <br>이면 현재 <br>는 무시 (연속된 <br> 처리)
      const prevSibling = br.previousSibling;
      if (prevSibling && prevSibling.nodeType === 3 && prevSibling.textContent === '\n') {
        br.remove();
      } else {
        const newline = document.createTextNode('\n');
        br.replaceWith(newline);
      }
    });
    
    // 텍스트 추출
    let dicAreaText = dicAreaClone.textContent || dicAreaClone.innerText || '';
    
    // 불필요한 공백 정리
    dicAreaText = dicAreaText
      .replace(/\u00a0/g, ' ')
      .replace(/\r?\n{3,}/g, '\n\n') // 연속된 줄바꿈을 2개로
      .split('\n')
      .map((line) => line.replace(/\s+/g, ' ').trim())
      .filter((line) => line.length > 0)
      .join('\n\n');
    
    if (dicAreaText.length > 0) {
      // 직접 추출한 텍스트를 우선 사용 (가장 확실한 방법)
      const finalText = dicAreaText;
      
      // HTML도 정리하여 추출 (이미지 URL 등을 위해)
      const normalized = normalizeContent(dicArea.innerHTML, baseUrl);
      const finalHtml = normalized.html || wrapPlainText(dicAreaText);
      
      console.log('[news-fetch] #dic_area에서 텍스트 추출 성공:', {
        textLength: finalText.length,
        preview: finalText.substring(0, 100)
      });
      
      return {
        articleHtml: finalHtml,
        plainText: finalText,
        text: finalText, // text 필드도 추가
        rawHtml: dicArea.innerHTML.trim(),
        rawText: dicAreaText,
        title: document.querySelector('meta[property="og:title"]')?.getAttribute('content') || document.title || '',
        byline: '',
        excerpt: finalText.slice(0, 200),
        imageUrl: imageUrl || normalized.imageUrl || null,
        press: pressName || '',
      };
    }
  }

  const reader = new Readability(document);
  const article = reader.parse();

  if (article && article.content) {
    const normalized = normalizeContent(article.content, baseUrl);
    return {
      articleHtml: normalized.html,
      plainText: normalized.text,
      text: normalized.text, // text 필드도 추가
      rawHtml: normalized.rawHtml,
      rawText: normalized.rawText,
      title: article.title || document.title || '',
      byline: article.byline || '',
      excerpt: article.excerpt || '',
      imageUrl: imageUrl || normalized.imageUrl || null,
      press: pressName || '',
    };
  }

  // Readability가 실패한 경우 수동 추출
  const fallback = fallbackExtract(document, baseUrl);
  return {
    articleHtml: fallback.html,
    plainText: fallback.text,
    text: fallback.text, // text 필드도 추가
    rawHtml: fallback.rawHtml,
    rawText: fallback.rawText,
    title: document.title || '',
    byline: '',
    excerpt: fallback.text.slice(0, 200),
    imageUrl: imageUrl || fallback.imageUrl || null,
    press: pressName || '',
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

  // 3. #dic_area 내부의 첫 번째 이미지 확인 (네이버 뉴스 우선)
  const dicArea = document.querySelector('#dic_area');
  if (dicArea) {
    const dicAreaImg = dicArea.querySelector('img');
    if (dicAreaImg) {
      const src = dicAreaImg.getAttribute('src') || dicAreaImg.getAttribute('data-src');
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

  // 4. article 내부의 첫 번째 이미지 확인
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

  // 5. 본문 영역의 적절한 크기의 이미지 찾기 (다양한 선택자)
  const contentSelectors = [
    '#dic_area img',
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

  // <br> 태그를 줄바꿈으로 변환 (연속된 <br>는 하나의 줄바꿈으로)
  let brCount = 0;
  document.querySelectorAll('br').forEach((br) => {
    brCount++;
    const newline = document.createTextNode('\n');
    br.replaceWith(newline);
  });
  
  // 연속된 줄바꿈 정리
  if (brCount > 0) {
    const bodyText = document.body.innerHTML;
    document.body.innerHTML = bodyText.replace(/\n{3,}/g, '\n\n');
  }

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

  // 텍스트 추출: p 태그 우선, 없으면 div나 다른 블록 요소, 마지막으로 전체 텍스트
  const paragraphs = Array.from(document.querySelectorAll('p'))
    .map((p) => p.textContent.replace(/\s+/g, ' ').trim())
    .filter((text) => text.length > 0);

  let plainText;
  if (paragraphs.length > 0) {
    plainText = paragraphs.join('\n\n');
  } else {
    // p 태그가 없으면 div나 다른 블록 요소에서 텍스트 추출
    const divs = Array.from(document.querySelectorAll('div, span, article, section'))
      .map((el) => {
        const text = el.textContent?.replace(/\s+/g, ' ').trim() || '';
        // 자식 요소가 있으면 제외 (중복 방지)
        if (el.children.length > 0 && text.length < 100) return '';
        return text;
      })
      .filter((text) => text.length > 20); // 최소 20자 이상만
    
    if (divs.length > 0) {
      plainText = divs.join('\n\n');
    } else {
      // 마지막으로 전체 텍스트 추출
      const rawNodes = Array.from(document.body.childNodes)
        .map((node) => {
          if (node.nodeType === 3) { // 텍스트 노드
            return node.textContent;
          } else if (node.nodeType === 1) { // 요소 노드
            return node.textContent;
          }
          return '';
        })
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


