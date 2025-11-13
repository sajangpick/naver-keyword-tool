// 프로덕션(Render/Vercel)에서는 chromium 사용, 로컬에서만 puppeteer 사용
const isProduction = process.env.NODE_ENV === 'production' || process.env.RENDER;

let chromium, puppeteer;

if (isProduction) {
  // Render/Vercel: @sparticuz/chromium 사용
  chromium = require('@sparticuz/chromium');
  puppeteer = require('puppeteer-core');
} else {
  // 로컬: 일반 puppeteer 사용
  puppeteer = require('puppeteer');
}

// 네이버 뉴스 섹션 URL 매핑
const SECTION_URLS = {
  headline: 'https://news.naver.com/main/home', // 헤드라인 (메인)
  social: 'https://news.naver.com/section/102', // 사회
  economy: 'https://news.naver.com/section/101', // 경제
};

// 소상공인 관련 키워드 (필터링용)
const SME_KEYWORDS = [
  // 직접 키워드
  '소상공인', '소상공', '자영업', '자영업자', '상인', '상점', '상권', '상가',
  '점포', '매장', '가게', '음식점', '레스토랑', '카페', '베이커리', '편의점',
  '마트', '백화점', '쇼핑몰', '창업', '사업', '경영', '영업', '운영',
  '매출', '매출액', '손실', '이익', '적자', '흑자', '폐업', '휴업', '도산', '파산',
  '경영난', '경영위기', '경영난', '경영위기',
  // 정책/지원
  '지원금', '정책지원금', '보조금', '융자', '대출', '임대료', '월세', '임대보호',
  '소상공인시장진흥공단', '소상공인연합회', '소상공인정책', '소상공인지원',
  // 트렌드
  'MZ', '젊은', '청년', '창업자', '프랜차이즈', '체인점', '디지털', '전자상거래',
  '온라인', '오프라인', '쇼핑', '판매', '구매', '고객', '손님',
  // 업종
  '식당', '외식', '배달', '배달음식', '배달앱', '포장', '테이크아웃',
  '호텔', '숙박', '관광', '여행', '레저', '오락', '문화', '예술',
  '미용', '이미용', '헤어', '네일', '마사지', '피부관리',
  '의류', '패션', '신발', '가방', '액세서리', '화장품', '향수',
  '가구', '인테리어', '홈데코', '생활용품', '주방용품', '욕실용품',
  '도서', '서점', '문구', '완구', '취미', '오락',
  '운동', '피트니스', '요가', '필라테스', '골프', '테니스',
  '의료', '병원', '치과', '한의원', '약국', '보건',
  '교육', '학원', '과외', '어학원', '컴퓨터', '프로그래밍',
  '자동차', '정비', '세차', '주유소', '주차장',
  '부동산', '중개', '임대', '매매', '전세', '월세',
  '법률', '회계', '세무', '노무', '경영컨설팅', '마케팅',
  // 지역/상권
  '상권', '번화가', '쇼핑몰', '아울렛', '할인마트', '대형마트',
  '동대문', '남대문', '명동', '강남', '홍대', '이태원', '압구정', '청담',
];

