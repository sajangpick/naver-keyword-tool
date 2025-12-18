/**
 * 네이버 스마트플레이스 프로필 정보 가져오기 API
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
    if (!connection || connection.platform !== 'naver') {
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

    // 네이버 스마트플레이스 관리 페이지로 이동
    const placeUrl = connection.place_url || `https://m.place.naver.com/restaurant/${connection.place_id}`;
    await safeNavigate(page, placeUrl, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    const profileInfo = await page.evaluate(() => {
      return {
        place_name: document.querySelector('h2._3ocDE, h2[class*="place"], .place_name, h2')?.textContent?.trim() || '',
        address: document.querySelector('.address, [data-address], ._2yqUQ')?.textContent?.trim() || '',
        phone: document.querySelector('.phone, [data-phone], ._3AP_SU')?.textContent?.trim() || '',
        profile_image: document.querySelector('.place_image img, ._2yqUQ img, [class*="image"] img')?.src || null,
        business_hours: document.querySelector('.business-hours, [data-hours], ._20Iv9')?.textContent?.trim() || '',
        category: document.querySelector('.category, [data-category], ._3ocDE')?.textContent?.trim() || '',
      };
    });

    await browser.close();

    await supabase
      .from('platform_connections')
      .update({
        store_name: profileInfo.place_name || connection.store_name,
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
        place_name: profileInfo.place_name,
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

