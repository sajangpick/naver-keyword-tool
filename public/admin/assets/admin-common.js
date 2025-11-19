/**
 * 관리자 페이지 공통 유틸리티
 * 모든 관리자 페이지에서 사용되는 공통 함수들
 */

(function() {
  'use strict';

  // 전역 AdminCommon 객체
  window.AdminCommon = {
    // 메시지 표시 함수
    showMessage: function(message, type = 'info') {
      console.log(`[${type.toUpperCase()}] ${message}`);
      
      // 메시지 컨테이너 찾기
      const container = document.getElementById('statusMessage') || 
                       document.getElementById('messageContainer') ||
                       document.querySelector('.message-container');
      
      if (container) {
        container.className = type;
        container.innerHTML = `
          ${type === 'error' ? '<i class="fas fa-exclamation-circle"></i>' : 
            type === 'success' ? '<i class="fas fa-check-circle"></i>' : 
            '<i class="fas fa-info-circle"></i>'}
          ${message}
        `;
        container.style.display = 'block';

        // 자동으로 숨김 (에러는 제외)
        if (type !== 'error') {
          setTimeout(() => {
            container.style.display = 'none';
          }, 5000);
        }
      }
    },

    // 로딩 표시
    showLoading: function(show = true) {
      const loader = document.querySelector('.loading') || 
                    document.getElementById('loading');
      if (loader) {
        loader.style.display = show ? 'block' : 'none';
      }
    },

    // 날짜 포맷
    formatDate: function(dateString) {
      if (!dateString) return '-';
      const date = new Date(dateString);
      return date.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
    },

    // 날짜+시간 포맷
    formatDateTime: function(dateString) {
      if (!dateString) return '-';
      const date = new Date(dateString);
      return date.toLocaleString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    },

    // 숫자 포맷 (천 단위 콤마)
    formatNumber: function(number) {
      if (!number && number !== 0) return '-';
      return number.toLocaleString('ko-KR');
    },

    // 금액 포맷
    formatCurrency: function(amount) {
      if (!amount && amount !== 0) return '0원';
      return `${amount.toLocaleString('ko-KR')}원`;
    },

    // API 호출 래퍼
    apiCall: async function(url, options = {}) {
      try {
        const response = await fetch(url, {
          ...options,
          headers: {
            'Content-Type': 'application/json',
            ...options.headers
          }
        });

        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.error || `HTTP ${response.status}`);
        }

        return data;
      } catch (error) {
        console.error('API 호출 실패:', error);
        throw error;
      }
    },

    // 확인 다이얼로그
    confirm: async function(message) {
      return window.confirm(message);
    },

    // 에러 핸들러
    handleError: function(error, defaultMessage = '작업 중 오류가 발생했습니다') {
      console.error('에러:', error);
      const message = error.message || defaultMessage;
      this.showMessage(message, 'error');
      return message;
    },

    // 로컬 스토리지 유틸
    storage: {
      get: function(key) {
        try {
          const value = localStorage.getItem(key);
          return value ? JSON.parse(value) : null;
        } catch (e) {
          return null;
        }
      },
      set: function(key, value) {
        try {
          localStorage.setItem(key, JSON.stringify(value));
          return true;
        } catch (e) {
          return false;
        }
      },
      remove: function(key) {
        localStorage.removeItem(key);
      }
    },

    // 디바운스 함수
    debounce: function(func, wait = 300) {
      let timeout;
      return function executedFunction(...args) {
        const later = () => {
          clearTimeout(timeout);
          func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
      };
    },

    // 쓰로틀 함수
    throttle: function(func, limit = 300) {
      let inThrottle;
      return function(...args) {
        if (!inThrottle) {
          func.apply(this, args);
          inThrottle = true;
          setTimeout(() => inThrottle = false, limit);
        }
      };
    }
  };

  // 전역 함수로도 노출 (하위 호환성)
  window.showMessage = AdminCommon.showMessage.bind(AdminCommon);
  window.showLoading = AdminCommon.showLoading.bind(AdminCommon);
  window.formatDate = AdminCommon.formatDate.bind(AdminCommon);
  window.formatDateTime = AdminCommon.formatDateTime.bind(AdminCommon);
  window.formatNumber = AdminCommon.formatNumber.bind(AdminCommon);
  window.formatCurrency = AdminCommon.formatCurrency.bind(AdminCommon);

  console.log('✅ AdminCommon 유틸리티 로드 완료');
})();

