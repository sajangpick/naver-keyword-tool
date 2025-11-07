/**
 * Render 서버 Keep-Alive 크론 작업
 * 
 * Render 무료 플랜은 15분간 요청이 없으면 슬립 모드로 들어갑니다.
 * 이 함수는 Vercel Cron을 통해 주기적으로 Render 서버의 /health 엔드포인트를 호출하여
 * 서버를 깨어 있게 유지합니다.
 */

module.exports = async (req, res) => {
    try {
        console.log('[Keep-Alive] Render 서버 깨우기 시작...');
        
        // Render 서버의 health 엔드포인트 호출
        // vercel.json의 rewrites와 동일한 Render URL 사용
        const renderUrl = 'https://sajangpick-kwon-teamjang.onrender.com/health';
        
        const response = await fetch(renderUrl, {
            method: 'GET',
            headers: {
                'User-Agent': 'Vercel-Cron-KeepAlive/1.0'
            },
            // 타임아웃 설정 (Render가 슬립 모드면 첫 요청이 느릴 수 있음)
            signal: AbortSignal.timeout(30000) // 30초 타임아웃
        });
        
        if (!response.ok) {
            throw new Error(`Render 서버 응답 실패: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        
        console.log('[Keep-Alive] Render 서버 응답:', {
            status: data.status,
            timestamp: data.timestamp,
            environment: data.environment
        });
        
        res.status(200).json({
            success: true,
            message: 'Render 서버 keep-alive 성공',
            renderResponse: {
                status: data.status,
                timestamp: data.timestamp,
                environment: data.environment
            },
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('[Keep-Alive 오류]', error);
        
        // 에러가 발생해도 크론 작업은 계속 실행되도록 함
        res.status(500).json({
            success: false,
            error: error.message,
            message: 'Render 서버 keep-alive 실패 (서버가 슬립 모드일 수 있음)',
            timestamp: new Date().toISOString()
        });
    }
};

