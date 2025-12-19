/**
 * 공통 뒤로가기 버튼 스크립트
 * 모든 페이지에 자동으로 뒤로가기 버튼을 추가
 */

(function() {
  // 이미 추가되었으면 중복 방지
  if (document.getElementById('common-back-button')) return;

  // index.html, login.html, join.html은 제외
  const excludePages = ['index.html', 'login.html', 'join.html'];
  const currentPage = window.location.pathname.split('/').pop();
  if (excludePages.includes(currentPage)) return;

  // 뒤로가기 버튼 스타일
  const style = document.createElement('style');
  style.textContent = `
    #common-back-button {
      position: fixed;
      top: 20px;
      left: 20px;
      z-index: 1000;
      background: white;
      border: 2px solid #e5e7eb;
      border-radius: 12px;
      padding: 12px 20px;
      font-size: 14px;
      font-weight: 600;
      color: #201a17;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
      transition: all 0.3s ease;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      font-family: "Pretendard Variable", Pretendard, -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans KR", Arial, sans-serif;
    }

    #common-back-button:hover {
      background: #f9fafb;
      border-color: #ff7b54;
      transform: translateX(-2px);
    }

    @media (max-width: 768px) {
      #common-back-button {
        top: 10px;
        left: 10px;
        padding: 10px 16px;
        font-size: 13px;
      }
    }
  `;
  document.head.appendChild(style);

  // 뒤로가기 버튼 생성
  const backButton = document.createElement('button');
  backButton.id = 'common-back-button';
  backButton.innerHTML = '<i class="fas fa-arrow-left"></i> 뒤로가기';
  backButton.onclick = function() {
    // 이전 페이지가 있으면 뒤로가기, 없으면 홈으로
    if (window.history.length > 1 && document.referrer) {
      window.history.back();
    } else {
      window.location.href = '/index.html';
    }
  };

  document.body.appendChild(backButton);
})();

