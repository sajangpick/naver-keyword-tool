// 네이버 스마트플레이스 목록 가져오기 API
// 로그인 후 관리하는 플레이스 목록을 반환합니다

const { createClient } = require('@supabase/supabase-js');

// Puppeteer 환경 설정 (Render/Vercel 호환)
const isProduction = process.env.NODE_ENV === 'production';
let chromium, puppeteer;

if (isProduction) {
  chromium = require('@sparticuz/chromium');
  puppeteer = require('puppeteer-core');
} else {
  puppeteer = require('puppeteer');
}

module.exports = async (req, res) => {
  try {
    // CORS 헤더 설정
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, user-id');

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    if (req.method !== 'POST') {
      return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    const { naverId, naverPassword, accountId, password } = req.body;

    // accountId/password도 지원 (platform-callback.html에서 사용)
    const finalNaverId = naverId || accountId;
    const finalNaverPassword = naverPassword || password;

    if (!finalNaverId || !finalNaverPassword) {
      return res.status(400).json({
        success: false,
        error: '네이버 아이디와 비밀번호가 필요합니다'
      });
    }

    console.log('[플레이스 목록] 로그인 시작');

    // Puppeteer로 네이버 로그인
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
        headless: true,
      };
    }
    
    const browser = await puppeteer.launch(launchOptions);
    const page = await browser.newPage();

    try {
      // 네이버 로그인
      await page.goto('https://nid.naver.com/nidlogin.login', {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      await page.waitForSelector('#id', { timeout: 10000 });
      await page.type('#id', finalNaverId, { delay: 100 });
      await page.waitForSelector('#pw', { timeout: 10000 });
      await page.type('#pw', finalNaverPassword, { delay: 100 });
      await page.click('#log\\.login');
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });

      // 스마트플레이스 관리자 페이지로 이동
      // 여러 URL 시도
      const possibleUrls = [
        'https://new.smartplace.naver.com/',
        'https://m.place.naver.com/my-place',
        'https://m.place.naver.com/my-place/list'
      ];

      let places = [];
      let lastError = null;

      for (const myPlaceUrl of possibleUrls) {
        try {
          console.log(`[플레이스 목록] ${myPlaceUrl} 시도 중...`);
          await page.goto(myPlaceUrl, { waitUntil: 'networkidle2', timeout: 30000 });

          // 페이지가 로드될 때까지 대기 (동적 콘텐츠 로딩 대기)
          await new Promise(resolve => setTimeout(resolve, 5000));

          // 네트워크 요청이 완료될 때까지 대기
          try {
            await page.waitForFunction(() => {
              return document.readyState === 'complete';
            }, { timeout: 10000 });
          } catch (e) {
            console.log('[플레이스 목록] 페이지 로딩 대기 시간 초과');
          }

          // 추가 대기 (동적 콘텐츠)
          await new Promise(resolve => setTimeout(resolve, 3000));

          // 현재 URL 확인
          const currentUrl = page.url();
          console.log(`[플레이스 목록] 현재 URL: ${currentUrl}`);
          
          // 페이지 제목 확인
          const pageTitle = await page.title();
          console.log(`[플레이스 목록] 페이지 제목: ${pageTitle}`);

          // 플레이스 목록 추출 시도
          places = await page.evaluate(() => {
            const placeLinks = [];
            const seenIds = new Set();

            // 모든 링크에서 플레이스 ID 찾기
            const allLinks = document.querySelectorAll('a[href]');
            
            allLinks.forEach(link => {
              const href = link.getAttribute('href');
              if (!href) return;

              // 여러 패턴으로 placeId 추출
              const patterns = [
                /\/restaurant\/(\d+)/,
                /\/place\/(\d+)/,
                /\/my-place\/(\d+)/,
                /placeId=(\d+)/,
                /id=(\d+)/
              ];

              let placeId = null;
              for (const pattern of patterns) {
                const match = href.match(pattern);
                if (match && match[1]) {
                  placeId = match[1];
                  break;
                }
              }

              // placeId가 있으면 추가
              if (placeId && !seenIds.has(placeId)) {
                seenIds.add(placeId);

                // 이름 추출 (여러 방법 시도)
                let placeName = link.textContent.trim() || 
                               link.querySelector('span, div, p')?.textContent.trim() ||
                               link.getAttribute('title') ||
                               link.getAttribute('aria-label') ||
                               '업소명 없음';

                // 부모 요소에서 이름 찾기
                if (placeName === '업소명 없음' || placeName.length < 2) {
                  const parent = link.closest('li, div, article, section');
                  if (parent) {
                    const nameEl = parent.querySelector('h1, h2, h3, h4, .name, [class*="name"], [class*="title"]');
                    if (nameEl) {
                      placeName = nameEl.textContent.trim();
                    }
                  }
                }

                // URL 생성
                let placeUrl = href;
                if (!placeUrl.startsWith('http')) {
                  placeUrl = `https://m.place.naver.com/restaurant/${placeId}`;
                }

                placeLinks.push({
                  placeId,
                  placeName: placeName.substring(0, 100).trim() || `플레이스 ${placeId}`,
                  placeUrl
                });
              }
            });

            // 페이지에서 직접 placeId 찾기 (스크립트 태그나 메타 태그)
            const scripts = document.querySelectorAll('script');
            scripts.forEach(script => {
              const content = script.textContent || script.innerHTML;
              // 다양한 패턴으로 placeId 찾기
              const patterns = [
                /placeId["']?\s*[:=]\s*["']?(\d+)/g,
                /place_id["']?\s*[:=]\s*["']?(\d+)/g,
                /placeId["']?\s*:\s*(\d+)/g,
                /"placeId":\s*(\d+)/g,
                /'placeId':\s*(\d+)/g,
                /placeId=(\d+)/g,
                /\/place\/(\d+)/g,
                /\/restaurant\/(\d+)/g
              ];
              
              patterns.forEach(pattern => {
                const matches = content.match(pattern);
                if (matches) {
                  matches.forEach(match => {
                    const placeId = match.match(/(\d+)/)?.[1];
                    if (placeId && placeId.length >= 6 && !seenIds.has(placeId)) {
                      seenIds.add(placeId);
                      placeLinks.push({
                        placeId,
                        placeName: `플레이스 ${placeId}`,
                        placeUrl: `https://m.place.naver.com/restaurant/${placeId}`
                      });
                    }
                  });
                }
              });
            });

            // body 전체 텍스트에서도 숫자 패턴 찾기 (플레이스 ID는 보통 6자리 이상)
            const bodyText = document.body.innerText;
            const longNumberMatches = bodyText.match(/\d{6,}/g);
            if (longNumberMatches) {
              longNumberMatches.forEach(num => {
                // 네이버 플레이스 ID는 보통 6-10자리
                if (num.length >= 6 && num.length <= 10 && !seenIds.has(num)) {
                  // 실제 플레이스 링크가 있는지 확인
                  const hasLink = Array.from(document.querySelectorAll('a[href]')).some(link => {
                    return link.getAttribute('href')?.includes(num);
                  });
                  
                  if (hasLink) {
                    seenIds.add(num);
                    placeLinks.push({
                      placeId: num,
                      placeName: `플레이스 ${num}`,
                      placeUrl: `https://m.place.naver.com/restaurant/${num}`
                    });
                  }
                }
              });
            }

            // 디버깅: 찾은 링크 수 로깅
            console.log(`[플레이스 추출] 총 ${placeLinks.length}개 플레이스 발견`);

            return placeLinks;
          });

          // 플레이스를 찾았으면 루프 종료
          if (places.length > 0) {
            console.log(`[플레이스 목록] ${places.length}개 플레이스 발견 (${myPlaceUrl})`);
            break;
          }
        } catch (error) {
          console.log(`[플레이스 목록] ${myPlaceUrl} 실패:`, error.message);
          lastError = error;
          continue;
        }
      }

      // 모든 URL 시도 후에도 플레이스를 찾지 못한 경우
      if (places.length === 0) {
        // 페이지 HTML 일부 로깅 (디버깅용)
        try {
          const pageContent = await page.evaluate(() => {
            // 모든 링크 수집
            const allLinks = Array.from(document.querySelectorAll('a[href]')).map(link => ({
              href: link.getAttribute('href'),
              text: link.textContent.trim().substring(0, 50)
            })).slice(0, 20); // 처음 20개만

            return {
              title: document.title,
              url: window.location.href,
              bodyText: document.body.innerText.substring(0, 1000),
              linkCount: document.querySelectorAll('a[href]').length,
              sampleLinks: allLinks,
              hasPlaceKeyword: document.body.innerText.includes('플레이스') || 
                              document.body.innerText.includes('place') ||
                              document.body.innerText.includes('업소')
            };
          });
          console.log('[플레이스 목록] 페이지 정보:', JSON.stringify(pageContent, null, 2));
        } catch (e) {
          console.log('[플레이스 목록] 페이지 정보 추출 실패:', e.message);
        }

        // 페이지 스크린샷 저장 (디버깅용)
        try {
          const screenshot = await page.screenshot({ encoding: 'base64', fullPage: true });
          console.log('[플레이스 목록] 페이지 스크린샷 저장됨 (디버깅용, 길이:', screenshot.length, ')');
        } catch (e) {
          console.log('[플레이스 목록] 스크린샷 저장 실패:', e.message);
        }
      }

      await browser.close();

      if (places.length === 0) {
        return res.status(404).json({
          success: false,
          error: '관리하는 플레이스를 찾을 수 없습니다. 네이버 스마트플레이스에 등록된 업소가 있는지 확인해주세요.'
        });
      }

      console.log(`[플레이스 목록] ${places.length}개 플레이스 발견`);

      res.json({
        success: true,
        places: places
      });

    } catch (error) {
      await browser.close();
      console.error('[플레이스 목록] 로그인 실패:', error);
      
      let errorMessage = '네이버 로그인에 실패했습니다.';
      if (error.message.includes('timeout')) {
        errorMessage = '로그인 시간이 초과되었습니다. 네이버 서버가 느릴 수 있습니다.';
      } else if (error.message.includes('navigation')) {
        errorMessage = '로그인 후 페이지 이동에 실패했습니다. 아이디/비밀번호를 확인해주세요.';
      }

      return res.status(400).json({
        success: false,
        error: errorMessage
      });
    }

  } catch (error) {
    console.error('[플레이스 목록] 오류:', error);
    res.status(500).json({
      success: false,
      error: '플레이스 목록을 가져오는 중 오류가 발생했습니다: ' + error.message
    });
  }
};

