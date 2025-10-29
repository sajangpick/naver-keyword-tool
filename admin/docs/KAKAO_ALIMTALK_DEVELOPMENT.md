# 📱 카카오 알림톡 개발 가이드

> 리뷰 모니터링 시스템의 알림 - 카카오 알림톡 연동 가이드

---

## 📋 목차

1. [현재 상태](#현재-상태)
2. [카카오 알림톡이란](#카카오-알림톡이란)
3. [사전 준비](#사전-준비)
4. [템플릿 등록](#템플릿-등록)
5. [API 연동](#api-연동)
6. [테스트](#테스트)
7. [배포](#배포)
8. [문제 해결](#문제-해결)

---

## 🎯 현재 상태

### 작동 중인 것
- ✅ 카카오 로그인 (Supabase 연동)
- ✅ 사용자 카카오 ID 저장 (profiles.kakao_id)
- ✅ 리뷰 수집 및 알림 조건 판별
- ✅ `api/kakao-alimtalk.js` 파일 생성 (준비 완료)

### 개발 필요
- ⏳ **카카오 비즈니스 채널 생성** (사용자 작업)
- ⏳ **알림톡 템플릿 3개 등록 및 승인** (사용자 작업)
- ⏳ **API 함수 구현** (`api/kakao-alimtalk.js`)
  - `sendUrgentReviewAlert()` - 긴급 리뷰 알림
  - `sendHighRatingAlert()` - 고평점 리뷰 알림
  - `sendDailySummary()` - 일일 요약 리포트

---

## 📚 카카오 알림톡이란?

### 알림톡 vs 친구톡 vs 나에게 보내기

| 구분 | 알림톡 | 친구톡 | 나에게 보내기 |
|------|--------|--------|---------------|
| 용도 | 공식 비즈니스 알림 | 마케팅 메시지 | 개발 테스트 |
| 승인 | **템플릿 사전 승인 필수** | 템플릿 승인 필요 | 승인 불필요 |
| 비용 | 8-15원/건 | 7-12원/건 | **무료** |
| 수신 | 모든 사용자 | 친구 추가한 사용자만 | 본인만 |
| 신뢰도 | ⭐⭐⭐⭐⭐ 매우 높음 | ⭐⭐⭐ 보통 | - |
| 수신율 | 99% | 90% | 100% |

### 우리 프로젝트: 알림톡 사용

**이유:**
1. ✅ 공식 비즈니스 알림 (신뢰도 높음)
2. ✅ 긴급 리뷰 알림에 적합
3. ✅ 친구 추가 불필요 (모든 사용자에게 발송 가능)
4. ✅ 높은 수신율

---

## 🚀 사전 준비

### 1단계: 카카오 비즈니스 채널 생성 ⏳

**현재 상태:** 이미 생성됨 ✅

**확인 방법:**
1. https://center-pf.kakao.com/ 접속
2. 로그인
3. 채널 목록에서 "사장픽" 채널 확인

**만약 없다면:**
1. "채널 만들기" 클릭
2. 채널명: 사장픽
3. 프로필 이미지 업로드
4. 검색 허용: ON
5. 완료

### 2단계: 알림톡 사용 신청

1. 카카오 비즈니스 센터: https://business.kakao.com/
2. 좌측 메뉴: **비즈메시지 > 알림톡**
3. "알림톡 사용 신청" 클릭
4. 사업자 정보 입력
5. 사업자등록증 업로드
6. 제출 → **승인 대기 (1-3일)**

### 3단계: 발신 프로필 등록

1. 알림톡 관리 화면
2. "발신 프로필 등록"
3. 앞서 만든 채널 선택
4. 카테고리: "IT/인터넷" 또는 "음식점"
5. 완료

---

## 📝 템플릿 등록

### 템플릿이란?

- 알림톡은 **사전에 승인받은 템플릿**만 발송 가능
- 템플릿은 **변수 치환** 방식 (예: `#{store_name}`)
- 승인까지 **1-3일** 소요

### 필요한 템플릿 (3개)

#### 📌 템플릿 1: 긴급 리뷰 알림 (저평점)

**템플릿 코드:** `urgent_review_alert`

**템플릿 내용:**
```
[사장픽] 긴급 리뷰 알림 🚨

#{store_name}에 #{rating}점 리뷰가 등록되었습니다.

📝 리뷰 내용:
#{review_content}

👤 작성자: #{reviewer_name}
📅 작성 시간: #{reviewed_at}

즉시 확인하고 대응하세요!

[리뷰 확인하기]
```

**변수:**
- `#{store_name}` - 가게명 (예: "맛있는 식당")
- `#{rating}` - 평점 (예: "1", "2")
- `#{review_content}` - 리뷰 내용 (최대 500자)
- `#{reviewer_name}` - 작성자명 (예: "김철수")
- `#{reviewed_at}` - 작성 시간 (예: "2025-10-30 14:32")

**버튼:**
- 버튼명: "리뷰 확인하기"
- 버튼 타입: 웹 링크
- URL: `#{place_url}`

**카테고리:** 알림

---

#### 📌 템플릿 2: 고평점 리뷰 알림

**템플릿 코드:** `high_rating_alert`

**템플릿 내용:**
```
[사장픽] 칭찬 리뷰 도착! 🎉

#{store_name}에 #{rating}점 리뷰가 등록되었습니다.

📝 리뷰 내용:
#{review_content}

👤 작성자: #{reviewer_name}
📅 작성 시간: #{reviewed_at}

감사 댓글을 남겨보세요!

[리뷰 확인하기]
```

**변수:** (템플릿 1과 동일)

**버튼:**
- 버튼명: "리뷰 확인하기"
- 버튼 타입: 웹 링크
- URL: `#{place_url}`

**카테고리:** 알림

---

#### 📌 템플릿 3: 일일 요약 리포트

**템플릿 코드:** `daily_summary`

**템플릿 내용:**
```
[사장픽] 오늘의 리뷰 요약 📊

#{store_name}
기간: #{start_date} ~ #{end_date}

📈 통계:
- 총 리뷰: #{total_count}개
- 평균 평점: #{avg_rating}점
- 긴급 리뷰: #{urgent_count}개
- 고평점 리뷰: #{high_rating_count}개

[자세히 보기]
```

**변수:**
- `#{store_name}` - 가게명
- `#{start_date}` - 시작일 (예: "2025-10-30")
- `#{end_date}` - 종료일
- `#{total_count}` - 총 리뷰 수
- `#{avg_rating}` - 평균 평점 (예: "4.5")
- `#{urgent_count}` - 긴급 리뷰 수
- `#{high_rating_count}` - 고평점 리뷰 수

**버튼:**
- 버튼명: "자세히 보기"
- 버튼 타입: 웹 링크
- URL: `https://www.sajangpick.co.kr/mypage.html`

**카테고리:** 알림

---

### 템플릿 등록 방법

1. **카카오 비즈니스 센터** 접속
2. **비즈메시지 > 알림톡 > 템플릿 관리**
3. **"템플릿 등록"** 클릭
4. **템플릿 정보 입력**
   - 템플릿명: 긴급 리뷰 알림
   - 템플릿 코드: `urgent_review_alert`
   - 카테고리: 알림
   - 내용: 위 내용 복사
5. **변수 설정**
   - `#{store_name}` 등록
   - 타입: 문자열
   - 최대 길이: 50자
6. **버튼 추가**
   - "리뷰 확인하기" 추가
   - 웹 링크: `#{place_url}`
7. **검수 제출**
8. **승인 대기** (1-3일)

**3개 템플릿 모두 반복**

---

## 🛠️ API 연동

### 1단계: 환경변수 설정

**`.env` 파일에 추가:**

```env
# 카카오 알림톡 API
KAKAO_REST_API_KEY=your_rest_api_key_here
KAKAO_ADMIN_KEY=your_admin_key_here
KAKAO_SENDER_KEY=your_sender_key_here

# 템플릿 코드 (승인 후 받음)
KAKAO_TEMPLATE_URGENT=urgent_review_alert
KAKAO_TEMPLATE_HIGH_RATING=high_rating_alert
KAKAO_TEMPLATE_DAILY_SUMMARY=daily_summary
```

**키 발급 위치:**
- **REST API Key**: https://developers.kakao.com/console/app
- **SENDER_KEY**: 카카오 비즈니스 센터 > 알림톡 > 발신 프로필

### 2단계: API 함수 구현

**파일 수정:** `api/kakao-alimtalk.js`

```javascript
const axios = require('axios');

const KAKAO_API_URL = 'https://kapi.kakao.com/v2/api/talk/memo/send';
const KAKAO_ALIMTALK_URL = 'https://kapi.kakao.com/v1/api/talk/alimtalk/send';

/**
 * 긴급 리뷰 알림 발송
 */
async function sendUrgentReviewAlert(userId, alertData) {
  try {
    console.log('[알림톡 발송] 긴급 리뷰:', alertData.id);
    
    // Supabase에서 사용자의 카카오 ID 가져오기
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    
    const { data: profile } = await supabase
      .from('profiles')
      .select('kakao_id, phone_number')
      .eq('id', userId)
      .single();
    
    if (!profile || !profile.phone_number) {
      console.log('[알림톡 건너뜀] 전화번호 없음');
      return { success: false, reason: 'no_phone' };
    }
    
    // 템플릿 변수 치환
    const templateArgs = {
      store_name: alertData.place_name,
      rating: alertData.rating.toString(),
      review_content: alertData.content.substring(0, 500),
      reviewer_name: alertData.reviewer_name,
      reviewed_at: formatDateTime(alertData.reviewed_at),
      place_url: `https://m.place.naver.com/restaurant/${extractPlaceId(alertData.place_url)}`
    };
    
    // 알림톡 발송
    const response = await axios.post(
      KAKAO_ALIMTALK_URL,
      {
        receiver_type: 'user',
        receiver_id: profile.kakao_id || profile.phone_number,
        template_id: process.env.KAKAO_TEMPLATE_URGENT,
        sender_key: process.env.KAKAO_SENDER_KEY,
        template_args: templateArgs,
        buttons: [
          {
            name: '리뷰 확인하기',
            type: 'WL',
            url_mobile: templateArgs.place_url,
            url_pc: templateArgs.place_url
          }
        ]
      },
      {
        headers: {
          'Authorization': `KakaoAK ${process.env.KAKAO_REST_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('[알림톡 발송 완료]', response.data);
    
    return {
      success: true,
      message_id: response.data.result_code
    };
    
  } catch (error) {
    console.error('[알림톡 발송 실패]', error.response?.data || error.message);
    
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 고평점 리뷰 알림 발송
 */
async function sendHighRatingAlert(userId, alertData) {
  try {
    console.log('[알림톡 발송] 고평점 리뷰:', alertData.id);
    
    // 긴급 리뷰와 동일한 로직, 템플릿만 다름
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    
    const { data: profile } = await supabase
      .from('profiles')
      .select('kakao_id, phone_number')
      .eq('id', userId)
      .single();
    
    if (!profile || !profile.phone_number) {
      return { success: false, reason: 'no_phone' };
    }
    
    const templateArgs = {
      store_name: alertData.place_name,
      rating: alertData.rating.toString(),
      review_content: alertData.content.substring(0, 500),
      reviewer_name: alertData.reviewer_name,
      reviewed_at: formatDateTime(alertData.reviewed_at),
      place_url: `https://m.place.naver.com/restaurant/${extractPlaceId(alertData.place_url)}`
    };
    
    const response = await axios.post(
      KAKAO_ALIMTALK_URL,
      {
        receiver_type: 'user',
        receiver_id: profile.kakao_id || profile.phone_number,
        template_id: process.env.KAKAO_TEMPLATE_HIGH_RATING,
        sender_key: process.env.KAKAO_SENDER_KEY,
        template_args: templateArgs,
        buttons: [
          {
            name: '리뷰 확인하기',
            type: 'WL',
            url_mobile: templateArgs.place_url,
            url_pc: templateArgs.place_url
          }
        ]
      },
      {
        headers: {
          'Authorization': `KakaoAK ${process.env.KAKAO_REST_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('[알림톡 발송 완료]', response.data);
    
    return {
      success: true,
      message_id: response.data.result_code
    };
    
  } catch (error) {
    console.error('[알림톡 발송 실패]', error.response?.data || error.message);
    
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 일일 요약 리포트 발송
 */
async function sendDailySummary(userId, summaryData) {
  try {
    console.log('[알림톡 발송] 일일 요약:', userId);
    
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    
    const { data: profile } = await supabase
      .from('profiles')
      .select('kakao_id, phone_number')
      .eq('id', userId)
      .single();
    
    if (!profile || !profile.phone_number) {
      return { success: false, reason: 'no_phone' };
    }
    
    const templateArgs = {
      store_name: summaryData.store_name,
      start_date: summaryData.start_date,
      end_date: summaryData.end_date,
      total_count: summaryData.total_count.toString(),
      avg_rating: summaryData.avg_rating.toFixed(1),
      urgent_count: summaryData.urgent_count.toString(),
      high_rating_count: summaryData.high_rating_count.toString()
    };
    
    const response = await axios.post(
      KAKAO_ALIMTALK_URL,
      {
        receiver_type: 'user',
        receiver_id: profile.kakao_id || profile.phone_number,
        template_id: process.env.KAKAO_TEMPLATE_DAILY_SUMMARY,
        sender_key: process.env.KAKAO_SENDER_KEY,
        template_args: templateArgs,
        buttons: [
          {
            name: '자세히 보기',
            type: 'WL',
            url_mobile: 'https://www.sajangpick.co.kr/mypage.html',
            url_pc: 'https://www.sajangpick.co.kr/mypage.html'
          }
        ]
      },
      {
        headers: {
          'Authorization': `KakaoAK ${process.env.KAKAO_REST_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('[알림톡 발송 완료]', response.data);
    
    return {
      success: true,
      message_id: response.data.result_code
    };
    
  } catch (error) {
    console.error('[알림톡 발송 실패]', error.response?.data || error.message);
    
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 날짜/시간 포맷팅
 */
function formatDateTime(isoString) {
  const date = new Date(isoString);
  return date.toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * 플레이스 ID 추출
 */
function extractPlaceId(url) {
  const match = url.match(/\/restaurant\/(\d+)/);
  return match ? match[1] : null;
}

module.exports = {
  sendUrgentReviewAlert,
  sendHighRatingAlert,
  sendDailySummary
};
```

### 3단계: axios 설치

```bash
pnpm add axios
```

---

## 🧪 테스트

### 개발 단계: "나에게 보내기" API 사용

**템플릿 승인 전 테스트용**

```javascript
// test-kakao.js
async function testKakaoSend() {
  const response = await axios.post(
    'https://kapi.kakao.com/v2/api/talk/memo/send',
    {
      template_object: {
        object_type: 'text',
        text: '🧪 카카오톡 테스트\n\n긴급 리뷰 알림 기능 개발 완료!',
        link: {
          web_url: 'https://www.sajangpick.co.kr',
          mobile_web_url: 'https://www.sajangpick.co.kr'
        }
      }
    },
    {
      headers: {
        'Authorization': `Bearer ${YOUR_ACCESS_TOKEN}`,
        'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8'
      }
    }
  );
  
  console.log('발송 완료:', response.data);
}

testKakaoSend();
```

### 프로덕션: 실제 알림톡 테스트

**어드민에서 테스트 발송:**

1. `admin/review-monitoring.html` 수정
2. "테스트 알림 발송" 버튼 추가
3. 버튼 클릭 → API 호출 → 알림톡 발송

---

## 🚀 배포

### 1. 환경변수 등록

**Render.com Dashboard:**
```
Environment Variables:
- KAKAO_REST_API_KEY = xxx
- KAKAO_SENDER_KEY = xxx
- KAKAO_TEMPLATE_URGENT = urgent_review_alert
- KAKAO_TEMPLATE_HIGH_RATING = high_rating_alert
- KAKAO_TEMPLATE_DAILY_SUMMARY = daily_summary
```

### 2. Git 커밋

```bash
git add .
git commit -m "feat: 카카오 알림톡 연동 완료

- sendUrgentReviewAlert() 구현
- sendHighRatingAlert() 구현
- sendDailySummary() 구현
- 템플릿 변수 치환
- 에러 핸들링"

git push origin main
```

### 3. 알림톡 발송 확인

**어드민에서:**
1. 수동 크롤링 실행
2. 긴급 리뷰 발생 시 알림톡 자동 발송
3. 카카오톡 앱에서 수신 확인

---

## 🐛 문제 해결

### 문제 1: 템플릿 승인 거부

**원인:** 광고성 문구, 부적절한 내용

**해결:**
1. 거부 사유 확인
2. 템플릿 수정 (광고 문구 제거)
3. 재제출

### 문제 2: 발송 실패 (error_code: -401)

**원인:** 인증 키 오류

**해결:**
```javascript
// REST API Key 확인
console.log('API Key:', process.env.KAKAO_REST_API_KEY.substring(0, 10));

// 헤더 형식 확인
headers: {
  'Authorization': 'KakaoAK your_rest_api_key', // "KakaoAK " 띄어쓰기 필수!
}
```

### 문제 3: 발송 실패 (error_code: -9999)

**원인:** 템플릿 변수 불일치

**해결:**
```javascript
// 템플릿에 선언된 변수와 정확히 일치해야 함
template_args: {
  store_name: '맛있는 식당', // ✅
  storeName: '맛있는 식당'  // ❌ 변수명 틀림
}
```

### 문제 4: 수신자 정보 없음

**원인:** profiles 테이블에 phone_number 없음

**해결:**
1. 회원가입 시 전화번호 입력 필수화
2. 마이페이지에서 전화번호 수정 기능 추가
3. 전화번호 없으면 알림톡 발송 건너뛰기

---

## 📋 개발 체크리스트

### Phase 1: 템플릿 등록 ⏳
- [ ] 카카오 비즈니스 채널 생성
- [ ] 알림톡 사용 신청
- [ ] 발신 프로필 등록
- [ ] 템플릿 3개 등록
- [ ] 검수 제출
- [ ] **승인 대기 (1-3일)**

### Phase 2: API 연동 ⏳
- [ ] 환경변수 설정 (.env)
- [ ] `sendUrgentReviewAlert()` 구현
- [ ] `sendHighRatingAlert()` 구현
- [ ] `sendDailySummary()` 구현
- [ ] axios 설치

### Phase 3: 테스트 ⏳
- [ ] "나에게 보내기" API 테스트
- [ ] 템플릿 승인 후 실제 발송 테스트
- [ ] 긴급 리뷰 시나리오 테스트
- [ ] 고평점 리뷰 시나리오 테스트

### Phase 4: 배포 ⏳
- [ ] Render 환경변수 등록
- [ ] Git 커밋 & 푸시
- [ ] 실제 사용자에게 알림톡 발송 확인
- [ ] 발송 로그 모니터링

---

## 💰 비용 예상

### 알림톡 요금

| 항목 | 단가 |
|------|------|
| 기본 알림톡 | 8원/건 |
| 이미지 포함 | 15원/건 |
| 와이드 이미지 | 20원/건 |

### 우리 프로젝트 예상

**시나리오:**
- 회원 100명
- 하루 평균 10개 알림 × 100명 = 1,000건/일
- 1,000건 × 8원 = **8,000원/일**
- **월 약 24만원** (30일 기준)

**비용 절감 방법:**
1. 긴급 리뷰만 즉시 발송 (중요도 높음)
2. 고평점 리뷰는 일일 요약에 포함 (배치 발송)
3. 키워드 알림은 중요 키워드만 설정

---

## 🔗 참고 자료

### 공식 문서
- [카카오 비즈메시지 API](https://developers.kakao.com/docs/latest/ko/message/rest-api)
- [알림톡 가이드](https://kakaobusiness.gitbook.io/main/ad/bizmessage/alimtalk)
- [템플릿 가이드](https://kakaobusiness.gitbook.io/main/ad/bizmessage/template)

### 코드 위치
- **메인 API**: `api/kakao-alimtalk.js`
- **호출 위치**: `api/review-monitoring.js` (processNewReview 함수)
- **환경변수**: `.env`

### 관련 문서
- `docs/KAKAO_ALIMTALK_SETUP.md` - 사용자용 설정 가이드
- `docs/REVIEW_MONITORING_GUIDE.md` - 전체 시스템 가이드

---

**작성일:** 2025-10-30  
**다음 업데이트:** 템플릿 승인 및 연동 완료 후  
**담당:** AI 또는 개발자

