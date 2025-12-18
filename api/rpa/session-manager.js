/**
 * 세션 관리 모듈
 * 플랫폼별 세션(쿠키) 저장, 로드, 갱신 관리
 * 장사닥터 방식의 세션 미러링 구현
 */

const { createClient } = require('@supabase/supabase-js');
const CryptoJS = require('crypto-js');

// Supabase 클라이언트 초기화
let supabase = null;
if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
  supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

// 암호화 키
const ENCRYPTION_KEY = process.env.PLATFORM_ENCRYPTION_KEY || 
                      process.env.NAVER_ENCRYPTION_KEY || 
                      'default-key-change-in-production';

/**
 * 쿠키 배열을 JSON 문자열로 변환
 * @param {Array} cookies - 쿠키 배열
 * @returns {string} JSON 문자열
 */
function cookiesToJson(cookies) {
  return JSON.stringify(cookies);
}

/**
 * JSON 문자열을 쿠키 배열로 변환
 * @param {string} jsonString - JSON 문자열
 * @returns {Array} 쿠키 배열
 */
function jsonToCookies(jsonString) {
  if (!jsonString) return [];
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    console.error('쿠키 파싱 실패:', error);
    return [];
  }
}

/**
 * 세션 저장
 * @param {string} connectionId - 연동 ID
 * @param {Array} cookies - 쿠키 배열
 * @param {Date} expiresAt - 만료 시간
 * @returns {Promise<boolean>} 성공 여부
 */
async function saveSession(connectionId, cookies, expiresAt = null) {
  try {
    const cookiesJson = cookiesToJson(cookies);
    
    const updateData = {
      session_cookies: cookiesJson,
      updated_at: new Date().toISOString(),
    };
    
    if (expiresAt) {
      updateData.session_expires_at = expiresAt.toISOString();
    }
    
    const { error } = await supabase
      .from('platform_connections')
      .update(updateData)
      .eq('id', connectionId);
    
    if (error) {
      console.error('세션 저장 실패:', error);
      return false;
    }
    
    console.log(`[세션 저장] 연동 ID: ${connectionId}, 쿠키 개수: ${cookies.length}`);
    return true;
  } catch (error) {
    console.error('세션 저장 오류:', error);
    return false;
  }
}

/**
 * 세션 로드
 * @param {string} connectionId - 연동 ID
 * @returns {Promise<Object|null>} 세션 정보 { cookies, expiresAt }
 */
async function loadSession(connectionId) {
  try {
    const { data, error } = await supabase
      .from('platform_connections')
      .select('session_cookies, session_expires_at')
      .eq('id', connectionId)
      .single();
    
    if (error || !data) {
      console.error('세션 로드 실패:', error);
      return null;
    }
    
    const cookies = jsonToCookies(data.session_cookies);
    const expiresAt = data.session_expires_at ? new Date(data.session_expires_at) : null;
    
    return {
      cookies,
      expiresAt,
    };
  } catch (error) {
    console.error('세션 로드 오류:', error);
    return null;
  }
}

/**
 * 세션 만료 확인
 * @param {string} connectionId - 연동 ID
 * @returns {Promise<boolean>} 만료 여부
 */
async function isSessionExpired(connectionId) {
  try {
    const { data, error } = await supabase
      .from('platform_connections')
      .select('session_expires_at, session_cookies')
      .eq('id', connectionId)
      .single();
    
    if (error || !data) {
      return true; // 데이터가 없으면 만료로 간주
    }
    
    // 쿠키가 없으면 만료
    if (!data.session_cookies) {
      return true;
    }
    
    // 만료 시간이 없으면 만료로 간주하지 않음 (수동 확인 필요)
    if (!data.session_expires_at) {
      return false;
    }
    
    const expiresAt = new Date(data.session_expires_at);
    const now = new Date();
    
    // 만료 1시간 전부터 만료로 간주
    const bufferTime = 60 * 60 * 1000; // 1시간
    return now.getTime() >= (expiresAt.getTime() - bufferTime);
  } catch (error) {
    console.error('세션 만료 확인 오류:', error);
    return true;
  }
}

