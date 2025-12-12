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

    const { naverId, naverPassword } = req.body;

    if (!naverId || !naverPassword) {
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
      await page.type('#id', naverId, { delay: 100 });
      await page.waitForSelector('#pw', { timeout: 10000 });
      await page.type('#pw', naverPassword, { delay: 100 });
      await page.click('#log\\.login');
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });

      // 스마트플레이스 관리자 페이지로 이동
      const myPlaceUrl = 'https://m.place.naver.com/my-place';
      await page.goto(myPlaceUrl, { waitUntil: 'networkidle2', timeout: 30000 });

      // 플레이스 목록 추출
      let places = [];
      try {
        // 여러 선택자 시도
        await page.waitForSelector('a[href*="/restaurant/"], a[href*="/place/"], .place-item, [class*="place"], .store-item, [data-place-id]', {
          timeout: 10000
        });

        // 잠시 대기 (동적 콘텐츠 로딩)
        await new Promise(resolve => setTimeout(resolve, 2000));

        places = await page.evaluate(() => {
          const placeLinks = [];
          const seenIds = new Set();

          // 여러 선택자 시도
          const selectors = [
            'a[href*="/restaurant/"]',
            'a[href*="/place/"]',
            '.place-item a',
            '[class*="place"] a',
            '.store-item a',
            '[data-place-id]'
          ];

          for (const selector of selectors) {
            const elements = document.querySelectorAll(selector);
            elements.forEach(element => {
              let href = element.getAttribute('href');
              let placeId = null;
              let placeName = null;

              // href에서 placeId 추출
              if (href) {
                const match = href.match(/(?:restaurant|place)\/(\d+)/);
                if (match && match[1]) {
                  placeId = match[1];
                }
              }

              // data-place-id 속성 확인
              if (!placeId) {
                placeId = element.getAttribute('data-place-id') || 
                         element.closest('[data-place-id]')?.getAttribute('data-place-id');
              }

              // placeId가 있으면 추가
              if (placeId && !seenIds.has(placeId)) {
                seenIds.add(placeId);

                // 이름 추출
                placeName = element.textContent.trim() || 
                           element.querySelector('span, .name, [class*="name"]')?.textContent.trim() ||
                           element.getAttribute('title') ||
                           '업소명 없음';

                // URL 생성
                const placeUrl = href && href.startsWith('http') 
                  ? href 
                  : `https://m.place.naver.com/restaurant/${placeId}`;

                placeLinks.push({
                  placeId,
                  placeName: placeName.substring(0, 50), // 최대 50자
                  placeUrl
                });
              }
            });
          }

          return placeLinks;
        });
      } catch (error) {
        console.log('[플레이스 목록] 추출 실패:', error.message);
        // 실패해도 빈 배열 반환
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

