/**
 * 기능 사용 기록 추적 헬퍼 함수
 * 블로그, 리뷰, 키워드검색, 레시피, 영상 기능 사용 시 자동으로 기록을 남깁니다.
 */

(function() {
  'use strict';

  /**
   * 기능 사용 기록 남기기
   * @param {string} featureType - 'blog', 'review', 'keyword', 'recipe', 'video'
   * @param {string} featureName - '블로그', '리뷰', '키워드검색', '레시피', '영상'
   * @param {string} actionType - 'create', 'search', 'generate', 'edit' 등
   * @param {object} actionDetails - 추가 상세 정보
   */
  window.trackFeatureUsage = async function(featureType, featureName, actionType = 'use', actionDetails = {}) {
    try {
      // 인증 토큰 가져오기 (선택적)
      let authToken = null;
      try {
        const supabase = window.supabase || (window.supabaseClient ? window.supabaseClient() : null);
        if (supabase) {
          const { data: { session } } = await supabase.auth.getSession();
          authToken = session?.access_token;
        }
      } catch (error) {
        // 인증 실패해도 기록은 남김 (익명 사용자)
        console.log('[feature-usage] 인증 토큰 가져오기 실패 (익명으로 기록):', error.message);
      }

      // 현재 페이지 정보
      const pageUrl = window.location.href;
      const pageTitle = document.title;

      // API 엔드포인트 결정
      const isLocalDev = window.location.hostname === 'localhost' || 
                         window.location.hostname === '127.0.0.1';
      const apiBaseUrl = isLocalDev 
        ? 'http://127.0.0.1:3003'
        : window.location.origin;

      // 요청 본문 구성
      const requestBody = {
        featureType,
        featureName,
        actionType,
        actionDetails,
        pageUrl,
        pageTitle,
      };

      // 헤더 구성
      const headers = {
        'Content-Type': 'application/json',
      };
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      // API 호출 (에러가 나도 사용자 경험에 영향 없도록 조용히 처리)
      fetch(`${apiBaseUrl}/api/feature-usage`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(requestBody),
      }).catch(error => {
        // 조용히 실패 (사용자에게 오류 표시하지 않음)
        console.log('[feature-usage] 기록 저장 실패 (무시됨):', error.message);
      });

    } catch (error) {
      // 조용히 실패 (사용자에게 오류 표시하지 않음)
      console.log('[feature-usage] 기록 추적 오류 (무시됨):', error.message);
    }
  };

  console.log('✅ 기능 사용 기록 추적 헬퍼 로드됨');
})();

