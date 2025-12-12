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

    const { naverId, naverPassword, placeId, replyTone, smartplaceUrl } = req.body;

    // placeId는 필수, 계정 정보는 선택 (URL 방식 사용 시)
    if (!placeId) {
      return res.status(400).json({
        success: false,
        error: '플레이스 ID가 필요합니다'
      });
    }

    console.log(`[네이버 연동] 사용자 ${userId} 연동 시작 - 플레이스 ID: ${placeId}`);

    // 계정 정보가 있으면 로그인, 없으면 URL만 사용
    let sessionCookies = null;
    let placeName = '업소명 없음';
    let placeUrl = `https://m.place.naver.com/restaurant/${placeId}`;

    if (naverId && naverPassword) {
      // 계정 정보가 있으면 Puppeteer로 로그인
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

        // 스마트플레이스 관리 페이지로 이동
        const myPlaceUrl = smartplaceUrl || 'https://m.place.naver.com/my-place';
        await page.goto(myPlaceUrl, { waitUntil: 'networkidle2', timeout: 30000 });

        // 세션 쿠키 가져오기
        const cookies = await page.cookies();
        sessionCookies = JSON.stringify(cookies);

        // 플레이스 정보 가져오기 (URL에서 추출)
        if (smartplaceUrl) {
          await page.goto(smartplaceUrl, { waitUntil: 'networkidle2', timeout: 30000 });
        } else {
          // 플레이스 페이지로 이동하여 업소명 추출
          const placePageUrl = `https://m.place.naver.com/restaurant/${placeId}`;
          await page.goto(placePageUrl, { waitUntil: 'networkidle2', timeout: 30000 });
        }

        // 업소명 추출
        placeName = await page.evaluate(() => {
          const selectors = ['h2._3ocDE', 'h2[class*="place"]', '.place_name', 'h2', '.name', '[class*="name"]'];
          for (const selector of selectors) {
            const element = document.querySelector(selector);
            if (element && element.textContent.trim()) {
              return element.textContent.trim();
            }
          }
          return '업소명 없음';
        });

        await browser.close();

    } else if (smartplaceUrl) {
      // URL만 제공된 경우 (계정 정보 없음)
      try {
        let launchOptions;
        
        if (isProduction) {
          const executablePath = await chromium.executablePath();
          launchOptions = {
            args: [...chromium.args, '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
            defaultViewport: { width: 1920, height: 1080 },
            executablePath,
            headless: chromium.headless,
          };
        } else {
          launchOptions = {
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
            headless: true,
          };
        }
        
        const browser = await puppeteer.launch(launchOptions);
        const page = await browser.newPage();
        
        await page.goto(smartplaceUrl, { waitUntil: 'networkidle2', timeout: 30000 });
        
        // 세션 쿠키 가져오기 (로그인된 상태면)
        const cookies = await page.cookies();
        if (cookies.length > 0) {
          sessionCookies = JSON.stringify(cookies);
        }
        
        // 업소명 추출
        placeName = await page.evaluate(() => {
          const selectors = ['h2._3ocDE', 'h2[class*="place"]', '.place_name', 'h2', '.name', '[class*="name"]'];
          for (const selector of selectors) {
            const element = document.querySelector(selector);
            if (element && element.textContent.trim()) {
              return element.textContent.trim();
            }
          }
          return '업소명 없음';
        });
        
        await browser.close();
      } catch (error) {
        console.error('[URL 크롤링] 실패:', error);
        // 실패해도 계속 진행
      }
    }

    // 최종 플레이스 정보
    placeUrl = `https://m.place.naver.com/restaurant/${placeId}`;

    // DB에 저장
    const connectionData = {
      user_id: userId,
      session_cookies: sessionCookies,
      place_id: placeId,
      place_name: placeName,
      place_url: placeUrl,
      reply_tone: replyTone || 'friendly',
      is_active: true,
      last_sync_at: new Date().toISOString()
    };

    // 계정 정보가 있으면 암호화해서 저장
    if (naverId && naverPassword) {
      connectionData.naver_id_encrypted = encrypt(naverId);
      connectionData.naver_password_encrypted = encrypt(naverPassword);
    }

      const { data: connection, error } = await supabase
        .from('naver_place_connections')
        .upsert(connectionData, {
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

      // 세션 쿠키가 있으면 첫 리뷰 크롤링 실행 (비동기)
      if (sessionCookies) {
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
      }

    if (error) {
      console.error('DB 저장 실패:', error);
      return res.status(500).json({
        success: false,
        error: '연동 정보 저장 실패: ' + error.message
      });
    }

    // 세션 쿠키가 있으면 첫 리뷰 크롤링 실행 (비동기)
    if (sessionCookies) {
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
    }

    console.log(`[네이버 연동] 사용자 ${userId} 연동 완료 - 플레이스 ID: ${placeId}`);

    res.json({
      success: true,
      connection: {
        id: connection.id,
        place_id: connection.place_id,
        place_name: connection.place_name,
        reply_tone: connection.reply_tone,
        is_active: connection.is_active
      },
      message: sessionCookies ? undefined : '⚠️ 세션 쿠키가 없어 리뷰 크롤링이 제한될 수 있습니다. 나중에 계정 정보를 추가해주세요.'
    });

  } catch (error) {
    console.error('[네이버 연동] 오류:', error);
    res.status(500).json({
      success: false,
      error: '연동 중 오류가 발생했습니다: ' + error.message
    });
  }
};

