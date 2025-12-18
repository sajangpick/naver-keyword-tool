/**
 * 자동 리뷰 답글 스케줄러
 * 주기적으로 리뷰를 수집하고 AI 답글을 자동으로 등록
 */

const { createClient } = require('@supabase/supabase-js');
const collectReviews = require('../platform/collect-reviews');
const autoReply = require('../platform/auto-reply');

let supabase = null;
if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
  supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

/**
 * 자동 리뷰 답글 처리
 */
module.exports = async (req, res) => {
  try {
    // CORS 헤더
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    console.log('[자동 리뷰 답글] 스케줄러 시작');

    // 활성화된 모든 연동 가져오기
    const { data: connections, error: connError } = await supabase
      .from('platform_connections')
      .select('*')
      .eq('is_active', true)
      .eq('auto_reply_enabled', true);

    if (connError) {
      throw new Error('연동 정보 조회 실패: ' + connError.message);
    }

    if (!connections || connections.length === 0) {
      console.log('[자동 리뷰 답글] 활성화된 연동 없음');
      return res.json({
        success: true,
        message: '활성화된 연동이 없습니다',
        processed: 0
      });
    }

    let totalProcessed = 0;
    let totalReplied = 0;

    // 각 연동별로 처리
    for (const connection of connections) {
      try {
        console.log(`[자동 리뷰 답글] 처리 중 - 플랫폼: ${connection.platform}, 연동 ID: ${connection.id}`);

        // 1. 리뷰 수집 (API 호출)
        try {
          const collectModule = require('../platform/collect-reviews');
          const mockReq = {
            method: 'POST',
            body: { connectionId: connection.id }
          };
          const mockRes = {
            json: (data) => data,
            status: (code) => ({ json: (data) => data }),
            setHeader: () => {}
          };
          
          await collectModule(mockReq, mockRes);
          console.log(`[자동 리뷰 답글] 리뷰 수집 완료 - 연동 ID: ${connection.id}`);
        } catch (collectError) {
          console.error(`[자동 리뷰 답글] 리뷰 수집 실패 - 연동 ID: ${connection.id}`, collectError);
        }

        // 답글 대기 중인 리뷰 가져오기
        const { data: newReviews } = await supabase
          .from('platform_reviews')
          .select('*')
          .eq('connection_id', connection.id)
          .eq('reply_status', 'pending')
          .order('review_date', { ascending: false })
          .limit(10);

        if (!newReviews || newReviews.length === 0) {
          console.log(`[자동 리뷰 답글] 답글 대기 중인 리뷰 없음 - 연동 ID: ${connection.id}`);
          continue;
        }

        // 2. 각 리뷰에 대해 AI 답글 생성 및 등록
        for (const review of newReviews) {
          try {
            // AI 답글 생성
            const { generateAIReply } = require('../platform/generate-reply');
            const aiReply = await generateAIReply(
              review.content,
              connection.reply_tone || 'friendly',
              connection.store_name
            );

            // 답글 등록 (auto-reply API 직접 호출)
            const autoReplyModule = require('../platform/auto-reply');
            const replyReq = {
              method: 'POST',
              body: {
                reviewId: review.id,
                connectionId: connection.id
              }
            };
            const replyRes = {
              json: (data) => data,
              status: (code) => ({ json: (data) => data }),
              setHeader: () => {}
            };

            const replyResult = await autoReplyModule(replyReq, replyRes);

            if (replyResult.success) {
              totalReplied++;
              console.log(`[자동 리뷰 답글] 답글 등록 성공 - 리뷰 ID: ${review.id}`);
            }

            totalProcessed++;

            // Rate limiting: 리뷰당 2초 대기
            await new Promise(resolve => setTimeout(resolve, 2000));

          } catch (reviewError) {
            console.error(`[자동 리뷰 답글] 리뷰 처리 실패 - 리뷰 ID: ${review.id}`, reviewError);
            
            // 에러 상태 업데이트
            await supabase
              .from('platform_reviews')
              .update({
                reply_status: 'failed',
                reply_error: reviewError.message
              })
              .eq('id', review.id);
          }
        }

        // 마지막 처리 시간 업데이트
        await supabase
          .from('platform_connections')
          .update({
            last_sync_at: new Date().toISOString()
          })
          .eq('id', connection.id);

      } catch (connectionError) {
        console.error(`[자동 리뷰 답글] 연동 처리 실패 - 연동 ID: ${connection.id}`, connectionError);
        
        // 에러 카운트 증가
        await supabase
          .from('platform_connections')
          .update({
            error_count: (connection.error_count || 0) + 1,
            last_error: connectionError.message,
            last_error_at: new Date().toISOString()
          })
          .eq('id', connection.id);
      }
    }

    console.log(`[자동 리뷰 답글] 완료 - 처리: ${totalProcessed}, 답글 등록: ${totalReplied}`);

    res.json({
      success: true,
      processed: totalProcessed,
      replied: totalReplied,
      connections: connections.length
    });

  } catch (error) {
    console.error('[자동 리뷰 답글] 스케줄러 오류:', error);
    res.status(500).json({
      success: false,
      error: '자동 리뷰 답글 처리 중 오류가 발생했습니다: ' + error.message
    });
  }
};

