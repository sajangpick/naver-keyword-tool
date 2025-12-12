/**
 * 관리자 기능 사용 기록 조회 API
 * 블로그, 리뷰, 키워드검색, 레시피, 영상 기능 사용 기록을 조회합니다.
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

module.exports = async (req, res) => {
  // CORS 설정
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: '허용되지 않은 메서드입니다.' });
  }

  try {
    // 인증 확인
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: '인증이 필요합니다.' });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({ error: '인증에 실패했습니다.' });
    }

    // 관리자 권한 확인
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('user_type, membership_level, role, email, name')
      .eq('id', user.id)
      .single();

    // 프로필 조회 실패 또는 프로필이 없는 경우
    if (profileError) {
      console.error('[feature-usage] 프로필 조회 실패:', {
        error: profileError.message,
        code: profileError.code,
        details: profileError.details,
        hint: profileError.hint,
        userId: user.id,
        userEmail: user.email
      });
      return res.status(403).json({ 
        error: '관리자 권한이 필요합니다.',
        details: `프로필 조회 실패: ${profileError.message || '프로필을 찾을 수 없습니다'}`,
        debug: {
          userId: user.id,
          userEmail: user.email,
          errorCode: profileError.code
        }
      });
    }

    if (!profile) {
      console.error('[feature-usage] 프로필이 없습니다:', { userId: user.id, userEmail: user.email });
      return res.status(403).json({ 
        error: '관리자 권한이 필요합니다.',
        details: 'profiles 테이블에 해당 사용자의 프로필이 없습니다. 프로필을 먼저 생성해주세요.',
        debug: {
          userId: user.id,
          userEmail: user.email
        }
      });
    }

    // 디버깅: 프로필 정보 로그
    console.log('[feature-usage] 프로필 조회 성공:', {
      userId: user.id,
      userEmail: user.email,
      profile: {
        user_type: profile.user_type,
        membership_level: profile.membership_level,
        role: profile.role,
        email: profile.email,
        name: profile.name
      }
    });

    // user_type, membership_level, role 중 하나라도 'admin'이면 관리자
    const isAdmin = profile.user_type === 'admin' || 
                    profile.membership_level === 'admin' ||
                    profile.role === 'admin';

    if (!isAdmin) {
      console.warn('[feature-usage] 관리자 권한 없음:', { 
        userId: user.id,
        userEmail: user.email,
        user_type: profile.user_type, 
        membership_level: profile.membership_level,
        role: profile.role
      });
      return res.status(403).json({ 
        error: '관리자 권한이 필요합니다.',
        details: `현재 권한: user_type=${profile.user_type || 'null'}, membership_level=${profile.membership_level || 'null'}, role=${profile.role || 'null'}`,
        help: 'profiles 테이블에서 다음 중 하나를 "admin"으로 설정해주세요: user_type, membership_level, role'
      });
    }

    if (!supabase) {
      return res.status(503).json({ error: 'Supabase가 설정되지 않았습니다' });
    }

    // 쿼리 파라미터
    const {
      userId,
      featureType,
      featureName,
      actionType,
      deviceType,
      startDate,
      endDate,
      limit = 100,
      offset = 0,
    } = req.query || {};

    // 쿼리 빌드
    let query = supabase
      .from('feature_usage_log')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    // 필터 적용
    if (userId) {
      query = query.eq('user_id', userId);
    }
    if (featureType) {
      query = query.eq('feature_type', featureType);
    }
    if (featureName) {
      query = query.eq('feature_name', featureName);
    }
    if (actionType) {
      query = query.eq('action_type', actionType);
    }
    if (deviceType) {
      query = query.eq('device_type', deviceType);
    }
    if (startDate) {
      query = query.gte('created_at', startDate);
    }
    if (endDate) {
      query = query.lte('created_at', endDate);
    }

    // 페이지네이션
    query = query.range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error('[feature-usage] 조회 실패:', error);
      return res.status(500).json({ error: '기능 사용 기록 조회 중 오류가 발생했습니다.' });
    }

    return res.status(200).json({
      success: true,
      data: data || [],
      pagination: {
        total: count || 0,
        limit: parseInt(limit),
        offset: parseInt(offset),
      },
    });
  } catch (error) {
    console.error('[feature-usage] 예외 발생:', error);
    return res.status(500).json({
      error: error.message || '기능 사용 기록 조회 중 오류가 발생했습니다',
    });
  }
};

