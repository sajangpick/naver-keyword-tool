// 네이버 스마트플레이스 연동 API
// Puppeteer로 네이버 로그인 후 세션 쿠키 저장

const { createClient } = require('@supabase/supabase-js');
const CryptoJS = require('crypto-js');

// Puppeteer 환경 설정 (Render/Vercel 호환)
const isProduction = process.env.NODE_ENV === 'production';
let chromium, puppeteer;

if (isProduction) {
  // Render/Vercel: @sparticuz/chromium 사용 (경량 Chromium 바이너리)
  chromium = require('@sparticuz/chromium');
  puppeteer = require('puppeteer-core');
} else {
  // 로컬: 일반 puppeteer 사용 (자동 Chrome 다운로드)
  puppeteer = require('puppeteer');
}

// Supabase 클라이언트 초기화
let supabase = null;
if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
  supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

// 암호화 키 (환경변수에서 가져오기)
const ENCRYPTION_KEY = process.env.NAVER_ENCRYPTION_KEY || 'default-key-change-in-production';

// 암호화 함수
function encrypt(text) {
  return CryptoJS.AES.encrypt(text, ENCRYPTION_KEY).toString();
}

// 복호화 함수
function decrypt(encryptedText) {
  const bytes = CryptoJS.AES.decrypt(encryptedText, ENCRYPTION_KEY);
  return bytes.toString(CryptoJS.enc.Utf8);
}

