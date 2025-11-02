// ============================================
// 소상공인 뉴스 검색 API
// ============================================
// 경로: /api/news-search
// 설명: 네이버 뉴스 API로 소상공인/식당 관련 뉴스 검색

const axios = require('axios');

// 소상공인/식당 대표님을 위한 키워드 목록
const RESTAURANT_KEYWORDS = {
  policy: ['소상공인 지원금', '외식업 지원', '자영업자 지원', '배달앱 수수료', '임대료 지원'],
  trend: ['외식 트렌드', '배달 트렌드', '메뉴 트렌드', 'MZ세대 외식', '맛집 마케팅'],
  success: ['식당 성공사례', '매출 증대', '인스타그램 마케팅', '단골 확보'],
  ingredient: ['식재료 가격', '원자재 동향', '수입 식재료'],
  regulation: ['위생 점검', '영업 규제', '음식점 의무사항']
};

module.exports = async (req, res) => {
  // CORS 설정
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: '허용되지 않은 메서드입니다.' });
  }

  try {
    const { 
      keyword, 
      category = 'all', 
      display = 10, 
      sort = 'date' 
    } = req.method === 'GET' ? req.query : req.body;

    // 네이버 검색 API 키 확인
    const clientId = process.env.NAVER_SEARCH_CLIENT_ID;
    const clientSecret = process.env.NAVER_SEARCH_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return res.status(500).json({ 
        error: '네이버 검색 API 키가 설정되지 않았습니다.',
        keywords: RESTAURANT_KEYWORDS 
      });
    }

    // 검색어 결정
    let searchQuery = keyword;
    
    // 키워드가 없으면 카테고리별 기본 검색어 사용
    if (!searchQuery && category !== 'all') {
      const keywords = RESTAURANT_KEYWORDS[category];
      if (keywords && keywords.length > 0) {
        searchQuery = keywords[0];
      }
    }

    if (!searchQuery) {
      searchQuery = '소상공인 지원'; // 기본 검색어
    }

    // 네이버 뉴스 검색 API 호출
    const response = await axios.get('https://openapi.naver.com/v1/search/news.json', {
      params: {
        query: searchQuery,
        display: display,
        sort: sort // date: 최신순, sim: 관련도순
      },
      headers: {
        'X-Naver-Client-Id': clientId,
        'X-Naver-Client-Secret': clientSecret
      }
    });

    const items = response.data.items || [];

    // 결과 가공 (HTML 태그 제거, 날짜 포맷팅)
    const processedItems = items.map(item => ({
      title: item.title.replace(/<[^>]*>/g, ''),
      originallink: item.originallink,
      link: item.link,
      description: item.description.replace(/<[^>]*>/g, ''),
      pubDate: item.pubDate,
      formattedDate: formatDate(item.pubDate),
      category: categorizeNews(item.title + ' ' + item.description),
      importance: calculateImportance(item.title + ' ' + item.description)
    }));

    return res.json({
      success: true,
      total: response.data.total,
      display: response.data.display,
      items: processedItems,
      searchQuery: searchQuery,
      availableKeywords: RESTAURANT_KEYWORDS
    });

  } catch (error) {
    console.error('뉴스 검색 오류:', error);
    return res.status(500).json({ 
      error: '뉴스 검색 중 오류가 발생했습니다.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * 날짜 포맷팅
 */
function formatDate(pubDate) {
  const date = new Date(pubDate);
  const now = new Date();
  const diffTime = Math.abs(now - date);
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return '오늘';
  if (diffDays === 1) return '어제';
  if (diffDays < 7) return `${diffDays}일 전`;
  
  return date.toLocaleDateString('ko-KR', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
}

/**
 * 뉴스 카테고리 자동 분류
 */
function categorizeNews(text) {
  const lowerText = text.toLowerCase();

  if (lowerText.includes('지원금') || lowerText.includes('보조금') || lowerText.includes('정책')) {
    return '정책/지원금';
  }
  if (lowerText.includes('트렌드') || lowerText.includes('인기') || lowerText.includes('유행')) {
    return '트렌드';
  }
  if (lowerText.includes('성공') || lowerText.includes('매출') || lowerText.includes('인터뷰')) {
    return '성공사례';
  }
  if (lowerText.includes('배달') || lowerText.includes('배민') || lowerText.includes('쿠팡')) {
    return '배달/플랫폼';
  }
  if (lowerText.includes('식재료') || lowerText.includes('원가') || lowerText.includes('가격')) {
    return '식재료/원가';
  }
  
  return '기타';
}

/**
 * 중요도 계산 (1-5점)
 */
function calculateImportance(text) {
  let score = 1;
  const lowerText = text.toLowerCase();

  // 긴급/중요 키워드
  if (lowerText.includes('긴급') || lowerText.includes('마감')) score += 2;
  if (lowerText.includes('신청') || lowerText.includes('접수')) score += 1;
  if (lowerText.includes('지원금') || lowerText.includes('보조금')) score += 1;
  if (lowerText.includes('최대') || lowerText.includes('억원')) score += 1;

  return Math.min(score, 5);
}
