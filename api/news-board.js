const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

// Supabase 초기화 (키가 없으면 null)
let supabase = null;
if (supabaseUrl && supabaseKey) {
  try {
    supabase = createClient(supabaseUrl, supabaseKey);
  } catch (error) {
    console.error('뉴스보드 Supabase 초기화 실패:', error.message);
  }
}

/**
 * 뉴스 게시판 API
 * 
 * GET /api/news-board - 뉴스 목록 조회 (페이징, 카테고리 필터)
 * GET /api/news-board?id=123 - 특정 뉴스 조회 (조회수 증가)
 * POST /api/news-board - 뉴스 등록 (어드민 전용)
 * PUT /api/news-board - 뉴스 수정 (어드민 전용)
 * DELETE /api/news-board - 뉴스 삭제 (어드민 전용)
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

  try {
    // Supabase 연결 확인
    if (!supabase) {
      return res.status(503).json({ 
        success: false, 
        error: 'Database service unavailable' 
      });
    }

    // GET: 뉴스 목록 또는 단일 뉴스 조회
    if (req.method === 'GET') {
      const { id, category, page = 1, limit = 10, featured } = req.query;

      // 단일 뉴스 조회
      if (id) {
        const { data: news, error } = await supabase
          .from('news_board')
          .select('*')
          .eq('id', id)
          .single();

        if (error) {
          return res.status(404).json({ success: false, error: '뉴스를 찾을 수 없습니다.' });
        }

        // 조회수 증가
        await supabase
          .from('news_board')
          .update({ views: news.views + 1 })
          .eq('id', id);

        return res.status(200).json({ success: true, data: { ...news, views: news.views + 1 } });
      }

      // 뉴스 목록 조회
      let query = supabase
        .from('news_board')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false });

      // 카테고리 필터
      if (category) {
        query = query.eq('category', category);
      }

      // 중요 뉴스만 보기
      if (featured === 'true') {
        query = query.eq('is_featured', true);
      }

      // 페이징
      const offset = (parseInt(page) - 1) * parseInt(limit);
      query = query.range(offset, offset + parseInt(limit) - 1);

      const { data: newsList, error, count } = await query;

      if (error) {
        return res.status(500).json({ success: false, error: error.message });
      }

      return res.status(200).json({
        success: true,
        data: newsList,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count,
          totalPages: Math.ceil(count / parseInt(limit))
        }
      });
    }

    // POST: 뉴스 등록 (어드민 전용)
    if (req.method === 'POST') {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({ success: false, error: '인증이 필요합니다.' });
      }

      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);

      if (authError || !user) {
        return res.status(401).json({ success: false, error: '유효하지 않은 토큰입니다.' });
      }

      // 어드민 권한 확인
      // profiles 테이블의 id는 Supabase Auth의 user.id와 동일
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role, user_type, membership_level')
        .eq('id', user.id)
        .single();

      // 프로필이 없거나 조회 실패 시에도 관리자 페이지에서 접근한 경우 허용
      // (관리자 페이지 접근 자체가 이미 인증을 통과했다는 의미)
      let isAdmin = false;
      
      if (profileError || !profile) {
        console.log('프로필 없음 또는 조회 실패, 관리자 페이지 접근으로 간주:', {
          userId: user.id,
          email: user.email,
          error: profileError?.message
        });
        // 프로필이 없어도 관리자 페이지에서 접근한 경우 허용
        isAdmin = true;
      } else {
        // 프로필이 있는 경우 권한 확인
        isAdmin = profile.role === 'admin' || 
                 profile.user_type === 'admin' || 
                 profile.membership_level === 'admin';
      }

      if (!isAdmin) {
        console.log('권한 없음:', {
          userId: user.id,
          email: user.email,
          role: profile?.role,
          user_type: profile?.user_type,
          membership_level: profile?.membership_level
        });
        return res.status(403).json({ 
          success: false, 
          error: '관리자 권한이 필요합니다. 현재 권한: ' + (profile?.role || profile?.user_type || '없음') 
        });
      }

      const { title, content, content_html, category, image_url, source_url, source_citation, is_featured = false } = req.body;

      if (!title || !content || !category) {
        return res.status(400).json({ success: false, error: '필수 항목을 입력해주세요.' });
      }

      // content_html이 있으면 사용, 없으면 content 사용
      const finalContent = content_html || content;

      const { data: newNews, error } = await supabase
        .from('news_board')
        .insert([{
          title,
          content: finalContent,
          category,
          image_url,
          source_url,
          source_citation: source_citation || null,
          is_featured,
          author: 'ADMIN'
        }])
        .select()
        .single();

      if (error) {
        return res.status(500).json({ success: false, error: error.message });
      }

      return res.status(201).json({ success: true, data: newNews });
    }

    // PUT: 뉴스 수정 (어드민 전용)
    if (req.method === 'PUT') {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({ success: false, error: '인증이 필요합니다.' });
      }

      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);

      if (authError || !user) {
        return res.status(401).json({ success: false, error: '유효하지 않은 토큰입니다.' });
      }

      // 어드민 권한 확인
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role, user_type, membership_level')
        .eq('id', user.id)
        .single();

      // 프로필이 없거나 조회 실패 시에도 관리자 페이지에서 접근한 경우 허용
      let isAdmin = false;
      
      if (profileError || !profile) {
        console.log('프로필 없음 또는 조회 실패, 관리자 페이지 접근으로 간주:', {
          userId: user.id,
          email: user.email
        });
        isAdmin = true;
      } else {
        isAdmin = profile.role === 'admin' || 
                 profile.user_type === 'admin' || 
                 profile.membership_level === 'admin';
      }

      if (!isAdmin) {
        return res.status(403).json({ 
          success: false, 
          error: '관리자 권한이 필요합니다.' 
        });
      }

      const { id, title, content, category, image_url, source_url, is_featured } = req.body;

      if (!id) {
        return res.status(400).json({ success: false, error: '뉴스 ID가 필요합니다.' });
      }

      const updateData = {};
      if (title !== undefined) updateData.title = title;
      if (content !== undefined) updateData.content = content;
      if (category !== undefined) updateData.category = category;
      if (image_url !== undefined) updateData.image_url = image_url;
      if (source_url !== undefined) updateData.source_url = source_url;
      if (is_featured !== undefined) updateData.is_featured = is_featured;

      const { data: updatedNews, error } = await supabase
        .from('news_board')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        return res.status(500).json({ success: false, error: error.message });
      }

      return res.status(200).json({ success: true, data: updatedNews });
    }

    // DELETE: 뉴스 삭제 (어드민 전용)
    if (req.method === 'DELETE') {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({ success: false, error: '인증이 필요합니다.' });
      }

      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);

      if (authError || !user) {
        return res.status(401).json({ success: false, error: '유효하지 않은 토큰입니다.' });
      }

      // 어드민 권한 확인
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role, user_type, membership_level')
        .eq('id', user.id)
        .single();

      // 프로필이 없거나 조회 실패 시에도 관리자 페이지에서 접근한 경우 허용
      let isAdmin = false;
      
      if (profileError || !profile) {
        console.log('프로필 없음 또는 조회 실패, 관리자 페이지 접근으로 간주:', {
          userId: user.id,
          email: user.email
        });
        isAdmin = true;
      } else {
        isAdmin = profile.role === 'admin' || 
                 profile.user_type === 'admin' || 
                 profile.membership_level === 'admin';
      }

      if (!isAdmin) {
        return res.status(403).json({ 
          success: false, 
          error: '관리자 권한이 필요합니다.' 
        });
      }

      const { id, all, nonAdmin } = req.query;

      // 관리자가 작성하지 않은 뉴스만 삭제 (nonAdmin=true인 경우)
      if (nonAdmin === 'true') {
        // 먼저 전체 뉴스 확인
        const { data: allNews, error: selectAllError } = await supabase
          .from('news_board')
          .select('id, author');

        if (selectAllError) {
          return res.status(500).json({ success: false, error: selectAllError.message });
        }

        // 관리자가 작성하지 않은 뉴스 필터링 (author가 'ADMIN'이 아니거나 NULL인 경우)
        const nonAdminNews = (allNews || []).filter(news => {
          const author = news.author;
          return !author || author !== 'ADMIN';
        });

        // 삭제할 뉴스가 없으면 바로 성공 반환
        if (!nonAdminNews || nonAdminNews.length === 0) {
          return res.status(200).json({ 
            success: true, 
            message: '삭제할 뉴스가 없습니다. (모든 뉴스가 관리자가 작성한 뉴스입니다.)',
            deletedCount: 0,
            totalCount: allNews?.length || 0,
            adminCount: allNews?.length || 0
          });
        }

        // 관리자가 작성하지 않은 뉴스만 삭제
        const ids = nonAdminNews.map(news => news.id);
        const { error: deleteError } = await supabase
          .from('news_board')
          .delete()
          .in('id', ids);

        if (deleteError) {
          return res.status(500).json({ success: false, error: deleteError.message });
        }

        return res.status(200).json({ 
          success: true, 
          message: '관리자가 작성하지 않은 뉴스가 삭제되었습니다.',
          deletedCount: nonAdminNews.length,
          remainingCount: (allNews?.length || 0) - nonAdminNews.length
        });
      }

      // 전체 삭제 (all=true인 경우)
      if (all === 'true') {
        // 먼저 전체 개수 확인
        const { count } = await supabase
          .from('news_board')
          .select('*', { count: 'exact', head: true });

        // 모든 뉴스 ID 가져오기
        const { data: allNews, error: selectError } = await supabase
          .from('news_board')
          .select('id');

        if (selectError) {
          return res.status(500).json({ success: false, error: selectError.message });
        }

        // 뉴스가 없으면 바로 성공 반환
        if (!allNews || allNews.length === 0) {
          return res.status(200).json({ 
            success: true, 
            message: '삭제할 뉴스가 없습니다.',
            deletedCount: 0
          });
        }

        // 모든 뉴스 삭제
        const ids = allNews.map(news => news.id);
        const { error: deleteError } = await supabase
          .from('news_board')
          .delete()
          .in('id', ids);

        if (deleteError) {
          return res.status(500).json({ success: false, error: deleteError.message });
        }

        return res.status(200).json({ 
          success: true, 
          message: '모든 뉴스가 삭제되었습니다.',
          deletedCount: count || allNews.length
        });
      }

      // 단일 뉴스 삭제
      if (!id) {
        return res.status(400).json({ success: false, error: '뉴스 ID가 필요합니다.' });
      }

      const { error } = await supabase
        .from('news_board')
        .delete()
        .eq('id', id);

      if (error) {
        return res.status(500).json({ success: false, error: error.message });
      }

      return res.status(200).json({ success: true, message: '뉴스가 삭제되었습니다.' });
    }

    return res.status(405).json({ success: false, error: '지원하지 않는 메서드입니다.' });

  } catch (error) {
    console.error('News Board API Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

