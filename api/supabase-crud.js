// Supabase CRUD (Create, Read, Update, Delete) API
// 로컬에서 Supabase 데이터를 직접 추가/수정/삭제

const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
  try {
    // 환경변수에서 Supabase 정보 가져오기
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({
        success: false,
        error: 'Supabase 환경변수가 설정되지 않았습니다.'
      });
    }

    // Supabase 클라이언트 생성
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { action, table, data, id } = req.body;

    if (!action || !table) {
      return res.status(400).json({
        success: false,
        error: 'action과 table은 필수입니다.'
      });
    }

    console.log(`📊 Supabase ${action.toUpperCase()}: ${table} 테이블`);

    let result;

    // 작업 수행
    switch (action) {
      case 'insert':
        // 데이터 추가
        if (!data) {
          return res.status(400).json({
            success: false,
            error: 'insert 작업에는 data가 필요합니다.'
          });
        }

        result = await supabase
          .from(table)
          .insert(data)
          .select();

        if (result.error) {
          console.error('Insert 오류:', result.error);
          return res.status(500).json({
            success: false,
            error: '데이터 추가 실패',
            details: result.error.message
          });
        }

        console.log(`✅ 데이터 추가 성공: ${result.data?.length || 0}개`);
        return res.json({
          success: true,
          message: '✅ 데이터가 추가되었습니다!',
          data: result.data,
          metadata: {
            action: 'insert',
            table: table,
            count: result.data?.length || 0,
            timestamp: new Date().toISOString()
          }
        });

      case 'update':
        // 데이터 수정
        if (!data || !id) {
          return res.status(400).json({
            success: false,
            error: 'update 작업에는 data와 id가 필요합니다.'
          });
        }

        result = await supabase
          .from(table)
          .update(data)
          .eq('id', id)
          .select();

        if (result.error) {
          console.error('Update 오류:', result.error);
          return res.status(500).json({
            success: false,
            error: '데이터 수정 실패',
            details: result.error.message
          });
        }

        console.log(`✅ 데이터 수정 성공`);
        return res.json({
          success: true,
          message: '✅ 데이터가 수정되었습니다!',
          data: result.data,
          metadata: {
            action: 'update',
            table: table,
            id: id,
            timestamp: new Date().toISOString()
          }
        });

      case 'delete':
        // 데이터 삭제
        if (!id) {
          return res.status(400).json({
            success: false,
            error: 'delete 작업에는 id가 필요합니다.'
          });
        }

        result = await supabase
          .from(table)
          .delete()
          .eq('id', id)
          .select();

        if (result.error) {
          console.error('Delete 오류:', result.error);
          return res.status(500).json({
            success: false,
            error: '데이터 삭제 실패',
            details: result.error.message
          });
        }

        console.log(`✅ 데이터 삭제 성공`);
        return res.json({
          success: true,
          message: '✅ 데이터가 삭제되었습니다!',
          data: result.data,
          metadata: {
            action: 'delete',
            table: table,
            id: id,
            timestamp: new Date().toISOString()
          }
        });

      default:
        return res.status(400).json({
          success: false,
          error: `알 수 없는 action: ${action}`,
          hint: 'action은 insert, update, delete 중 하나여야 합니다.'
        });
    }

  } catch (error) {
    console.error('CRUD API 오류:', error);
    res.status(500).json({
      success: false,
      error: '서버 오류가 발생했습니다.',
      details: error.message
    });
  }
};

