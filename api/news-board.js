const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

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
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('user_id', user.id)
        .single();

      if (!profile || profile.role !== 'admin') {
        return res.status(403).json({ success: false, error: '권한이 없습니다.' });
      }

      const { title, content, category, image_url, source_url, is_featured = false } = req.body;

      if (!title || !content || !category) {
        return res.status(400).json({ success: false, error: '필수 항목을 입력해주세요.' });
      }

      const { data: newNews, error } = await supabase
        .from('news_board')
        .insert([{
          title,
          content,
          category,
          image_url,
          source_url,
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
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('user_id', user.id)
        .single();

      if (!profile || profile.role !== 'admin') {
        return res.status(403).json({ success: false, error: '권한이 없습니다.' });
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
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('user_id', user.id)
        .single();

      if (!profile || profile.role !== 'admin') {
        return res.status(403).json({ success: false, error: '권한이 없습니다.' });
      }

      const { id } = req.query;

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

