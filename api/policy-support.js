const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

// Supabase 초기화 (키가 없으면 null)
let supabase = null;
if (supabaseUrl && supabaseKey) {
  try {
    supabase = createClient(supabaseUrl, supabaseKey);
  } catch (error) {
    console.error('정책지원금 Supabase 초기화 실패:', error.message);
  }
}

/**
 * 정책지원금 API
 * 
 * GET /api/policy-support - 정책 목록 조회 (페이징, 카테고리 필터)
 * GET /api/policy-support?id=123 - 특정 정책 조회 (조회수 증가)
 * POST /api/policy-support - 정책 등록 (어드민 전용)
 * PUT /api/policy-support - 정책 수정 (어드민 전용)
 * DELETE /api/policy-support - 정책 삭제 (어드민 전용)
 * POST /api/policy-support/bookmark - 북마크 토글
 * POST /api/policy-support/apply - 신청 상태 기록
 */
module.exports = async (req, res) => {
  // CORS 설정
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 경로 처리 (/bookmark, /apply 등)
  const urlPath = req.url?.split('?')[0];
  const isBookmark = urlPath?.endsWith('/bookmark');
  const isApply = urlPath?.endsWith('/apply');
  const isCategories = urlPath?.endsWith('/categories');

  // Supabase 연결 확인
  if (!supabase) {
    return res.status(503).json({ 
      success: false, 
      error: 'Database service unavailable' 
    });
  }

  // GET: 카테고리별 정책 수 조회
  if (req.method === 'GET' && isCategories) {
    try {
      // 쿼리 파라미터에서 필터 조건 가져오기
      const { 
        status, 
        area, 
        business_type, 
        search,
        bookmarked,
        user_id 
      } = req.query;

      // 기본적으로 모든 상태 조회 (필터링되지 않은 전체 통계)
      const statusFilter = status || 'all';

      // 저장된 정책 필터링 처리
      let bookmarkedPolicyIds = [];
      if (bookmarked === 'true' && user_id) {
        const { data: bookmarkedInterests } = await supabase
          .from('user_policy_interests')
          .select('policy_id')
          .eq('user_id', user_id)
          .eq('is_bookmarked', true);
        
        if (bookmarkedInterests && bookmarkedInterests.length > 0) {
          bookmarkedPolicyIds = bookmarkedInterests.map(i => i.policy_id);
        } else {
          // 저장된 정책이 없으면 모든 카테고리 0 반환
          return res.status(200).json({
            success: true,
            data: {
              startup: 0,
              operation: 0,
              employment: 0,
              facility: 0,
              marketing: 0,
              education: 0,
              other: 0
            }
          });
        }
      }

      // 쿼리 구성
      let query = supabase
        .from('policy_supports')
        .select('category', { count: 'exact' });

      // 필터 적용
      if (statusFilter && statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }
      if (area) query = query.contains('target_area', [area]);
      if (business_type) query = query.contains('business_type', [business_type]);
      
      // 저장된 정책만 필터링
      if (bookmarked === 'true' && bookmarkedPolicyIds.length > 0) {
        query = query.in('id', bookmarkedPolicyIds);
      }
      
      // 검색어 적용
      if (search) {
        query = query.or(`title.ilike.%${search}%,summary.ilike.%${search}%,description.ilike.%${search}%`);
      }

      const { data, error } = await query;

      if (error) throw error;

      // 카테고리별 집계
      const categoryCounts = {
        startup: 0,
        operation: 0,
        employment: 0,
        facility: 0,
        marketing: 0,
        education: 0,
        other: 0
      };

      if (data) {
        data.forEach(item => {
          if (item.category && categoryCounts.hasOwnProperty(item.category)) {
            categoryCounts[item.category]++;
          } else if (item.category) {
            // 알 수 없는 카테고리는 'other'에 포함
            categoryCounts.other++;
          }
        });
      }

      return res.status(200).json({
        success: true,
        data: categoryCounts
      });

    } catch (error) {
      console.error('Categories fetch error:', error);
      return res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  }

  // POST: 북마크 토글
  if (req.method === 'POST' && isBookmark) {
    try {
      const token = req.headers.authorization?.split(' ')[1];
      if (!token) {
        return res.status(401).json({ 
          success: false, 
          error: '로그인이 필요합니다.' 
        });
      }

      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (authError || !user) {
        return res.status(401).json({ 
          success: false, 
          error: '유효하지 않은 토큰입니다.' 
        });
      }

      const { policy_id, is_bookmarked } = req.body;

      if (!policy_id) {
        return res.status(400).json({ 
          success: false, 
          error: '정책 ID가 필요합니다.' 
        });
      }

      // 기존 관심 정보 확인
      const { data: existing } = await supabase
        .from('user_policy_interests')
        .select('*')
        .eq('user_id', user.id)
        .eq('policy_id', policy_id)
        .single();

      let result;
      if (existing) {
        // 업데이트
        const { data, error } = await supabase
          .from('user_policy_interests')
          .update({ 
            is_bookmarked: is_bookmarked !== undefined ? is_bookmarked : !existing.is_bookmarked 
          })
          .eq('user_id', user.id)
          .eq('policy_id', policy_id)
          .select()
          .single();
        
        if (error) throw error;
        result = data;
      } else {
        // 새로 생성
        const { data, error } = await supabase
          .from('user_policy_interests')
          .insert({
            user_id: user.id,
            policy_id,
            is_bookmarked: is_bookmarked !== undefined ? is_bookmarked : true
          })
          .select()
          .single();
        
        if (error) throw error;
        result = data;
      }

      return res.status(200).json({
        success: true,
        data: result,
        message: result.is_bookmarked ? '북마크에 추가되었습니다.' : '북마크가 해제되었습니다.'
      });

    } catch (error) {
      console.error('Bookmark toggle error:', error);
      return res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  }

  // POST: 신청 상태 기록
  if (req.method === 'POST' && isApply) {
    try {
      const token = req.headers.authorization?.split(' ')[1];
      if (!token) {
        return res.status(401).json({ 
          success: false, 
          error: '로그인이 필요합니다.' 
        });
      }

      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (authError || !user) {
        return res.status(401).json({ 
          success: false, 
          error: '유효하지 않은 토큰입니다.' 
        });
      }

      const { policy_id, notes } = req.body;

      if (!policy_id) {
        return res.status(400).json({ 
          success: false, 
          error: '정책 ID가 필요합니다.' 
        });
      }

      // Upsert 처리
      const { data, error } = await supabase
        .from('user_policy_interests')
        .upsert({
          user_id: user.id,
          policy_id,
          is_applied: true,
          applied_date: new Date().toISOString().split('T')[0],
          notes
        }, {
          onConflict: 'user_id,policy_id'
        })
        .select()
        .single();

      if (error) throw error;

      return res.status(200).json({
        success: true,
        data,
        message: '신청 상태가 기록되었습니다.'
      });

    } catch (error) {
      console.error('Apply status update error:', error);
      return res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  }

  // GET: 정책 목록 조회 또는 상세 조회
  if (req.method === 'GET') {
  try {
    const { 
      id, 
      category, 
      status,  // 기본값 제거 - 'all'일 때 모든 상태 조회
      area, 
      business_type,
      page = 1, 
      limit = 12,
      search,
      user_id,
      bookmarked  // 저장된 정책만 필터링 (true/false)
    } = req.query;
    
    // status가 없으면 기본값 'active' 사용 (사용자 페이지용)
    // status가 'all'이면 모든 상태 조회 (관리자 페이지용)
    const statusFilter = status || 'active';

    // 단일 정책 조회
    if (id) {
      const { data, error } = await supabase
        .from('policy_supports')
        .select(`
          *,
          user_policy_interests (
            is_bookmarked,
            is_applied,
            applied_date,
            notes
          )
        `)
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        return res.status(404).json({ 
          success: false, 
          error: '정책을 찾을 수 없습니다.' 
        });
      }

      // 조회수 증가
      await supabase
        .from('policy_supports')
        .update({ view_count: data.view_count + 1 })
        .eq('id', id);

      return res.json({ success: true, data });
    }

    // 저장된 정책 필터링 처리
    let bookmarkedPolicyIds = [];
    if (bookmarked === 'true' && user_id) {
      // 저장된 정책 ID 목록 가져오기
      const { data: bookmarkedInterests } = await supabase
        .from('user_policy_interests')
        .select('policy_id')
        .eq('user_id', user_id)
        .eq('is_bookmarked', true);
      
      if (bookmarkedInterests && bookmarkedInterests.length > 0) {
        bookmarkedPolicyIds = bookmarkedInterests.map(i => i.policy_id);
      } else {
        // 저장된 정책이 없으면 빈 결과 반환
        return res.json({
          success: true,
          data: [],
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: 0,
            totalPages: 0
          }
        });
      }
    }

    // 목록 조회 쿼리 구성
    let query = supabase
      .from('policy_supports')
      .select('*', { count: 'exact' });

    // 필터 적용
    if (category) query = query.eq('category', category);
    // status가 'all'이 아니고 값이 있을 때만 필터링
    if (statusFilter && statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }
    if (area) query = query.contains('target_area', [area]);
    if (business_type) query = query.contains('business_type', [business_type]);
    
    // 저장된 정책만 필터링
    if (bookmarked === 'true' && bookmarkedPolicyIds.length > 0) {
      query = query.in('id', bookmarkedPolicyIds);
    }
    
    // 검색어 적용
    if (search) {
      query = query.or(`title.ilike.%${search}%,summary.ilike.%${search}%,description.ilike.%${search}%`);
    }

    // 중요 공지 우선, 최신순 정렬
    query = query
      .order('is_featured', { ascending: false })
      .order('created_at', { ascending: false });

    // 페이지네이션
    const offset = (page - 1) * limit;
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;
    if (error) throw error;

    // 사용자별 관심 정보 추가
    if (user_id && data && data.length > 0) {
      const policyIds = data.map(p => p.id);
      const { data: interests } = await supabase
        .from('user_policy_interests')
        .select('policy_id, is_bookmarked, is_applied')
        .eq('user_id', user_id)
        .in('policy_id', policyIds);

      const interestMap = {};
      interests?.forEach(i => {
        interestMap[i.policy_id] = i;
      });

      data.forEach(policy => {
        policy.user_interest = interestMap[policy.id] || null;
      });
    }

    res.json({
      success: true,
      data,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        totalPages: Math.ceil(count / limit)
      }
    });

  } catch (error) {
    console.error('Policy support fetch error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
  }

  // POST: 새 정책지원금 등록 (인증 선택적 - 로그인 없이도 가능)
  if (req.method === 'POST' && !isBookmark && !isApply) {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    let userId = null;
    
    console.log('📝 정책 등록 요청 - 토큰:', token ? '있음' : '없음');
    
    // 토큰이 있으면 사용자 정보 확인 (선택적)
    if (token) {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (!authError && user) {
          userId = user.id;
          console.log('✅ 사용자 인증 성공:', user.id);
        } else {
          console.log('⚠️ 토큰 검증 실패, 인증 없이 진행');
        }
      } catch (e) {
        // 토큰이 유효하지 않아도 계속 진행
        console.log('⚠️ 토큰 검증 예외, 인증 없이 진행:', e.message);
      }
    } else {
      console.log('ℹ️ 토큰 없음, 인증 없이 진행');
    }

    const {
      title,
      organization,
      category,
      summary,
      description,
      support_amount,
      support_type,
      eligibility_criteria,
      required_documents,
      business_type,
      target_area,
      application_start_date,
      application_end_date,
      application_method,
      application_url,
      contact_info,
      phone_number,
      website_url,
      status,
      is_featured,
      tags
    } = req.body;

    // 필수 필드 검증
    if (!title || !organization || !category || !summary || !description || !eligibility_criteria) {
      return res.status(400).json({ 
        success: false, 
        error: '필수 항목을 모두 입력해주세요.' 
      });
    }

    // 정책지원금 생성
    const insertData = {
      title,
      organization,
      category,
      summary,
      description,
      support_amount,
      support_type,
      eligibility_criteria,
      required_documents,
      business_type: business_type || [],
      target_area: target_area || [],
      application_start_date,
      application_end_date,
      application_method,
      application_url,
      contact_info,
      phone_number,
      website_url,
      status: status || 'active',
      is_featured: is_featured || false,
      tags: tags || []
    };
    
    // created_by는 토큰이 있을 때만 추가 (RLS 정책 고려)
    if (userId) {
      insertData.created_by = userId;
    }
    
    console.log('💾 정책 저장 시도:', { title, userId: userId || 'null' });
    
    const { data, error } = await supabase
      .from('policy_supports')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error('❌ Supabase 저장 오류:', error);
      throw error;
    }

    console.log('✅ 정책 저장 성공:', data.id);
    
    res.json({
      success: true,
      data,
      message: '정책지원금 정보가 등록되었습니다.'
    });

  } catch (error) {
    console.error('Policy support create error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
  }

  // PUT: 정책지원금 정보 수정 (관리자용)
  if (req.method === 'PUT') {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ 
        success: false, 
        error: '인증이 필요합니다.' 
      });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return res.status(401).json({ 
        success: false, 
        error: '유효하지 않은 토큰입니다.' 
      });
    }

    const { id, ...updateData } = req.body;

    if (!id) {
      return res.status(400).json({ 
        success: false, 
        error: '정책 ID가 필요합니다.' 
      });
    }

    // 정책지원금 업데이트
    const { data, error } = await supabase
      .from('policy_supports')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      data,
      message: '정책지원금 정보가 수정되었습니다.'
    });

  } catch (error) {
    console.error('Policy support update error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
  }

  // DELETE: 정책지원금 삭제 (관리자용)
  if (req.method === 'DELETE') {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ 
        success: false, 
        error: '인증이 필요합니다.' 
      });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return res.status(401).json({ 
        success: false, 
        error: '유효하지 않은 토큰입니다.' 
      });
    }

    const { id } = req.query;

    if (!id) {
      return res.status(400).json({ 
        success: false, 
        error: '정책 ID가 필요합니다.' 
      });
    }

    // 정책지원금 삭제
    const { error } = await supabase
      .from('policy_supports')
      .delete()
      .eq('id', id);

    if (error) throw error;

    res.json({
      success: true,
      message: '정책지원금 정보가 삭제되었습니다.'
    });

  } catch (error) {
    console.error('Policy support delete error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
  }
};
