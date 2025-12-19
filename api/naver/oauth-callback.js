// 네이버 OAuth 콜백 처리
// 네이버 로그인 후 이 페이지로 리다이렉트되어 세션 쿠키를 추출합니다

const { createClient } = require('@supabase/supabase-js');
const { createBrowser, createPage, safeNavigate, getCookies } = require('../rpa/browser-controller');
const { saveSession, saveAccountCredentials } = require('../rpa/session-manager');

let supabase = null;
if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
  supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

module.exports = async (req, res) => {
  try {
    // CORS 헤더 설정
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, user-id');

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    if (req.method !== 'GET') {
      return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    const userId = req.query.userId;
    if (!userId) {
      return res.status(400).send(`
        <html>
          <head><title>연동 실패</title></head>
          <body>
            <h1>연동 실패</h1>
            <p>사용자 ID가 필요합니다.</p>
            <script>setTimeout(() => window.location.href = '/mypage.html', 3000);</script>
          </body>
        </html>
      `);
    }

    // 네이버 로그인 후 이 페이지로 리다이렉트됨
    // 스마트플레이스로 이동하여 세션 쿠키를 가져온 후 연동 처리

    // HTML 페이지 반환 (스마트플레이스로 이동 후 세션 추출)
    res.send(`
      <!DOCTYPE html>
      <html lang="ko">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>네이버 연동 중...</title>
        <style>
          body {
            font-family: "Pretendard Variable", Pretendard, -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans KR", Arial, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            background: linear-gradient(135deg, #fff7f0 0%, #ffe8d9 100%);
            margin: 0;
          }
          .container {
            background: white;
            border-radius: 24px;
            padding: 40px;
            max-width: 500px;
            width: 90%;
            text-align: center;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
          }
          .spinner {
            border: 4px solid #ffe8d9;
            border-top: 4px solid #ff7b54;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            animation: spin 1s linear infinite;
            margin: 0 auto 20px;
          }
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          h1 {
            color: #201a17;
            margin-bottom: 16px;
          }
          p {
            color: #7a6a60;
            margin-bottom: 8px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="spinner"></div>
          <h1>네이버 연동 중...</h1>
          <p>플레이스 정보를 가져오고 있습니다.</p>
          <p style="font-size: 12px; color: #9ca3af;">잠시만 기다려주세요.</p>
        </div>
        <script>
          // 네이버 로그인 후 연동 처리
          async function processConnection() {
            try {
              // 서버로 연동 요청 (Puppeteer로 세션 쿠키 추출)
              const response = await fetch('/api/naver/connect-from-oauth', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'user-id': '${userId}'
                },
                body: JSON.stringify({
                  userId: '${userId}'
                })
              });

              const result = await response.json();

              if (result.success) {
                // 성공 - 마이페이지로 이동
                document.querySelector('.container').innerHTML = \`
                  <div style="width: 64px; height: 64px; background: #22c55e; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 24px;">
                    <i class="fas fa-check" style="color: white; font-size: 32px;"></i>
                  </div>
                  <h1 style="color: #201a17; margin-bottom: 16px;">연동 완료!</h1>
                  <p style="color: #7a6a60;">네이버 스마트플레이스 연동이 완료되었습니다.</p>
                  <p style="font-size: 12px; color: #9ca3af; margin-top: 8px;">마이페이지로 이동합니다...</p>
                \`;
                
                setTimeout(() => {
                  window.location.href = '/mypage.html?connected=naver';
                }, 2000);
              } else {
                // 실패 - 에러 메시지 표시
                document.querySelector('.container').innerHTML = \`
                  <h1 style="color: #f44336;">연동 실패</h1>
                  <p>\${result.error || '연동 중 오류가 발생했습니다.'}</p>
                  <button onclick="window.location.href='/mypage.html'" style="
                    margin-top: 20px;
                    padding: 12px 24px;
                    background: #ff7b54;
                    color: white;
                    border: none;
                    border-radius: 8px;
                    cursor: pointer;
                    font-size: 14px;
                    font-weight: 600;
                  ">마이페이지로 돌아가기</button>
                \`;
              }
            } catch (error) {
              console.error('연동 처리 실패:', error);
              document.querySelector('.container').innerHTML = \`
                <h1 style="color: #f44336;">연동 실패</h1>
                <p>연동 처리 중 오류가 발생했습니다.</p>
                <button onclick="window.location.href='/mypage.html'" style="
                  margin-top: 20px;
                  padding: 12px 24px;
                  background: #ff7b54;
                  color: white;
                  border: none;
                  border-radius: 8px;
                  cursor: pointer;
                  font-size: 14px;
                  font-weight: 600;
                ">마이페이지로 돌아가기</button>
              \`;
            }
          }

          // 페이지 로드 시 실행
          window.addEventListener('load', () => {
            setTimeout(processConnection, 1000);
          });
        </script>
      </body>
      </html>
    `);

  } catch (error) {
    console.error('[네이버 OAuth 콜백] 오류:', error);
    res.status(500).send(`
      <html>
        <head><title>연동 실패</title></head>
        <body>
          <h1>연동 실패</h1>
          <p>오류가 발생했습니다: ${error.message}</p>
          <script>setTimeout(() => window.location.href = '/mypage.html', 3000);</script>
        </body>
      </html>
    `);
  }
};