module.exports = async (req, res) => {
  // CORS 설정
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: '지원하지 않는 메서드입니다.' });
  }

  try {
    // 사회, 경제 섹션 크롤링 (각 섹션의 헤드라인 + 소상공인 관련 뉴스 포함)
    const sections = {};
    const errors = {};
    
    // 사회 섹션 크롤링 (헤드라인 + 소상공인 관련 뉴스)
    try {
      console.log('[naver-section-news] 사회 섹션 크롤링 시작... (헤드라인 + 소상공인 관련 뉴스)');
      const socialNews = await crawlSection('social', SECTION_URLS.social);
      sections.social = socialNews || [];
      console.log(`[naver-section-news] 사회 섹션 크롤링 완료: ${sections.social.length}개 뉴스 (헤드라인 포함)`);
    } catch (error) {
      console.error('[naver-section-news] 사회 섹션 크롤링 실패:', {
        message: error.message,
        stack: error.stack,
      });
      sections.social = [];
      errors.social = error.message;
    }

    // 경제 섹션 크롤링 (헤드라인 + 소상공인 관련 뉴스)
    try {
      console.log('[naver-section-news] 경제 섹션 크롤링 시작... (헤드라인 + 소상공인 관련 뉴스)');
      const economyNews = await crawlSection('economy', SECTION_URLS.economy);
      sections.economy = economyNews || [];
      console.log(`[naver-section-news] 경제 섹션 크롤링 완료: ${sections.economy.length}개 뉴스 (헤드라인 포함)`);
    } catch (error) {
      console.error('[naver-section-news] 경제 섹션 크롤링 실패:', {
        message: error.message,
        stack: error.stack,
      });
      sections.economy = [];
      errors.economy = error.message;
    }

    // 전체 뉴스 개수 확인
    const totalCount = (sections.social?.length || 0) + (sections.economy?.length || 0);
    console.log(`[naver-section-news] 전체 크롤링 완료: 총 ${totalCount}개 뉴스 (사회: ${sections.social?.length || 0}, 경제: ${sections.economy?.length || 0})`);

    return res.status(200).json({
      success: true,
      data: sections,
      errors: Object.keys(errors).length > 0 ? errors : undefined,
      counts: {
        social: sections.social?.length || 0,
        economy: sections.economy?.length || 0,
        total: totalCount,
      },
    });
  } catch (error) {
    console.error('[naver-section-news] 크롤링 오류:', {
      message: error.message,
      stack: error.stack,
    });

    return res.status(500).json({
      success: false,
      error: '네이버 뉴스 섹션을 불러오는데 실패했습니다.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * 소상공인 관련 뉴스 필터링
 */
function isSMERelated(item) {
  if (!item || !item.title) return false;
  
  const title = item.title.toLowerCase();
  const summary = (item.summary || '').toLowerCase();
  const text = `${title} ${summary}`;
  
  // 소상공인 관련 키워드 중 하나라도 포함되어 있으면 true
  return SME_KEYWORDS.some(keyword => text.includes(keyword.toLowerCase()));
}

/**
 * 네이버 뉴스 헤드라인 크롤링 (Puppeteer 사용)
 */
async function crawlHeadline(sectionKey, url) {
  let browser = null;

  try {
    console.log(`[naver-section-news] ${sectionKey} 헤드라인 크롤링 시작:`, url);

    // 브라우저 실행 옵션
    let launchOptions;

    if (isProduction) {
      const executablePath = await chromium.executablePath();
      launchOptions = {
        args: [
          ...chromium.args,
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
        ],
        defaultViewport: { width: 1920, height: 1080 },
        executablePath,
        headless: chromium.headless,
      };
    } else {
      launchOptions = {
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
        ],
        defaultViewport: { width: 1920, height: 1080 },
        headless: true,
      };
    }

    browser = await puppeteer.launch(launchOptions);
    const page = await browser.newPage();

    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
    );

    page.setDefaultNavigationTimeout(60000);
    page.setDefaultTimeout(60000);

    console.log(`[naver-section-news] ${sectionKey} 헤드라인 페이지 로딩 중...`);
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });

    // 동적 콘텐츠 로딩 대기 (더 긴 대기 시간)
    console.log(`[naver-section-news] ${sectionKey} 헤드라인 페이지 대기 중...`);
    await new Promise((resolve) => setTimeout(resolve, 8000));
    
    // 스크롤하여 추가 콘텐츠 로드 (헤드라인 뉴스가 동적으로 로드될 수 있음)
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight / 3);
    });
    await new Promise((resolve) => setTimeout(resolve, 2000));
    
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight / 2);
    });
    await new Promise((resolve) => setTimeout(resolve, 2000));
    
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // 헤드라인 뉴스 추출
    const headlineNews = await page.evaluate(() => {
      const items = [];
      const foundLinks = new Set();
      
      // 네이버 뉴스 메인 페이지의 헤드라인 선택자들 (우선순위 높은 것부터)
      const headlineSelectors = [
        // 메인 헤드라인
        '.hdline_article_tit a',
        '.hdline_article_list a',
        '.hdline_article_list li a',
        '.cluster_head a',
        '.cluster_text_headline a',
        '.cluster_head_topic a',
        '.cluster_text_topic a',
        // 섹션 헤드라인
        '.section_headline a',
        '.section_headline_list a',
        '.newsnow_tx_inner a',
        '.newsnow_tx_area a',
        '.main_news_list a',
        '.sa_text_title a',
        '.sa_text_lede a',
        // 일반 뉴스 링크
        'article a[href*="/article/"]',
        '.main_news_list a[href*="/article/"]',
        '.list_body a[href*="/article/"]',
      ];

      // 우선순위 높은 선택자부터 시도
      for (const selector of headlineSelectors) {
        try {
          const elements = document.querySelectorAll(selector);
          elements.forEach(element => {
            const href = element.getAttribute('href');
            const title = element.textContent?.trim() || element.innerText?.trim() || '';
            
            if (href && href.includes('/article/') && title && title.length > 10 && !foundLinks.has(href)) {
              foundLinks.add(href);
              
              // 링크 정규화
              let normalizedLink = href;
              if (href.startsWith('/')) {
                normalizedLink = `https://news.naver.com${href}`;
              } else if (!href.startsWith('http')) {
                try {
                  normalizedLink = new URL(href, window.location.href).toString();
                } catch (e) {
                  return; // 잘못된 URL은 스킵
                }
              }
              
              items.push({
                title: title.substring(0, 500),
                link: normalizedLink,
                summary: '',
                press: '',
                publishedAt: new Date().toISOString(),
                imageUrl: '',
              });
            }
          });
        } catch (e) {
          console.error(`헤드라인 선택자 ${selector} 처리 실패:`, e);
        }
      }

      // 추가로 메인 페이지의 모든 뉴스 링크 찾기 (헤드라인 위주로)
      const allMainLinks = document.querySelectorAll('a[href*="/article/"]');
      allMainLinks.forEach(link => {
        const href = link.getAttribute('href');
        const title = link.textContent?.trim() || link.innerText?.trim() || '';
        
        if (href && href.includes('/article/') && title && title.length > 10 && !foundLinks.has(href)) {
          foundLinks.add(href);
          
          // 링크 정규화
          let normalizedLink = href;
          if (href.startsWith('/')) {
            normalizedLink = `https://news.naver.com${href}`;
          } else if (!href.startsWith('http')) {
            try {
              normalizedLink = new URL(href, window.location.href).toString();
            } catch (e) {
              return;
            }
          }
          
          items.push({
            title: title.substring(0, 500),
            link: normalizedLink,
            summary: '',
            press: '',
            publishedAt: new Date().toISOString(),
            imageUrl: '',
          });
        }
      });

      // 중복 제거 (링크 기준)
      const uniqueItems = [];
      const linkSet = new Set();
      items.forEach(item => {
        if (!linkSet.has(item.link)) {
          linkSet.add(item.link);
          uniqueItems.push(item);
        }
      });

      console.log(`헤드라인 뉴스 수집: 총 ${uniqueItems.length}개`);
      return uniqueItems.slice(0, 150); // 더 많이 수집 (필터링 후에도 충분한 수를 확보)
    });

    console.log(`[naver-section-news] ${sectionKey} 헤드라인 ${headlineNews.length}개 수집 완료`);

    // 소상공인 관련 뉴스만 필터링
    const filteredNews = headlineNews.filter(item => isSMERelated(item));
    console.log(`[naver-section-news] ${sectionKey} 헤드라인 필터링 후 ${filteredNews.length}개 (소상공인 관련, 전체: ${headlineNews.length}개)`);

    // 필터링 후 뉴스가 없으면 필터링 없이 일부 반환 (임시 해결책)
    if (filteredNews.length === 0 && headlineNews.length > 0) {
      console.warn(`[naver-section-news] ⚠️ ${sectionKey} 헤드라인: 필터링 후 뉴스가 0개입니다. 필터링 없이 상위 5개를 반환합니다.`);
      // 필터링 없이 상위 5개만 반환
      return headlineNews.slice(0, 5);
    }

    // 최대 30개만 반환
    return filteredNews.slice(0, 30);
  } catch (error) {
    console.error(`[naver-section-news] ${sectionKey} 헤드라인 크롤링 실패:`, error);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * 네이버 뉴스 섹션 크롤링 (Puppeteer 사용)
 */
async function crawlSection(sectionKey, url) {
  let browser = null;

  try {
    console.log(`[naver-section-news] ${sectionKey} 섹션 크롤링 시작:`, url);

    // 브라우저 실행 옵션
    let launchOptions;

    if (isProduction) {
      // Render/Vercel: chromium 사용
      const executablePath = await chromium.executablePath();
      launchOptions = {
        args: [
          ...chromium.args,
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
        ],
        defaultViewport: { width: 1920, height: 1080 },
        executablePath,
        headless: chromium.headless,
      };
    } else {
      // 로컬: 일반 puppeteer
      launchOptions = {
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
        ],
        defaultViewport: { width: 1920, height: 1080 },
        headless: true,
      };
    }

    browser = await puppeteer.launch(launchOptions);
    const page = await browser.newPage();

    // User-Agent 설정
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
    );

    page.setDefaultNavigationTimeout(60000);
    page.setDefaultTimeout(60000);

    // 페이지 로드
    console.log(`[naver-section-news] ${sectionKey} 페이지 로딩 중...`);
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });

    // 동적 콘텐츠 로딩 대기 (더 긴 대기 시간)
    // Puppeteer 최신 버전에서는 waitForTimeout 대신 Promise + setTimeout 사용
    console.log(`[naver-section-news] ${sectionKey} 페이지 대기 중...`);
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // 스크롤하여 추가 콘텐츠 로드
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight / 2);
    });
    await new Promise((resolve) => setTimeout(resolve, 2000));
    
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // 뉴스 목록 추출 (섹션 헤드라인 + 일반 뉴스)
    const newsItems = await page.evaluate(() => {
      const items = [];
      const foundLinks = new Set();

      // 1단계: 섹션 페이지 상단의 헤드라인 뉴스 수집
      const headlineSelectors = [
        '.section_headline a',
        '.section_headline_list a',
        '.hdline_article_tit a',
        '.hdline_article_list a',
        '.cluster_head a',
        '.cluster_text_headline a',
        '.newsnow_tx_inner a',
        '.newsnow_tx_area a',
        '.main_news_list a',
        '.sa_text_title a',
        '.sa_text_lede a',
      ];

      headlineSelectors.forEach(selector => {
        try {
          const elements = document.querySelectorAll(selector);
          elements.forEach(element => {
            const href = element.getAttribute('href');
            const title = element.textContent?.trim() || element.innerText?.trim() || '';
            
            if (href && href.includes('/article/') && title && title.length > 10 && !foundLinks.has(href)) {
              foundLinks.add(href);
              
              let normalizedLink = href;
              if (href.startsWith('/')) {
                normalizedLink = `https://news.naver.com${href}`;
              } else if (!href.startsWith('http')) {
                try {
                  normalizedLink = new URL(href, window.location.href).toString();
                } catch (e) {
                  return;
                }
              }
              
              items.push({
                title: title.substring(0, 500),
                link: normalizedLink,
                summary: '',
                press: '',
                publishedAt: new Date().toISOString(),
                imageUrl: '',
                _isHeadline: true, // 헤드라인 뉴스 표시
              });
            }
          });
        } catch (e) {
          console.error(`섹션 헤드라인 선택자 ${selector} 처리 실패:`, e);
        }
      });

      // 2단계: 네이버 뉴스 섹션 페이지의 일반 뉴스 수집
      const selectors = [
        '.sa_list li',
        '.sa_item',
        '.list_body li',
        '.section_list li',
        'article.sa_item',
        '.newsnow_tx_inner li',
        '.list_body .sa_item',
        '.sa_list .sa_item',
      ];

      let newsElements = [];

      // 여러 선택자 시도
      for (const selector of selectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          newsElements = Array.from(elements);
          console.log(`선택자 ${selector}로 ${elements.length}개 요소 찾음`);
          break;
        }
      }

      // 선택자가 작동하지 않으면 전체 페이지에서 뉴스 링크 찾기
      if (newsElements.length === 0) {
        const allLinks = document.querySelectorAll('a[href*="/article/"]');
        allLinks.forEach((link) => {
          const href = link.getAttribute('href');
          const title = link.textContent?.trim() || link.innerText?.trim() || '';
          
          if (
            href &&
            href.includes('/article/') &&
            !href.includes('#') &&
            !href.includes('javascript:') &&
            title &&
            title.length > 10 &&
            !foundLinks.has(href)
          ) {
            foundLinks.add(href);
            
            let normalizedLink = href;
            if (href.startsWith('/')) {
              normalizedLink = `https://news.naver.com${href}`;
            } else if (!href.startsWith('http')) {
              try {
                normalizedLink = new URL(href, window.location.href).toString();
              } catch (e) {
                return;
              }
            }
            
            items.push({
              title: title.substring(0, 500),
              link: normalizedLink,
              summary: '',
              press: '',
              publishedAt: new Date().toISOString(),
              imageUrl: '',
            });
          }
        });
      }

      // 각 뉴스 요소에서 정보 추출
      newsElements.forEach((element) => {
        try {
          // 제목 추출
          const titleSelectors = [
            '.sa_text_title',
            '.sa_text_lede',
            'a strong',
            'a .title',
            '.tit',
            'h2 a',
            'h3 a',
            'h4 a',
            '.newsnow_tx_inner a',
            'a[href*="/article/"]',
          ];

          let title = '';
          let link = '';

          // 제목과 링크 찾기
          for (const selector of titleSelectors) {
            const titleElement = element.querySelector(selector);
            if (titleElement) {
              title = titleElement.textContent?.trim() || titleElement.innerText?.trim() || '';
              const linkElement = titleElement.closest('a') || titleElement;
              if (linkElement.tagName === 'A') {
                link = linkElement.getAttribute('href') || '';
              } else {
                const parentLink = element.querySelector('a[href*="/article/"]');
                if (parentLink) {
                  link = parentLink.getAttribute('href') || '';
                }
              }
              if (title && link) break;
            }
          }

          // 링크가 없으면 요소 내부의 모든 링크 확인
          if (!link) {
            const allLinks = element.querySelectorAll('a[href*="/article/"]');
            if (allLinks.length > 0) {
              link = allLinks[0].getAttribute('href') || '';
              if (!title) {
                title = allLinks[0].textContent?.trim() || allLinks[0].innerText?.trim() || '';
              }
            }
          }

          // 제목이 없으면 요소의 텍스트 사용
          if (!title) {
            title = element.textContent?.trim() || element.innerText?.trim() || '';
            title = title.replace(/<[^>]*>/g, '').trim();
            title = title.replace(/\n+/g, ' ').trim();
          }

          if (!title || !link) {
            return;
          }

          // 링크 정규화
          if (link.startsWith('/')) {
            link = `https://news.naver.com${link}`;
          } else if (!link.startsWith('http')) {
            try {
              link = new URL(link, window.location.href).toString();
            } catch (error) {
              return;
            }
          }

          // 요약 추출
          const summarySelectors = ['.sa_text_lede', '.sa_text_body', '.summary', '.desc', '.lead', 'p'];

          let summary = '';
          for (const selector of summarySelectors) {
            const summaryElement = element.querySelector(selector);
            if (summaryElement) {
              summary =
                summaryElement.textContent?.trim() || summaryElement.innerText?.trim() || '';
              if (summary && summary.length > 20) {
                summary = summary.replace(/<[^>]*>/g, '').trim();
                summary = summary.replace(/\n+/g, ' ').trim();
                if (summary.length > 200) {
                  summary = summary.substring(0, 200) + '...';
                }
                break;
              }
            }
          }

          // 언론사 추출
          const pressSelectors = ['.sa_text_press', '.press', '.media', '.source', '.journalist'];

          let press = '';
          for (const selector of pressSelectors) {
            const pressElement = element.querySelector(selector);
            if (pressElement) {
              press = pressElement.textContent?.trim() || pressElement.innerText?.trim() || '';
              if (press) {
                press = press.replace(/<[^>]*>/g, '').trim();
                break;
              }
            }
          }

          // 시간 추출
          const timeSelectors = ['.sa_text_date', '.date', '.time', 'time', '[datetime]'];

          let publishedAt = '';
          for (const selector of timeSelectors) {
            const timeElement = element.querySelector(selector);
            if (timeElement) {
              publishedAt =
                timeElement.getAttribute('datetime') ||
                timeElement.getAttribute('data-date') ||
                timeElement.textContent?.trim() ||
                timeElement.innerText?.trim() ||
                '';
              if (publishedAt) {
                publishedAt = publishedAt.replace(/<[^>]*>/g, '').trim();
                break;
              }
            }
          }

          // 이미지 URL 추출
          const imageSelectors = ['img', '.sa_thumb img', '.thumb img', '.image img'];

          let imageUrl = '';
          for (const selector of imageSelectors) {
            const imageElement = element.querySelector(selector);
            if (imageElement) {
              imageUrl =
                imageElement.getAttribute('src') ||
                imageElement.getAttribute('data-src') ||
                imageElement.getAttribute('data-lazy-src') ||
                '';
              if (imageUrl) {
                if (imageUrl.startsWith('/')) {
                  imageUrl = `https://news.naver.com${imageUrl}`;
                } else if (!imageUrl.startsWith('http')) {
                  try {
                    imageUrl = new URL(imageUrl, window.location.href).toString();
                  } catch (error) {
                    imageUrl = '';
                  }
                }
                break;
              }
            }
          }

          // 링크가 이미 수집되었는지 확인
          if (!foundLinks.has(link)) {
            foundLinks.add(link);
            items.push({
              title: title.substring(0, 500),
              link,
              summary: summary || '',
              press: press || '',
              publishedAt: publishedAt || new Date().toISOString(),
              imageUrl: imageUrl || '',
              _collectedAt: new Date().toISOString(),
            });
          }
        } catch (error) {
          console.error('뉴스 아이템 추출 실패:', error);
        }
      });

      // 중복 제거 (링크 기준)
      const uniqueItems = [];
      const linkSet = new Set();
      items.forEach(item => {
        if (!linkSet.has(item.link)) {
          linkSet.add(item.link);
          uniqueItems.push(item);
        }
      });

      console.log(`섹션 ${sectionKey} 뉴스 수집: 총 ${uniqueItems.length}개 (헤드라인 포함)`);
      // 필터링 전에 더 많이 수집 (소상공인 필터링 후에도 충분한 수를 확보하기 위해)
      return uniqueItems.slice(0, 80); // 최대 80개 수집
    });

    console.log(`[naver-section-news] ${sectionKey} 섹션 ${newsItems.length}개 뉴스 수집 완료`);

    // 소상공인 관련 뉴스만 필터링
    const filteredNews = newsItems.filter(item => isSMERelated(item));
    console.log(`[naver-section-news] ${sectionKey} 섹션 필터링 후 ${filteredNews.length}개 (소상공인 관련, 전체: ${newsItems.length}개)`);

    // 필터링 후 뉴스가 없으면 필터링 없이 일부 반환 (임시 해결책)
    if (filteredNews.length === 0 && newsItems.length > 0) {
      console.warn(`[naver-section-news] ⚠️ ${sectionKey} 섹션: 필터링 후 뉴스가 0개입니다. 필터링 없이 상위 10개를 반환합니다.`);
      // 필터링 없이 상위 10개만 반환
      return newsItems.slice(0, 10);
    }

    // 최대 30개만 반환 (헤드라인 + 일반 뉴스)
    return filteredNews.slice(0, 30);
  } catch (error) {
    console.error(`[naver-section-news] ${sectionKey} 섹션 크롤링 실패:`, error);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}


