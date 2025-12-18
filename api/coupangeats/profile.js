/**
 * 쿠팡이츠 프로필 정보 가져오기 API
 */

const { createClient } = require('@supabase/supabase-js');
const { createBrowser, createPage, safeNavigate } = require('../rpa/browser-controller');
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

    const connection = await getConnection(connectionId);
    if (!connection || connection.platform !== 'coupangeats') {
      return res.status(404).json({
        success: false,
        error: '연동 정보를 찾을 수 없습니다'
      });
    }

    const session = await loadSession(connectionId);
    if (!session || !session.cookies || session.cookies.length === 0) {
      return res.status(400).json({
        success: false,
        error: '세션 정보가 없습니다. 다시 연동해주세요.'
      });
    }

    browser = await createBrowser();
    const page = await createPage(browser, {
      cookies: session.cookies
    });

    // 쿠팡이츠 파트너 센터로 이동
    await safeNavigate(page, 'https://partners.coupang.com/dashboard', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    const profileInfo = await page.evaluate(() => {
      return {
        store_name: document.querySelector('.store-name, h1, [data-store-name]')?.textContent?.trim() || '',
        address: document.querySelector('.address, [data-address]')?.textContent?.trim() || '',
        phone: document.querySelector('.phone, [data-phone]')?.textContent?.trim() || '',
        profile_image: document.querySelector('.store-image img, .profile-image img')?.src || null,
        business_hours: document.querySelector('.business-hours, [data-hours]')?.textContent?.trim() || '',
        category: document.querySelector('.category, [data-category]')?.textContent?.trim() || '',
      };
    });

    await browser.close();

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
      profile: profileInfo
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

