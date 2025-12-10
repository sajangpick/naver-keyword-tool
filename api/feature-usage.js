/**
 * 기능 사용 기록 API
 * 블로그, 리뷰, 키워드검색, 레시피, 영상 기능 사용 시 기록을 남깁니다.
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

let supabase = null;
if (SUPABASE_URL && SUPABASE_KEY && SUPABASE_URL.trim() !== '' && SUPABASE_KEY.trim() !== '') {
  try {
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  } catch (error) {
    console.error('[feature-usage] Supabase 클라이언트 초기화 실패:', error.message);
  }
}

// User-Agent 파싱 헬퍼 함수
function parseUserAgent(userAgent) {
  if (!userAgent) return { browser: null, browserVersion: null, deviceType: 'desktop' };
  
  const ua = userAgent.toLowerCase();
  
  // 브라우저 감지
  let browser = null;
  let browserVersion = null;
  
  if (ua.includes('chrome') && !ua.includes('edg')) {
    browser = 'Chrome';
    const match = ua.match(/chrome\/([\d.]+)/);
    browserVersion = match ? match[1] : null;
  } else if (ua.includes('safari') && !ua.includes('chrome')) {
    browser = 'Safari';
    const match = ua.match(/version\/([\d.]+)/);
    browserVersion = match ? match[1] : null;
  } else if (ua.includes('firefox')) {
    browser = 'Firefox';
    const match = ua.match(/firefox\/([\d.]+)/);
    browserVersion = match ? match[1] : null;
  } else if (ua.includes('edg')) {
    browser = 'Edge';
    const match = ua.match(/edg\/([\d.]+)/);
    browserVersion = match ? match[1] : null;
  }
  
  // 기기 타입 감지
  let deviceType = 'desktop';
  if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
    deviceType = 'mobile';
  } else if (ua.includes('tablet') || ua.includes('ipad')) {
    deviceType = 'tablet';
  }
  
  return { browser, browserVersion, deviceType };
}

// IP 주소 추출 헬퍼 함수
function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
         req.headers['x-real-ip'] ||
         req.connection?.remoteAddress ||
         req.socket?.remoteAddress ||
         null;
}

module.exports = async (req, res) => {
  // CORS 설정
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: '허용되지 않은 메서드입니다.' });
  }

  try {
    if (!supabase) {
      return res.status(503).json({ error: 'Supabase가 설정되지 않았습니다' });
    }

    // 요청 본문 파싱
    const {
      featureType,      // 'blog', 'review', 'keyword', 'recipe', 'video'
      featureName,      // '블로그', '리뷰', '키워드검색', '레시피', '영상'
      actionType,       // 'create', 'search', 'generate', 'edit' 등
      actionDetails,   // 추가 상세 정보 (JSON)
      pageUrl,
      pageTitle,
    } = req.body || {};

    // 필수 필드 검증
    if (!featureType || !featureName) {
      return res.status(400).json({ 
        error: '필수 필드가 누락되었습니다.',
        required: ['featureType', 'featureName']
      });
    }

    // 사용자 정보 추출 (선택적)
    let userId = null;
    let userEmail = null;
    let userName = null;

    const authHeader = req.headers.authorization;
    console.log('[feature-usage] Authorization 헤더:', authHeader ? '있음' : '없음');
    
    if (authHeader) {
      try {
        const token = authHeader.replace('Bearer ', '');
        console.log('[feature-usage] 토큰 추출:', token ? '성공' : '실패');
        
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        
        if (authError) {
          console.log('[feature-usage] 인증 오류:', authError.message);
        }
        
        if (!authError && user) {
          console.log('[feature-usage] 사용자 찾음:', user.id, user.email);
          userId = user.id;
          userEmail = user.email;
          
          // 프로필에서 이름 가져오기 (profiles 테이블의 id는 auth.users의 id와 동일)
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('id, name, store_name, email')
            .eq('id', user.id)
            .single();
          
          if (profileError) {
            console.log('[feature-usage] 프로필 조회 오류:', profileError.message);
          } else if (profile) {
            console.log('[feature-usage] 프로필 찾음:', profile.name || profile.store_name);
            userName = profile.name || profile.store_name || null;
            // 프로필에 이메일이 더 정확할 수 있음
            if (profile.email && !userEmail) {
              userEmail = profile.email;
            }
          }
        } else {
          console.log('[feature-usage] 사용자를 찾을 수 없음');
        }
      } catch (error) {
        // 인증 실패해도 기록은 남김 (익명 사용자)
        console.log('[feature-usage] 인증 실패 (익명 사용자로 기록):', error.message);
      }
    } else {
      console.log('[feature-usage] Authorization 헤더가 없어 익명으로 기록');
    }
    
    console.log('[feature-usage] 최종 사용자 정보:', { userId, userEmail, userName });

    // 기기 정보 추출
    const userAgent = req.headers['user-agent'] || '';
    const { browser, browserVersion, deviceType } = parseUserAgent(userAgent);
    const ipAddress = getClientIp(req);

    // 현재 페이지 정보
    const currentPageUrl = pageUrl || req.headers.referer || null;
    const currentPageTitle = pageTitle || null;

    // 기록 저장
    const { data, error } = await supabase
      .from('feature_usage_log')
      .insert({
        user_id: userId,
        user_email: userEmail,
        user_name: userName,
        feature_type: featureType,
        feature_name: featureName,
        action_type: actionType || null,
        action_details: actionDetails || {},
        page_url: currentPageUrl,
        page_title: currentPageTitle,
        device_type: deviceType,
        browser: browser,
        browser_version: browserVersion,
        user_agent: userAgent,
        ip_address: ipAddress,
      })
      .select()
      .single();

    if (error) {
      console.error('[feature-usage] 기록 저장 실패:', error);
      return res.status(500).json({ 
        error: '기능 사용 기록 저장 중 오류가 발생했습니다.',
        details: error.message 
      });
    }

    return res.status(200).json({
      success: true,
      data: data,
    });

  } catch (error) {
    console.error('[feature-usage] 예외 발생:', error);
    return res.status(500).json({
      error: error.message || '기능 사용 기록 저장 중 오류가 발생했습니다',
    });
  }
};

