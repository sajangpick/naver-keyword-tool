/**
 * 배달의민족 프로필 정보 가져오기 API
 * 연동된 세션을 사용하여 매장 프로필 정보를 가져옵니다
 */

const { createClient } = require('@supabase/supabase-js');
const { createBrowser, createPage, safeNavigate, getCookies } = require('../rpa/browser-controller');
const { loadSession, getConnection } = require('../rpa/session-manager');

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
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, user-id');

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    if (req.method !== 'GET') {
      return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    const connectionId = req.query.connectionId;
    if (!connectionId) {
      return res.status(400).json({
        success: false,
        error: '연동 ID가 필요합니다'
      });
    }

    // 연동 정보 가져오기
    const connection = await getConnection(connectionId);
    if (!connection || connection.platform !== 'baemin') {
      return res.status(404).json({
        success: false,
        error: '연동 정보를 찾을 수 없습니다'
      });
    }

    // 세션 로드
    const session = await loadSession(connectionId);
    if (!session || !session.cookies || session.cookies.length === 0) {
      return res.status(400).json({
        success: false,
        error: '세션 정보가 없습니다. 다시 연동해주세요.'
      });
    }

    // 브라우저 실행 및 프로필 정보 가져오기
    browser = await createBrowser();
    const page = await createPage(browser, {
      cookies: session.cookies
    });

    // 대시보드로 이동 (세션 쿠키 사용)
    const dashboardUrl = connection.store_id !== 'auto' 
      ? `https://ceo.baemin.com/dashboard?storeId=${connection.store_id}`
      : 'https://ceo.baemin.com/dashboard';

    await safeNavigate(page, dashboardUrl, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    // 프로필 정보 추출
    const profileInfo = await page.evaluate(() => {
      return {
        store_name: document.querySelector('.store-name, h1, [data-store-name]')?.textContent?.trim() || '',
        address: document.querySelector('.store-address, [data-address], .address')?.textContent?.trim() || '',
        phone: document.querySelector('.store-phone, [data-phone], .phone')?.textContent?.trim() || '',
        profile_image: document.querySelector('.store-image img, .profile-image img')?.src || null,
        business_hours: document.querySelector('.business-hours, [data-hours]')?.textContent?.trim() || '',
        category: document.querySelector('.category, [data-category]')?.textContent?.trim() || '',
      };
    });

    await browser.close();

    // DB 업데이트
    await supabase
      .from('platform_connections')
      .update({
        store_name: profileInfo.store_name || connection.store_name,
        address: profileInfo.address || connection.address,
        phone: profileInfo.phone || connection.phone,
        profile_image: profileInfo.profile_image || connection.profile_image,
        business_hours: profileInfo.business_hours || connection.business_hours,
        category: profileInfo.category || connection.category,
        updated_at: new Date().toISOString()
      })
      .eq('id', connectionId);

    res.json({
      success: true,
      profile: {
        store_name: profileInfo.store_name,
        address: profileInfo.address,
        phone: profileInfo.phone,
        profile_image: profileInfo.profile_image,
        business_hours: profileInfo.business_hours,
        category: profileInfo.category
      }
    });

  } catch (error) {
    console.error('[프로필 정보 가져오기] 오류:', error);
    
    if (browser) {
      try {
        await browser.close();
      } catch (e) {}
    }
    
    res.status(500).json({
      success: false,
      error: '프로필 정보를 가져오는 중 오류가 발생했습니다: ' + error.message
    });
  }
};

