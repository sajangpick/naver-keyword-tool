const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const navClientId = process.env.NAVER_SEARCH_CLIENT_ID;
const navClientSecret = process.env.NAVER_SEARCH_CLIENT_SECRET;

const maxPerCategory = Number(process.env.NEWS_FETCH_LIMIT_PER_CATEGORY || 10);
const naverResultsPerKeyword = Number(process.env.NAVER_RESULTS_PER_KEYWORD || 20);

const defaultInternalBase = process.env.NEWS_FETCH_INTERNAL_BASE
  || (process.env.PORT ? `http://127.0.0.1:${process.env.PORT}` : 'http://localhost:3003');

const fetchBases = [
  process.env.NEWS_FETCH_API_BASE,
  process.env.NEWS_FETCH_FALLBACK_BASE,
  defaultInternalBase,
  'https://naver-keyword-tool.onrender.com',
].filter(Boolean);

const CATEGORY_KEYWORDS = {
  policy: [
    '소상공인 지원금',
    '소상공인 정책',
    '외식업 정책 지원',
    '자영업 세금 혜택',
    '소상공인 대출 제도',
    '골목상권 활성화 정책',
  ],
  trend: [
    '소상공인 외식 트렌드',
    '맛집 소비 트렌드',
    'MZ세대 식당 인기',
    '자영업 마케팅 트렌드',
    '소상공인 창업 트렌드',
    '외식업 배달 트렌드',
  ],
  management: [
    '식당 경영 노하우',
    '식당 매출 증가 전략',
    '자영업 마케팅 전략',
    '소상공인 고객관리',
    '사장님 매출 관리',
    '소상공인 인건비 절감',
  ],
  ingredients: [
    '식자재 가격 동향',
    '농산물 가격 상승 소상공인',
    '수산물 가격 변동 식당',
    '외식업 원가 관리',
    '식당 식재료 수급',
    '소상공인 원재료 비용',
  ],
  technology: [
    '식당 기술 도구',
    '배달앱 업데이트 자영업',
    'POS 시스템 뉴스',
    '소상공인 디지털 전환',
    '자영업 스마트오더',
    '소상공인 AI 서비스',
  ],
};

const SMALL_BIZ_KEYWORDS = [
  '소상공인',
  '소상공',
  '자영업',
  '자영업자',
  '소기업',
  '중소기업',
  '중기부',
  '사장님',
  '점주',
  '창업',
  '창업자',
  '가게',
  '매장',
  '점포',
  '상권',
  '골목상권',
  '상인',
  '장사',
  '식당',
  '음식점',
  '외식업',
  '요식업',
  '카페',
  '베이커리',
  '주점',
  '분식',
  '프랜차이즈',
  '배달',
  '배달앱',
  '배달업',
  '배달 플랫폼',
  '포장매장',
  '테이크아웃',
  '식재료',
  '원재료',
  '원가',
  '위생',
  '임대료',
  '부가세',
  '세무',
  '지원금',
  '보조금',
  '정책자금',
  '대출',
  '융자',
  '상생',
  '협동조합',
  '지역 상점',
];

