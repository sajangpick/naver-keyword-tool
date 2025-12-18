/**
 * 통합 리뷰 수집 API
 * 모든 플랫폼에서 리뷰를 수집하여 platform_reviews 테이블에 저장
 */

const { createClient } = require('@supabase/supabase-js');
const { createBrowser, createPage, safeNavigate, getCookies } = require('../rpa/browser-controller');
const { loadSession, getConnection } = require('../rpa/session-manager');

let supabase = null;
if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
  supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

/**
 * 네이버 리뷰 수집
 */
async function collectNaverReviews(connection) {
  let browser = null;
  const reviews = [];
  
  try {
    const session = await loadSession(connection.id);
    if (!session || !session.cookies || session.cookies.length === 0) {
      console.warn(`[네이버] 세션 없음 - connectionId: ${connection.id}`);
      return reviews;
    }

    browser = await createBrowser();
    const page = await createPage(browser, {
      cookies: session.cookies
    });

    // 네이버 스마트플레이스 리뷰 페이지로 이동
    const reviewsUrl = `https://m.place.naver.com/my-place/${connection.store_id}/review`;
    await safeNavigate(page, reviewsUrl, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    // 리뷰 목록 추출
    const reviewData = await page.evaluate(() => {
      const reviews = [];
      // 네이버 리뷰 구조에 맞게 선택자 수정 필요
      const reviewElements = document.querySelectorAll('.review-item, [class*="review"]');
      
      reviewElements.forEach((el, index) => {
        const reviewId = el.getAttribute('data-review-id') || 
                        el.querySelector('[data-id]')?.getAttribute('data-id') ||
                        `naver_${Date.now()}_${index}`;
        
        const reviewerName = el.querySelector('.reviewer-name, [class*="name"]')?.textContent?.trim() || '익명';
        const content = el.querySelector('.review-content, [class*="content"]')?.textContent?.trim() || '';
        const rating = parseFloat(el.querySelector('.rating, [class*="rating"]')?.textContent?.match(/\d+/)?.[0] || '0');
        const reviewDate = el.querySelector('.review-date, [class*="date"]')?.textContent?.trim() || '';
        
        if (content) {
          reviews.push({
            review_id: reviewId,
            reviewer_name: reviewerName,
            content,
            rating: rating || null,
            review_date: reviewDate
          });
        }
      });
      
      return reviews;
    });

    // DB에 저장
    for (const review of reviewData) {
      const { error } = await supabase
        .from('platform_reviews')
        .upsert({
          connection_id: connection.id,
          review_id: review.review_id,
          platform: 'naver',
          reviewer_name: review.reviewer_name,
          content: review.content,
          rating: review.rating,
          review_date: review.review_date ? new Date(review.review_date) : new Date(),
          reply_status: 'pending'
        }, {
          onConflict: 'connection_id,review_id'
        });
      
      if (!error) {
        reviews.push(review);
      }
    }

    await browser.close();
    return reviews;

  } catch (error) {
    console.error(`[네이버 리뷰 수집] 오류:`, error);
    if (browser) {
      try {
        await browser.close();
      } catch (e) {}
    }
    return reviews;
  }
}

/**
 * 배달의민족 리뷰 수집
 */
async function collectBaeminReviews(connection) {
  let browser = null;
  const reviews = [];
  
  try {
    const session = await loadSession(connection.id);
    if (!session || !session.cookies || session.cookies.length === 0) {
      console.warn(`[배달의민족] 세션 없음 - connectionId: ${connection.id}`);
      return reviews;
    }

    browser = await createBrowser();
    const page = await createPage(browser, {
      cookies: session.cookies
    });

    // 배달의민족 리뷰 페이지로 이동
    const reviewsUrl = `https://ceo.baemin.com/reviews`;
    await safeNavigate(page, reviewsUrl, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    // 리뷰 목록 추출 (실제 페이지 구조에 맞게 수정 필요)
    const reviewData = await page.evaluate(() => {
      const reviews = [];
      const reviewElements = document.querySelectorAll('.review-item, [class*="review"]');
      
      reviewElements.forEach((el, index) => {
        const reviewId = el.getAttribute('data-review-id') || `baemin_${Date.now()}_${index}`;
        const reviewerName = el.querySelector('.reviewer-name')?.textContent?.trim() || '익명';
        const content = el.querySelector('.review-content')?.textContent?.trim() || '';
        const rating = parseFloat(el.querySelector('.rating')?.textContent?.match(/\d+/)?.[0] || '0');
        
        if (content) {
          reviews.push({
            review_id: reviewId,
            reviewer_name: reviewerName,
            content,
            rating: rating || null
          });
        }
      });
      
      return reviews;
    });

    // DB에 저장
    for (const review of reviewData) {
      const { error } = await supabase
        .from('platform_reviews')
        .upsert({
          connection_id: connection.id,
          review_id: review.review_id,
          platform: 'baemin',
          reviewer_name: review.reviewer_name,
          content: review.content,
          rating: review.rating,
          review_date: new Date(),
          reply_status: 'pending'
        }, {
          onConflict: 'connection_id,review_id'
        });
      
      if (!error) {
        reviews.push(review);
      }
    }

    await browser.close();
    return reviews;

  } catch (error) {
    console.error(`[배달의민족 리뷰 수집] 오류:`, error);
    if (browser) {
      try {
        await browser.close();
      } catch (e) {}
    }
    return reviews;
  }
}

/**
 * 통합 리뷰 수집 (모든 플랫폼)
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

    const connectionId = req.body.connectionId;
    if (!connectionId) {
      return res.status(400).json({
        success: false,
        error: '연동 ID가 필요합니다'
      });
    }

    // 연동 정보 가져오기
    const connection = await getConnection(connectionId);
    if (!connection) {
      return res.status(404).json({
        success: false,
        error: '연동 정보를 찾을 수 없습니다'
      });
    }

    console.log(`[리뷰 수집] 시작 - 플랫폼: ${connection.platform}, 연동 ID: ${connectionId}`);

    let collectedReviews = [];

    // 플랫폼별 리뷰 수집
    switch (connection.platform) {
      case 'naver':
        collectedReviews = await collectNaverReviews(connection);
        break;
      case 'baemin':
        collectedReviews = await collectBaeminReviews(connection);
        break;
      case 'yogiyo':
        // TODO: 요기요 리뷰 수집 구현
        break;
      case 'coupangeats':
        // TODO: 쿠팡이츠 리뷰 수집 구현
        break;
      default:
        return res.status(400).json({
          success: false,
          error: `지원하지 않는 플랫폼: ${connection.platform}`
        });
    }

    // 마지막 수집 시간 업데이트
    await supabase
      .from('platform_connections')
      .update({
        last_sync_at: new Date().toISOString(),
        last_review_collected_at: new Date().toISOString()
      })
      .eq('id', connectionId);

    res.json({
      success: true,
      collected: collectedReviews.length,
      reviews: collectedReviews
    });

  } catch (error) {
    console.error('[리뷰 수집] 오류:', error);
    res.status(500).json({
      success: false,
      error: '리뷰 수집 중 오류가 발생했습니다: ' + error.message
    });
  }
};