// 플레이스 URL에서 업소명 추출
async function extractPlaceName(placeUrl) {
  let browser = null;
  try {
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
        headless: true,
      };
    }
    
    browser = await puppeteer.launch(launchOptions);
    
    const page = await browser.newPage();
    await page.goto(placeUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    
    // 업소명 추출 시도
    const placeName = await page.evaluate(() => {
      // 여러 선택자 시도
      const selectors = [
        'h2._3ocDE',
        'h2[class*="place"]',
        '.place_name',
        'h2'
      ];
      
      for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element && element.textContent.trim()) {
          return element.textContent.trim();
        }
      }
      return null;
    });
    
    await browser.close();
    return placeName || '업소명 없음';
  } catch (error) {
    console.error('업소명 추출 실패:', error);
    if (browser) {
      try {
        await browser.close();
      } catch (e) {
        // 브라우저 종료 실패는 무시
      }
    }
    return '업소명 없음';
  }
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

    const userId = req.headers['user-id'] || req.body.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: '사용자 ID가 필요합니다' });
    }

    const { naverId, naverPassword, placeId, replyTone } = req.body;

    if (!naverId || !naverPassword) {
      return res.status(400).json({
        success: false,
        error: '네이버 아이디와 비밀번호가 필요합니다'
      });
    }

    console.log(`[네이버 연동] 사용자 ${userId} 연동 시작`);

    // Puppeteer로 네이버 로그인
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
        headless: true,
      };
    }
    
    const browser = await puppeteer.launch(launchOptions);

    const page = await browser.newPage();
    
    try {
      // 네이버 로그인 페이지로 이동
      await page.goto('https://nid.naver.com/nidlogin.login', {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      // 아이디 입력
      await page.waitForSelector('#id', { timeout: 10000 });
      await page.type('#id', naverId, { delay: 100 });

      // 비밀번호 입력
      await page.waitForSelector('#pw', { timeout: 10000 });
      await page.type('#pw', naverPassword, { delay: 100 });

      // 로그인 버튼 클릭
      await page.click('#log\\.login');
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });

      // 로그인 성공 확인 (스마트플레이스 관리자 페이지 접근 시도)
      const myPlaceUrl = 'https://m.place.naver.com/my-place';
      await page.goto(myPlaceUrl, { waitUntil: 'networkidle2', timeout: 30000 });

      // 세션 쿠키 가져오기
      const cookies = await page.cookies();
      const sessionCookies = JSON.stringify(cookies);

      // 플레이스 목록 가져오기
      let places = [];
      try {
        // 플레이스 목록이 있는지 확인
        await page.waitForSelector('a[href*="/restaurant/"], a[href*="/place/"], .place-item, [class*="place"]', {
          timeout: 5000
        });

        // 플레이스 목록 추출
        places = await page.evaluate(() => {
          const placeLinks = [];
          
          // 여러 선택자 시도
          const selectors = [
            'a[href*="/restaurant/"]',
            'a[href*="/place/"]',
            '.place-item a',
            '[class*="place"] a'
          ];

          for (const selector of selectors) {
            const links = document.querySelectorAll(selector);
            links.forEach(link => {
              const href = link.getAttribute('href');
              if (href && (href.includes('/restaurant/') || href.includes('/place/'))) {
                const placeIdMatch = href.match(/(?:restaurant|place)\/(\d+)/);
                if (placeIdMatch && placeIdMatch[1]) {
                  const name = link.textContent.trim() || link.querySelector('span')?.textContent.trim() || '업소명 없음';
                  if (!placeLinks.find(p => p.placeId === placeIdMatch[1])) {
                    placeLinks.push({
                      placeId: placeIdMatch[1],
                      placeName: name,
                      placeUrl: href.startsWith('http') ? href : `https://m.place.naver.com${href}`
                    });
                  }
                }
              }
            });
          }

          return placeLinks;
        });
      } catch (error) {
        console.log('[플레이스 목록] 자동 추출 실패, 수동 입력된 placeId 사용:', error.message);
      }

      await browser.close();

      // placeId가 제공된 경우 해당 플레이스 사용, 없으면 첫 번째 플레이스 사용
      let selectedPlace = null;
      if (placeId) {
        selectedPlace = places.find(p => p.placeId === placeId) || { placeId, placeName: '업소명 없음', placeUrl: `https://m.place.naver.com/restaurant/${placeId}` };
      } else if (places.length > 0) {
        selectedPlace = places[0];
      } else {
        return res.status(400).json({
          success: false,
          error: '관리하는 플레이스를 찾을 수 없습니다. 플레이스 ID를 직접 입력해주세요.'
        });
      }

      const finalPlaceId = selectedPlace.placeId;
      const placeName = selectedPlace.placeName;
      const placeUrl = selectedPlace.placeUrl;

      // DB에 저장
      const encryptedId = encrypt(naverId);
      const encryptedPassword = encrypt(naverPassword);

      const { data: connection, error } = await supabase
        .from('naver_place_connections')
        .upsert({
          user_id: userId,
          naver_id_encrypted: encryptedId,
          naver_password_encrypted: encryptedPassword,
          session_cookies: sessionCookies,
          place_id: finalPlaceId,
          place_name: placeName,
          place_url: placeUrl,
          reply_tone: replyTone || 'friendly',
          is_active: true,
          last_sync_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,place_id'
        })
        .select()
        .single();

      if (error) {
        console.error('DB 저장 실패:', error);
        return res.status(500).json({
          success: false,
          error: '연동 정보 저장 실패: ' + error.message
        });
      }

      // 연동 성공 시 즉시 첫 리뷰 크롤링 실행 (비동기)
      // 크롤링은 백그라운드에서 실행되므로 응답은 먼저 반환
      setTimeout(async () => {
        try {
          const crawlResponse = await fetch(
            `${process.env.RENDER_URL || 'https://naver-keyword-tool.onrender.com'}/api/cron/sync-reviews`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ connectionId: connection.id })
            }
          );
          console.log('[네이버 연동] 첫 리뷰 크롤링 시작:', crawlResponse.status);
        } catch (crawlError) {
          console.error('[네이버 연동] 첫 리뷰 크롤링 실패:', crawlError);
        }
      }, 2000);

      console.log(`[네이버 연동] 사용자 ${userId} 연동 완료 - 플레이스 ID: ${finalPlaceId}`);

      res.json({
        success: true,
        connection: {
          id: connection.id,
          place_id: connection.place_id,
          place_name: connection.place_name,
          reply_tone: connection.reply_tone,
          is_active: connection.is_active
        }
      });

    } catch (error) {
      await browser.close();
      console.error('[네이버 연동] 로그인 실패:', error);
      
      // 로그인 실패 원인 파악
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
    console.error('[네이버 연동] 오류:', error);
    res.status(500).json({
      success: false,
      error: '연동 중 오류가 발생했습니다: ' + error.message
    });
  }
};