let supabase = null;
if (supabaseUrl && supabaseServiceKey) {
  try {
    supabase = createClient(supabaseUrl, supabaseServiceKey);
  } catch (error) {
    console.error('[news-collect] Supabase 초기화 실패:', error.message);
  }
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: '지원하지 않는 메서드입니다.' });
  }

  if (!supabase) {
    return res.status(503).json({ success: false, error: 'Database service unavailable' });
  }

  if (!navClientId || !navClientSecret) {
    return res.status(500).json({ success: false, error: 'NAVER API 인증 정보가 설정되지 않았습니다.' });
  }

  try {
    const collectedItems = [];
    const detailLogs = [];

    for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
      const categoryItems = [];

      for (const keyword of keywords) {
        const newsItems = await fetchNaverNews(keyword);
        detailLogs.push(`[${category}] "${keyword}" → ${newsItems.length}건`);

        for (const item of newsItems) {
          const payload = await buildNewsPayload(item, category);
          if (payload) {
            categoryItems.push(payload);
          }

          if (categoryItems.length >= maxPerCategory) break;
        }

        if (categoryItems.length >= maxPerCategory) break;
      }

      collectedItems.push(...categoryItems);
    }

    if (collectedItems.length === 0) {
      return res.status(200).json({
        success: true,
        insertedCount: 0,
        message: '수집된 뉴스가 없습니다.',
      });
    }

    const dedupeTargets = collectedItems
      .map((item) => item.source_url)
      .filter(Boolean);

    let existingSources = [];
    if (dedupeTargets.length > 0) {
      const { data: existing, error: existingError } = await supabase
        .from('news_board')
        .select('source_url')
        .in('source_url', dedupeTargets);

      if (existingError) {
        console.error('[news-collect] 기존 뉴스 조회 실패:', existingError.message);
      } else if (Array.isArray(existing)) {
        existingSources = existing.map((row) => row.source_url).filter(Boolean);
      }
    }

    const newItems = collectedItems.filter(
      (item) => !existingSources.includes(item.source_url),
    );

    if (newItems.length === 0) {
      return res.status(200).json({
        success: true,
        insertedCount: 0,
        message: '모든 뉴스가 이미 등록되어 있습니다.',
        detail: detailLogs,
      });
    }

    const { error: insertError } = await supabase
      .from('news_board')
      .insert(newItems);

    if (insertError) {
      console.error('[news-collect] 뉴스 저장 실패:', insertError.message);
      return res.status(500).json({
        success: false,
        error: '뉴스 저장에 실패했습니다.',
        detail: insertError.message,
      });
    }

    return res.status(200).json({
      success: true,
      insertedCount: newItems.length,
      totalCollected: collectedItems.length,
      skippedDuplicates: collectedItems.length - newItems.length,
      detail: detailLogs,
    });
  } catch (error) {
    console.error('[news-collect] 처리 중 오류:', error);
    return res.status(500).json({
      success: false,
      error: '뉴스 수집 중 오류가 발생했습니다.',
      detail: error.message,
    });
  }
};

async function fetchNaverNews(keyword) {
  try {
    const response = await axios.get('https://openapi.naver.com/v1/search/news.json', {
      params: {
        query: keyword,
        display: naverResultsPerKeyword,
        sort: 'date',
      },
      headers: {
        'X-Naver-Client-Id': navClientId,
        'X-Naver-Client-Secret': navClientSecret,
      },
      timeout: 7000,
    });

    const items = response.data?.items;
    return Array.isArray(items) ? items : [];
  } catch (error) {
    console.error('[news-collect] 네이버 뉴스 검색 실패:', keyword, error.message);
    return [];
  }
}

async function buildNewsPayload(item, category) {
  const title = cleanText(item?.title);
  const summary = cleanText(item?.description);
  const sourceUrl = item?.originallink || item?.link;

  if (!title || !sourceUrl) {
    return null;
  }

  const article = await fetchFullArticle(sourceUrl);
  const articleText = cleanText(article?.text || '');
  let contentHtml;
  let finalSource = sourceUrl;

  if (article && article.content) {
    contentHtml = article.content;
    if (article.sourceUrl) {
      finalSource = article.sourceUrl;
    }
  } else {
    const safeSummary = summary || '자세한 내용은 아래 원문 링크를 참고해주세요.';
    contentHtml = `<p>${safeSummary}</p><p><br></p><p>출처: <a href="${sourceUrl}" target="_blank" rel="noopener">${sourceUrl}</a></p>`;
  }

  const combinedText = `${title} ${summary} ${articleText}`.toLowerCase();
  if (!isSmallBusinessRelated(combinedText)) {
    return null;
  }

  return {
    title: title.slice(0, 255),
    content: contentHtml,
    category,
    image_url: null,
    source_url: finalSource,
    author: 'NAVER_AUTO',
    is_featured: false,
  };
}

async function fetchFullArticle(targetUrl) {
  if (!targetUrl) return null;

  const encodedUrl = encodeURIComponent(targetUrl);

  for (const base of fetchBases) {
    try {
      const fetchUrl = `${base.replace(/\/$/, '')}/api/news-fetch?url=${encodedUrl}`;
      const response = await axios.get(fetchUrl, { timeout: 10000 });

      if (response.data?.success && response.data?.data) {
        return response.data.data;
      }
    } catch (error) {
      console.warn('[news-collect] 원문 추출 실패:', base, error.message);
    }
  }

  return null;
}

function cleanText(text) {
  if (!text) return '';
  return String(text)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .trim();
}

function isSmallBusinessRelated(text) {
  if (!text) return false;
  return SMALL_BIZ_KEYWORDS.some((keyword) => text.includes(keyword));
}

