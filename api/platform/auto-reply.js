/**
 * 통합 자동 답글 등록 API
 * 모든 플랫폼에서 AI 답글을 생성하고 자동으로 등록
 */

const { createClient } = require('@supabase/supabase-js');
const { createBrowser, createPage, safeNavigate, waitAndClick, waitAndType, getCookies } = require('../rpa/browser-controller');
const { loadSession, getConnection } = require('../rpa/session-manager');
const { generateAIReply } = require('./generate-reply');

let supabase = null;
if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
  supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

/**
 * 네이버 답글 등록
 */
async function postNaverReply(connection, reviewId, replyText) {
  let browser = null;
  
  try {
    const session = await loadSession(connection.id);
    if (!session || !session.cookies || session.cookies.length === 0) {
      throw new Error('세션 정보가 없습니다');
    }

    browser = await createBrowser();
    const page = await createPage(browser, {
      cookies: session.cookies
    });

    // 네이버 리뷰 답글 페이지로 이동
    const replyUrl = `https://m.place.naver.com/my-place/${connection.store_id}/review/${reviewId}`;
    await safeNavigate(page, replyUrl, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    // 답글 입력란 찾기 및 입력
    await waitAndType(page, 'textarea, [contenteditable="true"]', replyText, {
      delay: 50,
      timeout: 10000
    });

    // 등록 버튼 클릭
    await waitAndClick(page, 'button[type="submit"], button:contains("등록"), button:contains("작성")', {
      timeout: 10000
    });

    // 등록 완료 대기
    await page.waitForTimeout(2000);

    await browser.close();
    return true;

  } catch (error) {
    console.error('[네이버 답글 등록] 오류:', error);
    if (browser) {
      try {
        await browser.close();
      } catch (e) {}
    }
    throw error;
  }
}

/**
 * 배달의민족 답글 등록
 */
async function postBaeminReply(connection, reviewId, replyText) {
  let browser = null;
  
  try {
    const session = await loadSession(connection.id);
    if (!session || !session.cookies || session.cookies.length === 0) {
      throw new Error('세션 정보가 없습니다');
    }

    browser = await createBrowser();
    const page = await createPage(browser, {
      cookies: session.cookies
    });

    // 배달의민족 리뷰 답글 페이지로 이동
    const replyUrl = `https://ceo.baemin.com/reviews/${reviewId}/reply`;
    await safeNavigate(page, replyUrl, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    // 답글 입력 및 등록
    await waitAndType(page, 'textarea, [contenteditable="true"]', replyText, {
      delay: 50,
      timeout: 10000
    });

    await waitAndClick(page, 'button[type="submit"], button:contains("등록")', {
      timeout: 10000
    });

    await page.waitForTimeout(2000);

    await browser.close();
    return true;

  } catch (error) {
    console.error('[배달의민족 답글 등록] 오류:', error);
    if (browser) {
      try {
        await browser.close();
      } catch (e) {}
    }
    throw error;
  }
}

/**
 * 통합 자동 답글 등록
 */
module.exports = async (req, res) => {
  try {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, user-id');

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    if (req.method !== 'POST') {
      return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    const { reviewId, connectionId } = req.body;

    if (!reviewId || !connectionId) {
      return res.status(400).json({
        success: false,
        error: '리뷰 ID와 연동 ID가 필요합니다'
      });
    }

    // 리뷰 정보 가져오기
    const { data: review, error: reviewError } = await supabase
      .from('platform_reviews')
      .select('*, platform_connections(*)')
      .eq('id', reviewId)
      .single();

    if (reviewError || !review) {
      return res.status(404).json({
        success: false,
        error: '리뷰를 찾을 수 없습니다'
      });
    }

    const connection = review.platform_connections || await getConnection(connectionId);
    if (!connection) {
      return res.status(404).json({
        success: false,
        error: '연동 정보를 찾을 수 없습니다'
      });
    }

    // 이미 답글이 등록된 경우
    if (review.reply_status === 'posted') {
      return res.status(400).json({
        success: false,
        error: '이미 답글이 등록된 리뷰입니다'
      });
    }

    console.log(`[자동 답글 등록] 시작 - 플랫폼: ${connection.platform}, 리뷰 ID: ${reviewId}`);

    // AI 답글 생성
    const aiReply = await generateAIReply(
      review.content,
      connection.reply_tone || 'friendly',
      connection.store_name
    );

    // 답글 등록
    let posted = false;
    switch (connection.platform) {
      case 'naver':
        posted = await postNaverReply(connection, review.review_id, aiReply);
        break;
      case 'baemin':
        posted = await postBaeminReply(connection, review.review_id, aiReply);
        break;
      default:
        return res.status(400).json({
          success: false,
          error: `지원하지 않는 플랫폼: ${connection.platform}`
        });
    }

    if (posted) {
      // DB 업데이트
      await supabase
        .from('platform_reviews')
        .update({
          reply_status: 'posted',
          ai_reply: aiReply,
          posted_reply: aiReply,
          posted_at: new Date().toISOString()
        })
        .eq('id', reviewId);

      res.json({
        success: true,
        reply: aiReply,
        message: '답글이 성공적으로 등록되었습니다'
      });
    } else {
      throw new Error('답글 등록 실패');
    }

  } catch (error) {
    console.error('[자동 답글 등록] 오류:', error);
    
    // 에러 상태 업데이트
    if (req.body.reviewId) {
      await supabase
        .from('platform_reviews')
        .update({
          reply_status: 'failed',
          reply_error: error.message
        })
        .eq('id', req.body.reviewId);
    }
    
    res.status(500).json({
      success: false,
      error: '답글 등록 중 오류가 발생했습니다: ' + error.message
    });
  }
};

