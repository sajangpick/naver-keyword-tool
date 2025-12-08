/**
 * 로그인 기록 저장 API
 * 회원들의 로그인 기록을 데이터베이스에 저장합니다.
 */

const { createClient } = require('@supabase/supabase-js');

// Supabase 클라이언트 초기화
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

let supabase = null;
if (SUPABASE_URL && SUPABASE_KEY && SUPABASE_URL.trim() !== '' && SUPABASE_KEY.trim() !== '') {
  try {
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  } catch (error) {
    console.error('[login-log] Supabase 클라이언트 초기화 실패:', error.message);
  }
}

/**
 * User-Agent에서 브라우저 정보 추출
 */
function parseUserAgent(userAgent) {
  if (!userAgent) {
    return {
      browser: null,
      browserVersion: null,
      os: null,
      osVersion: null,
      deviceType: null,
    };
  }

  const ua = userAgent.toLowerCase();
  let browser = null;
  let browserVersion = null;
  let os = null;
  let osVersion = null;
  let deviceType = 'desktop';

  // 브라우저 감지
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
  } else if (ua.includes('opera') || ua.includes('opr')) {
    browser = 'Opera';
    const match = ua.match(/(?:opera|opr)\/([\d.]+)/);
    browserVersion = match ? match[1] : null;
  }

  // OS 감지
  if (ua.includes('windows')) {
    os = 'Windows';
    const match = ua.match(/windows nt ([\d.]+)/);
    if (match) {
      const version = match[1];
      if (version === '10.0') osVersion = '10/11';
      else if (version === '6.3') osVersion = '8.1';
      else if (version === '6.2') osVersion = '8';
      else if (version === '6.1') osVersion = '7';
      else osVersion = version;
    }
  } else if (ua.includes('mac os x') || ua.includes('macintosh')) {
    os = 'macOS';
    const match = ua.match(/mac os x ([\d_]+)/);
    osVersion = match ? match[1].replace(/_/g, '.') : null;
  } else if (ua.includes('android')) {
    os = 'Android';
    deviceType = 'mobile';
    const match = ua.match(/android ([\d.]+)/);
    osVersion = match ? match[1] : null;
  } else if (ua.includes('iphone') || ua.includes('ipad')) {
    os = 'iOS';
    deviceType = ua.includes('ipad') ? 'tablet' : 'mobile';
    const match = ua.match(/os ([\d_]+)/);
    osVersion = match ? match[1].replace(/_/g, '.') : null;
  } else if (ua.includes('linux')) {
    os = 'Linux';
  }

  return {
    browser,
    browserVersion,
    os,
    osVersion,
    deviceType,
  };
}

/**
 * 클라이언트 IP 주소 추출
 */
function getClientIp(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.headers['x-real-ip'] ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    'unknown'
  );
}

/**
 * 세션 ID 생성 (간단한 해시)
 */
function generateSessionId() {
  return `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

module.exports = async (req, res) => {
  // CORS 설정
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed',
    });
  }

  try {
    if (!supabase) {
      return res.status(503).json({
        success: false,
        error: 'Supabase가 설정되지 않았습니다',
      });
    }

    const {
      userId,
      loginType, // 'auto' 또는 'manual'
      provider, // 'kakao', 'email' 등
      loginSuccess = true,
      errorMessage,
      userEmail,
      userName,
      sessionId,
    } = req.body || {};

    // 필수 필드 검증
    if (!loginType || !provider) {
      return res.status(400).json({
        success: false,
        error: 'loginType과 provider는 필수입니다',
      });
    }

    // User-Agent 파싱
    const userAgent = req.headers['user-agent'] || '';
    const parsedUA = parseUserAgent(userAgent);
    const ipAddress = getClientIp(req);

    // 로그인 기록 저장
    const loginLogData = {
      user_id: userId || null, // 로그인 실패 시 null 가능
      login_type: loginType,
      provider: provider,
      login_success: loginSuccess,
      error_message: errorMessage || null,
      user_email: userEmail || null,
      user_name: userName || null,
      ip_address: ipAddress,
      user_agent: userAgent,
      device_type: parsedUA.deviceType,
      browser: parsedUA.browser,
      browser_version: parsedUA.browserVersion,
      os: parsedUA.os,
      os_version: parsedUA.osVersion,
      session_id: sessionId || generateSessionId(),
    };

    const { data, error } = await supabase
      .from('login_logs')
      .insert([loginLogData])
      .select()
      .single();

    if (error) {
      console.error('[login-log] 저장 실패:', error);
      return res.status(500).json({
        success: false,
        error: '로그인 기록 저장 중 오류가 발생했습니다: ' + error.message,
      });
    }

    console.log('[login-log] ✅ 로그인 기록 저장 완료:', {
      userId: userId || 'anonymous',
      loginType,
      provider,
      loginSuccess,
    });

    return res.status(200).json({
      success: true,
      data: {
        id: data.id,
        createdAt: data.created_at,
      },
    });
  } catch (error) {
    console.error('[login-log] 예외 발생:', error);
    return res.status(500).json({
      success: false,
      error: error.message || '로그인 기록 저장 중 오류가 발생했습니다',
    });
  }
};

