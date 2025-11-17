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
      const { data, error } = await supabase
        .from('policy_supports')
        .select('category')
        .eq('status', 'active');

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

      data.forEach(item => {
        if (categoryCounts.hasOwnProperty(item.category)) {
          categoryCounts[item.category]++;
        }
      });

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
      status = 'active', 
      area, 
      business_type,
      page = 1, 
      limit = 12,
      search,
      user_id 
    } = req.query;

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

    // 목록 조회 쿼리 구성
    let query = supabase
      .from('policy_supports')
      .select('*', { count: 'exact' });

    // 필터 적용
    if (category) query = query.eq('category', category);
    if (status) query = query.eq('status', status);
    if (area) query = query.contains('target_area', [area]);
    if (business_type) query = query.contains('business_type', [business_type]);
    
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
    
    // 토큰이 있으면 사용자 정보 확인 (선택적)
    if (token) {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (!authError && user) {
          userId = user.id;
        }
      } catch (e) {
        // 토큰이 유효하지 않아도 계속 진행
        console.log('토큰 검증 실패, 인증 없이 진행:', e.message);
      }
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
    const { data, error } = await supabase
      .from('policy_supports')
      .insert({
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
        tags: tags || [],
        created_by: userId || null  // 토큰이 없으면 null
      })
      .select()
      .single();

    if (error) throw error;

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