/**
 * 세션 갱신 로그 기록
 * @param {string} connectionId - 연동 ID
 * @param {string} refreshType - 갱신 타입 ('auto', 'manual', 'expired')
 * @param {boolean} success - 성공 여부
 * @param {string} errorMessage - 에러 메시지 (실패 시)
 * @param {Date} oldExpiresAt - 이전 만료 시간
 * @param {Date} newExpiresAt - 새로운 만료 시간
 * @returns {Promise<void>}
 */
async function logSessionRefresh(connectionId, refreshType, success, errorMessage = null, oldExpiresAt = null, newExpiresAt = null) {
  try {
    await supabase
      .from('session_refresh_logs')
      .insert({
        connection_id: connectionId,
        refresh_type: refreshType,
        success,
        error_message: errorMessage,
        old_session_expires_at: oldExpiresAt ? oldExpiresAt.toISOString() : null,
        new_session_expires_at: newExpiresAt ? newExpiresAt.toISOString() : null,
      });
  } catch (error) {
    console.error('세션 갱신 로그 기록 실패:', error);
  }
}

/**
 * 계정 정보 암호화 저장
 * @param {string} connectionId - 연동 ID
 * @param {string} accountId - 계정 ID
 * @param {string} password - 비밀번호
 * @returns {Promise<boolean>} 성공 여부
 */
async function saveAccountCredentials(connectionId, accountId, password) {
  try {
    const encryptedId = CryptoJS.AES.encrypt(accountId, ENCRYPTION_KEY).toString();
    const encryptedPassword = CryptoJS.AES.encrypt(password, ENCRYPTION_KEY).toString();
    
    const { error } = await supabase
      .from('platform_connections')
      .update({
        account_id_encrypted: encryptedId,
        account_password_encrypted: encryptedPassword,
        updated_at: new Date().toISOString(),
      })
      .eq('id', connectionId);
    
    if (error) {
      console.error('계정 정보 저장 실패:', error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('계정 정보 저장 오류:', error);
    return false;
  }
}

/**
 * 계정 정보 복호화 로드
 * @param {string} connectionId - 연동 ID
 * @returns {Promise<Object|null>} { accountId, password }
 */
async function loadAccountCredentials(connectionId) {
  try {
    const { data, error } = await supabase
      .from('platform_connections')
      .select('account_id_encrypted, account_password_encrypted')
      .eq('id', connectionId)
      .single();
    
    if (error || !data || !data.account_id_encrypted) {
      return null;
    }
    
    const accountIdBytes = CryptoJS.AES.decrypt(data.account_id_encrypted, ENCRYPTION_KEY);
    const passwordBytes = CryptoJS.AES.decrypt(data.account_password_encrypted, ENCRYPTION_KEY);
    
    return {
      accountId: accountIdBytes.toString(CryptoJS.enc.Utf8),
      password: passwordBytes.toString(CryptoJS.enc.Utf8),
    };
  } catch (error) {
    console.error('계정 정보 로드 오류:', error);
    return null;
  }
}

/**
 * 연동 정보 가져오기
 * @param {string} connectionId - 연동 ID
 * @returns {Promise<Object|null>} 연동 정보
 */
async function getConnection(connectionId) {
  try {
    const { data, error } = await supabase
      .from('platform_connections')
      .select('*')
      .eq('id', connectionId)
      .single();
    
    if (error || !data) {
      return null;
    }
    
    return data;
  } catch (error) {
    console.error('연동 정보 조회 오류:', error);
    return null;
  }
}

/**
 * 사용자의 모든 활성 연동 정보 가져오기
 * @param {string} userId - 사용자 ID
 * @param {string} platform - 플랫폼 (선택사항)
 * @returns {Promise<Array>} 연동 정보 배열
 */
async function getUserConnections(userId, platform = null) {
  try {
    let query = supabase
      .from('platform_connections')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true);
    
    if (platform) {
      query = query.eq('platform', platform);
    }
    
    const { data, error } = await query.order('created_at', { ascending: false });
    
    if (error) {
      console.error('연동 정보 조회 실패:', error);
      return [];
    }
    
    return data || [];
  } catch (error) {
    console.error('연동 정보 조회 오류:', error);
    return [];
  }
}

module.exports = {
  cookiesToJson,
  jsonToCookies,
  saveSession,
  loadSession,
  isSessionExpired,
  logSessionRefresh,
  saveAccountCredentials,
  loadAccountCredentials,
  getConnection,
  getUserConnections,
};

