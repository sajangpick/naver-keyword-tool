/**
 * 쿠팡이츠 연동 API
 * 사용자가 로그인한 후 관리자 페이지 URL을 제공하면 세션을 추출하여 저장
 */

const { createClient } = require('@supabase/supabase-js');
const { createBrowser, createPage, safeNavigate, getCookies, waitAndType, waitAndClick } = require('../rpa/browser-controller');
const { saveSession, saveAccountCredentials } = require('../rpa/session-manager');

// Supabase 클라이언트 초기화
let supabase = null;
if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
  supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

/**
 * URL에서 매장 ID 추출
 */
function extractStoreIdFromUrl(url) {
  try {
    const urlObj = new URL(url);
    // 쿠팡이츠 URL 패턴 분석
    // 예: https://partners.coupang.com/dashboard?storeId=12345
    const storeId = urlObj.searchParams.get('storeId') || 
                    urlObj.searchParams.get('store_id') ||
                    urlObj.pathname.split('/').pop();
    return storeId || 'auto';
  } catch (error) {
    return 'auto';
  }
}

/**
 * 쿠팡이츠 연동
 */
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

    const { accountId, password } = req.body;

    if (!accountId || !password) {
      return res.status(400).json({
        success: false,
        error: '아이디와 비밀번호가 필요합니다'
      });
    }

    console.log(`[쿠팡이츠 연동] 사용자 ${userId} 연동 시작`);

    // 브라우저 실행
    browser = await createBrowser();
    const page = await createPage(browser, {
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });

    // 쿠팡이츠 로그인 페이지로 이동
    await safeNavigate(page, 'https://partners.coupang.com/login', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    // 로그인 폼 입력
    await waitAndType(page, 'input[type="text"], input[name="username"], #username', accountId, { delay: 150 });
    await waitAndType(page, 'input[type="password"], input[name="password"], #password', password, { delay: 150 });
    
    // 로그인 버튼 클릭
    await waitAndClick(page, 'button[type="submit"], button:contains("로그인"), .login-btn', { timeout: 10000 });
    
    // 로그인 완료 대기
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });

    // 세션 쿠키 저장
    const cookies = await getCookies(page);
    
    if (!cookies || cookies.length === 0) {
      await browser.close();
      return res.status(400).json({
        success: false,
        error: '세션 쿠키를 가져올 수 없습니다. 로그인 상태를 확인해주세요.'
      });
    }

    // 매장 정보 가져오기
    let storeName = '매장명 없음';
    let storeInfo = {};
    
    try {
      storeInfo = await page.evaluate(() => {
        const nameSelectors = [
          '.store-name',
          'h1',
          '[data-store-name]',
          '.restaurant-name',
          'title'
        ];
        
        let name = '매장명 없음';
        for (const selector of nameSelectors) {
          const element = document.querySelector(selector);
          if (element && element.textContent.trim()) {
            name = element.textContent.trim();
            break;
          }
        }
        
        return {
          name: name,
          address: document.querySelector('.address, [data-address]')?.textContent?.trim() || '',
          phone: document.querySelector('.phone, [data-phone]')?.textContent?.trim() || '',
        };
      });
      
      storeName = storeInfo.name;
    } catch (error) {
      console.warn('[쿠팡이츠] 매장 정보 추출 실패:', error);
    }

    const storeId = extractStoreIdFromUrl(page.url()) || 'auto';

    await browser.close();
    browser = null;

    // DB에 저장
    const connectionData = {
      user_id: userId,
      platform: 'coupangeats',
      store_id: storeId,
      store_name: storeName,
      session_cookies: JSON.stringify(cookies),
      session_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      address: storeInfo.address,
      phone: storeInfo.phone,
      reply_tone: 'friendly', // 기본값, 나중에 리뷰 자동화 페이지에서 설정
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

    await saveSession(connection.id, cookies, new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));

    // 계정 정보 암호화 저장
    await saveAccountCredentials(connection.id, accountId, password);

    console.log(`[쿠팡이츠 연동] 사용자 ${userId} 연동 완료 - 매장: ${storeName}`);

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
      message: '쿠팡이츠 연동이 완료되었습니다. 리뷰는 10분마다 자동으로 수집됩니다.'
    });

  } catch (error) {
    console.error('[쿠팡이츠 연동] 오류:', error);
    
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

