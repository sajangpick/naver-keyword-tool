/**
 * Vercel Cron용 리뷰 모니터링 트리거
 * 
 * Vercel Cron → 이 함수 → Render API 호출
 */

module.exports = async (req, res) => {
    try {
        console.log('[Cron] 리뷰 모니터링 크롤링 시작');
        
        // Render API 호출
        const renderUrl = 'https://naver-keyword-tool.onrender.com/api/review-monitoring';
        
        const response = await fetch(renderUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                action: 'crawl_all'
            })
        });
        
        const result = await response.json();
        
        console.log('[Cron] 크롤링 완료:', result);
        
        res.status(200).json({
            success: true,
            message: 'Review monitoring cron executed',
            result
        });
        
    } catch (error) {
        console.error('[Cron 오류]', error);
        
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

