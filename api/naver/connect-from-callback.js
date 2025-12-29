// 네이버 스마트플레이스 콜백 연동 API
// 사용자가 네이버 로그인 후 돌아왔을 때 호출됩니다

const { createClient } = require('@supabase/supabase-js');
const CryptoJS = require('crypto-js');

// Puppeteer 환경 설정 (Render/Vercel 호환)
const isProduction = process.env.NODE_ENV === 'production';
let chromium, puppeteer;

if (isProduction) {
  chromium = require('@sparticuz/chromium');
  puppeteer = require('puppeteer-core');
} else {
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

// 암호화 키
const ENCRYPTION_KEY = process.env.NAVER_ENCRYPTION_KEY || 'default-key-change-in-production';

// 암호화 함수
function encrypt(text) {
  return CryptoJS.AES.encrypt(text, ENCRYPTION_KEY).toString();
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

    const { placeId, replyTone, callbackUrl } = req.body;

    if (!placeId) {
      return res.status(400).json({
        success: false,
        error: '플레이스 ID가 필요합니다'
      });
    }

    console.log(`[네이버 콜백 연동] 사용자 ${userId} - 플레이스 ID: ${placeId}`);

    // Puppeteer로 스마트플레이스 관리 페이지 접근
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
      // 콜백 URL로 이동 (이미 로그인된 상태)
      await page.goto(callbackUrl || `https://new.smartplace.naver.com/`, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      // 세션 쿠키 가져오기
      const cookies = await page.cookies();
      const sessionCookies = JSON.stringify(cookies);

      // 플레이스 정보 가져오기
      const placeUrl = `https://m.place.naver.com/restaurant/${placeId}`;
      await page.goto(placeUrl, { waitUntil: 'networkidle2', timeout: 30000 });

      // 업소명 추출
      const placeName = await page.evaluate(() => {
        const selectors = [
          'h2._3ocDE',
          'h2[class*="place"]',
          '.place_name',
          'h2',
          '.name',
          '[class*="name"]'
        ];
        
        for (const selector of selectors) {
          const element = document.querySelector(selector);
          if (element && element.textContent.trim()) {
            return element.textContent.trim();
          }
        }
        return '업소명 없음';
      });

      await browser.close();

      // DB에 저장 (계정 정보는 나중에 사용자가 입력하도록)
      const { data: connection, error } = await supabase
        .from('naver_place_connections')
        .upsert({
          user_id: userId,
          session_cookies: sessionCookies,
          place_id: placeId,
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

      console.log(`[네이버 콜백 연동] 사용자 ${userId} 연동 완료 - 플레이스 ID: ${placeId}`);

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
      console.error('[네이버 콜백 연동] 실패:', error);
      
      return res.status(400).json({
        success: false,
        error: '연동 처리 중 오류가 발생했습니다: ' + error.message
      });
    }

  } catch (error) {
    console.error('[네이버 콜백 연동] 오류:', error);
    res.status(500).json({
      success: false,
      error: '연동 중 오류가 발생했습니다: ' + error.message
    });
  }
};

