// 네이버 OAuth 콜백에서 쿠키를 받아 연동 처리
// Puppeteer로 스마트플레이스에 접속하여 플레이스 정보를 가져옵니다

const { createClient } = require('@supabase/supabase-js');
const { createBrowser, createPage, safeNavigate, getCookies } = require('../rpa/browser-controller');
const { saveSession, saveAccountCredentials } = require('../rpa/session-manager');

// Puppeteer 환경 설정
const isProduction = process.env.NODE_ENV === 'production';
let chromium, puppeteer;

if (isProduction) {
  chromium = require('@sparticuz/chromium');
  puppeteer = require('puppeteer-core');
} else {
  puppeteer = require('puppeteer');
}

let supabase = null;
if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
  supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

module.exports = async (req, res) => {
  let browser = null;
  
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

    // 쿠키 문자열을 파싱
    const cookieString = req.body.cookies || '';
    
    console.log(`[네이버 OAuth 연동] 사용자 ${userId} 연동 시작`);

    // Puppeteer로 브라우저 실행
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
    
    browser = await puppeteer.launch(launchOptions);
    const page = await browser.newPage();

    // 쿠키 설정 (쿠키 문자열을 파싱하여 설정)
    if (cookieString) {
      try {
        const cookies = cookieString.split(';').map(cookie => {
          const [name, value] = cookie.trim().split('=');
          return { name, value, domain: '.naver.com', path: '/' };
        }).filter(c => c.name && c.value);
        
        await page.setCookie(...cookies);
      } catch (error) {
        console.warn('[네이버 OAuth] 쿠키 설정 실패:', error);
      }
    }

    // 스마트플레이스 관리 페이지로 이동
    await safeNavigate(page, 'https://new.smartplace.naver.com/', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    // 플레이스 ID 추출
    const placeId = await page.evaluate(() => {
      const urlMatch = window.location.href.match(/\/(?:place|restaurant|my-place)\/(\d+)/);
      if (urlMatch) return urlMatch[1];
      
      const placeLink = document.querySelector('a[href*="/place/"], a[href*="/restaurant/"]');
      if (placeLink) {
        const match = placeLink.href.match(/\/(?:place|restaurant)\/(\d+)/);
        if (match) return match[1];
      }
      return null;
    });

    if (!placeId) {
      await browser.close();
      return res.status(400).json({
        success: false,
        error: '플레이스 ID를 찾을 수 없습니다. 스마트플레이스 관리 페이지에 접속할 수 있는지 확인해주세요.'
      });
    }

    // 세션 쿠키 저장
    const cookies = await page.cookies();
    
    // 매장 정보 가져오기
    let placeName = '업소명 없음';
    let storeInfo = {};
    
    try {
      storeInfo = await page.evaluate(() => {
        const nameSelectors = [
          'h2._3ocDE',
          'h2[class*="place"]',
          '.place_name',
          'h2',
          '.name',
          '[class*="name"]'
        ];
        
        let name = '업소명 없음';
        for (const selector of nameSelectors) {
          const element = document.querySelector(selector);
          if (element && element.textContent.trim()) {
            name = element.textContent.trim();
            break;
          }
        }
        
        return {
          name: name,
          address: document.querySelector('.address, [data-address], ._2yqUQ')?.textContent?.trim() || '',
          phone: document.querySelector('.phone, [data-phone], ._3AP_SU')?.textContent?.trim() || '',
        };
      });
      
      placeName = storeInfo.name;
    } catch (error) {
      console.warn('[네이버] 매장 정보 추출 실패:', error);
    }

    await browser.close();
    browser = null;

    // DB에 저장
    const connectionData = {
      user_id: userId,
      platform: 'naver',
      store_id: placeId,
      store_name: placeName,
      session_cookies: JSON.stringify(cookies),
      session_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      address: storeInfo.address,
      phone: storeInfo.phone,
      reply_tone: 'friendly',
      is_active: true,
      last_sync_at: new Date().toISOString(),
    };

    const { data: connection, error: dbError } = await supabase
      .from('platform_connections')
      .insert(connectionData)
      .select()
      .single();

    if (dbError) {
      console.error('DB 저장 실패:', dbError);
      return res.status(500).json({
        success: false,
        error: '연동 정보 저장 실패: ' + dbError.message
      });
    }

    // 세션 저장
    await saveSession(connection.id, cookies, new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));

    console.log(`[네이버 OAuth 연동] 사용자 ${userId} 연동 완료 - 매장: ${placeName}`);

    res.json({
      success: true,
      connection: {
        id: connection.id,
        platform: connection.platform,
        store_id: connection.store_id,
        store_name: connection.store_name,
        reply_tone: connection.reply_tone,
        is_active: connection.is_active
      },
      message: '네이버 스마트플레이스 연동이 완료되었습니다. 리뷰는 10분마다 자동으로 수집됩니다.'
    });

  } catch (error) {
    console.error('[네이버 OAuth 연동] 오류:', error);
    
    if (browser) {
      try {
        await browser.close();
      } catch (e) {}
    }
    
    res.status(500).json({
      success: false,
      error: '연동 중 오류가 발생했습니다: ' + error.message
    });
  }
};

