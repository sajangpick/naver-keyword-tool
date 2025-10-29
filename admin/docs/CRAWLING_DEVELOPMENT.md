# 🔍 네이버 플레이스 크롤링 개발 가이드

> 리뷰 모니터링 시스템의 핵심 - 실제 크롤링 로직 구현 가이드

---

## 📋 목차

1. [현재 상태](#현재-상태)
2. [기술 스택 선택](#기술-스택-선택)
3. [구현 방법](#구현-방법)
4. [단계별 개발](#단계별-개발)
5. [테스트](#테스트)
6. [배포](#배포)
7. [문제 해결](#문제-해결)

---

## 🎯 현재 상태

### 작동 중인 것
- ✅ DB 스키마 (테이블 3개)
- ✅ API 엔드포인트 (`api/review-monitoring.js`)
- ✅ 마이페이지 UI
- ✅ 어드민 대시보드
- ✅ Vercel Cron (매일 3회)
- ✅ 전체 시스템 플로우

### 개발 필요
- ⏳ **`crawlPlaceReviews()` 함수** (현재 더미 데이터)
  - 파일: `api/review-monitoring.js`
  - 위치: 51-87줄
  - 현재: 하드코딩된 리뷰 2개 반환
  - 목표: 실제 네이버 플레이스 크롤링

---

## 🛠️ 기술 스택 선택

### Option 1: Puppeteer (추천) ⭐⭐⭐⭐⭐

**장점:**
- ✅ Node.js 네이티브 (기존 코드와 통합 쉬움)
- ✅ Chromium 기반 브라우저 자동화
- ✅ JavaScript 실행 가능
- ✅ 네이버 플레이스 크롤링에 적합
- ✅ 대규모 커뮤니티 & 문서

**단점:**
- ❌ 메모리 사용량 높음 (~100MB)
- ❌ Render 무료 플랜에서 느릴 수 있음

**설치:**
```bash
pnpm add puppeteer
```

### Option 2: Playwright

**장점:**
- ✅ Puppeteer보다 빠름
- ✅ 여러 브라우저 지원
- ✅ 자동 대기 기능 강력

**단점:**
- ❌ 설치 파일 크기 큼
- ❌ Render 무료 플랜에서 느릴 수 있음

### Option 3: Cheerio + Axios (비추천)

**장점:**
- ✅ 가볍고 빠름
- ✅ 메모리 적게 사용

**단점:**
- ❌ JavaScript 실행 불가
- ❌ 네이버 플레이스는 동적 렌더링 → 크롤링 불가

### 결론: **Puppeteer 사용**

---

## 📝 구현 방법

### 네이버 플레이스 리뷰 구조 분석

#### 1. URL 구조
```
방문자 리뷰:
https://m.place.naver.com/restaurant/1234567890/review/visitor

블로그 리뷰:
https://m.place.naver.com/restaurant/1234567890/review/ugc

새소식 (사장님 글):
https://m.place.naver.com/restaurant/1234567890/feed
```

#### 2. HTML 구조 (2025년 기준)

**방문자 리뷰:**
```html
<div class="place_section_content">
  <ul class="list_review">
    <li class="pui__X35jYm">
      <div class="pui__vn15t2">
        <!-- 평점 -->
        <span class="pui__xtsQN-">⭐⭐⭐⭐⭐</span>
        
        <!-- 리뷰 내용 -->
        <div class="pui__vn15t2">
          <a class="pui__xtsQN-">
            <span class="pui__xtsQN-">리뷰 내용...</span>
          </a>
        </div>
        
        <!-- 작성자 -->
        <div class="pui__vn15t2">
          <a class="pui__xtsQN-">작성자명</a>
        </div>
        
        <!-- 작성 시간 -->
        <time class="pui__QhdAu">2025.10.30</time>
      </div>
    </li>
  </ul>
</div>
```

**주의:** 
- 네이버는 클래스명을 난독화함 (예: `pui__X35jYm`)
- 클래스명은 변경될 수 있음
- 더 안정적인 선택자 사용 필요 (예: `data-*` 속성, aria 속성)

---

## 🚀 단계별 개발

### Step 1: 기본 Puppeteer 설정

**파일 생성**: `api/utils/puppeteer-setup.js`

```javascript
const puppeteer = require('puppeteer');

/**
 * Puppeteer 브라우저 인스턴스 생성
 */
async function createBrowser() {
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
      '--window-size=1920x1080'
    ]
  });
  
  return browser;
}

/**
 * 페이지 기본 설정
 */
async function setupPage(page) {
  // User Agent 설정 (봇 감지 회피)
  await page.setUserAgent(
    'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1'
  );
  
  // 타임아웃 설정
  await page.setDefaultTimeout(30000);
  
  // 뷰포트 설정 (모바일)
  await page.setViewport({ width: 375, height: 667 });
  
  return page;
}

module.exports = {
  createBrowser,
  setupPage
};
```

### Step 2: 리뷰 크롤링 함수 구현

**파일 수정**: `api/review-monitoring.js` (51-87줄)

```javascript
const { createBrowser, setupPage } = require('./utils/puppeteer-setup');

/**
 * 네이버 플레이스 리뷰 크롤링
 */
async function crawlPlaceReviews(placeUrl) {
  let browser = null;
  
  try {
    console.log('[크롤링 시작]', placeUrl);
    
    // 플레이스 ID 추출
    const placeId = extractPlaceId(placeUrl);
    if (!placeId) {
      throw new Error('유효하지 않은 플레이스 URL');
    }
    
    // 브라우저 실행
    browser = await createBrowser();
    const page = await browser.newPage();
    await setupPage(page);
    
    // 방문자 리뷰 수집
    const visitorReviews = await crawlVisitorReviews(page, placeId);
    
    // 블로그 리뷰 수집 (선택적)
    // const blogReviews = await crawlBlogReviews(page, placeId);
    
    // 새소식 수집 (선택적)
    // const newsReviews = await crawlNews(page, placeId);
    
    const allReviews = [
      ...visitorReviews,
      // ...blogReviews,
      // ...newsReviews
    ];
    
    console.log(`[크롤링 완료] 총 ${allReviews.length}개 리뷰`);
    
    return {
      success: true,
      reviews: allReviews,
      total: allReviews.length
    };
    
  } catch (error) {
    console.error('[크롤링 실패]', error);
    return {
      success: false,
      error: error.message,
      reviews: []
    };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * 방문자 리뷰 크롤링
 */
async function crawlVisitorReviews(page, placeId) {
  try {
    const url = `https://m.place.naver.com/restaurant/${placeId}/review/visitor`;
    console.log('[방문자 리뷰 크롤링]', url);
    
    await page.goto(url, { waitUntil: 'networkidle2' });
    
    // 페이지 로딩 대기
    await page.waitForTimeout(2000);
    
    // 리뷰 리스트 파싱
    const reviews = await page.evaluate(() => {
      const reviewElements = document.querySelectorAll('.list_review > li');
      const results = [];
      
      reviewElements.forEach((el, index) => {
        try {
          // 평점 추출 (별 개수 세기)
          const stars = el.querySelectorAll('.star_score .star_fill');
          const rating = stars.length;
          
          // 리뷰 내용 추출
          const contentEl = el.querySelector('.review_text');
          const content = contentEl ? contentEl.textContent.trim() : '';
          
          // 작성자명 추출
          const authorEl = el.querySelector('.reviewer_info .reviewer_name');
          const reviewer_name = authorEl ? authorEl.textContent.trim() : '익명';
          
          // 작성 시간 추출
          const timeEl = el.querySelector('.review_time');
          const timeText = timeEl ? timeEl.textContent.trim() : '';
          
          // 고유 ID 생성 (타임스탬프 + 인덱스)
          const external_id = `visitor_${placeId}_${Date.now()}_${index}`;
          
          if (content) {
            results.push({
              type: 'visitor',
              external_id,
              rating,
              content,
              reviewer_name,
              reviewed_at: parseReviewTime(timeText)
            });
          }
        } catch (err) {
          console.error('리뷰 파싱 오류:', err);
        }
      });
      
      return results;
    });
    
    console.log(`[방문자 리뷰] ${reviews.length}개 수집`);
    
    return reviews;
    
  } catch (error) {
    console.error('[방문자 리뷰 크롤링 실패]', error);
    return [];
  }
}

/**
 * 리뷰 시간 파싱 (상대시간 → ISO 문자열)
 */
function parseReviewTime(timeText) {
  try {
    const now = new Date();
    
    if (timeText.includes('방금')) {
      return now.toISOString();
    } else if (timeText.includes('분 전')) {
      const minutes = parseInt(timeText);
      now.setMinutes(now.getMinutes() - minutes);
      return now.toISOString();
    } else if (timeText.includes('시간 전')) {
      const hours = parseInt(timeText);
      now.setHours(now.getHours() - hours);
      return now.toISOString();
    } else if (timeText.includes('일 전')) {
      const days = parseInt(timeText);
      now.setDate(now.getDate() - days);
      return now.toISOString();
    } else if (timeText.includes('.')) {
      // "2025.10.30" 형식
      const [year, month, day] = timeText.split('.').map(n => parseInt(n));
      return new Date(year, month - 1, day).toISOString();
    }
    
    return now.toISOString();
  } catch (error) {
    return new Date().toISOString();
  }
}
```

### Step 3: package.json에 Puppeteer 추가

```bash
pnpm add puppeteer
```

또는 `package.json` 수정:
```json
{
  "dependencies": {
    "puppeteer": "^21.5.0"
  }
}
```

### Step 4: Render 환경 설정

**Render.com Dashboard → Environment Variables:**

```env
# Puppeteer를 Render에서 실행하려면 필요
PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=false
PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable
```

**또는 `render.yaml` 추가:**
```yaml
services:
  - type: web
    name: sajangpick-backend
    env: node
    buildCommand: pnpm install && pnpm build
    startCommand: node server.js
    envVars:
      - key: PUPPETEER_SKIP_CHROMIUM_DOWNLOAD
        value: false
```

---

## 🧪 테스트

### 로컬 테스트

**테스트 파일 생성**: `test-crawling.js`

```javascript
const { crawlPlaceReviews } = require('./api/review-monitoring');

async function test() {
  const testUrl = 'https://m.place.naver.com/restaurant/1234567890';
  
  console.log('🧪 크롤링 테스트 시작...\n');
  
  const result = await crawlPlaceReviews(testUrl);
  
  console.log('\n📊 결과:');
  console.log('성공:', result.success);
  console.log('총 리뷰:', result.total);
  console.log('\n리뷰 목록:');
  result.reviews.forEach((review, i) => {
    console.log(`\n${i + 1}. [${review.rating}점] ${review.reviewer_name}`);
    console.log(`   ${review.content.substring(0, 50)}...`);
  });
}

test().catch(console.error);
```

**실행:**
```bash
node test-crawling.js
```

### API 테스트

**Postman 또는 curl:**
```bash
curl -X POST https://naver-keyword-tool.onrender.com/api/review-monitoring \
  -H "Content-Type: application/json" \
  -d '{
    "action": "crawl_single",
    "monitoringId": "your-monitoring-id"
  }'
```

---

## 🚀 배포

### 1. Git 커밋
```bash
git add .
git commit -m "feat: 실제 네이버 플레이스 크롤링 구현

- Puppeteer 추가
- crawlPlaceReviews() 함수 구현
- 방문자 리뷰 크롤링
- 리뷰 시간 파싱"

git push origin main
```

### 2. Render 재배포

**자동 배포:**
- GitHub Push → Render 자동 감지 → 재배포

**수동 배포:**
1. Render Dashboard 접속
2. Manual Deploy 클릭
3. 로그 확인

### 3. 크롤링 테스트

**어드민에서 수동 실행:**
1. https://www.sajangpick.co.kr/admin/review-monitoring.html
2. "수동 크롤링 실행" 버튼 클릭
3. 결과 확인

---

## 🐛 문제 해결

### 문제 1: Puppeteer가 Render에서 실행 안 됨

**원인:** Chromium 바이너리 없음

**해결:**
```javascript
// puppeteer-setup.js
const browser = await puppeteer.launch({
  headless: true,
  executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome-stable',
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox'
  ]
});
```

### 문제 2: 메모리 부족

**원인:** Render 무료 플랜 (512MB)

**해결:**
1. 한 번에 1개 플레이스만 크롤링
2. 브라우저 즉시 종료
3. 이미지 로딩 비활성화:
```javascript
await page.setRequestInterception(true);
page.on('request', (req) => {
  if (req.resourceType() === 'image') {
    req.abort();
  } else {
    req.continue();
  }
});
```

### 문제 3: 네이버 봇 감지

**원인:** User Agent, 요청 패턴 감지

**해결:**
1. User Agent를 모바일로 설정
2. 요청 간 랜덤 딜레이 추가:
```javascript
await page.waitForTimeout(Math.random() * 2000 + 1000); // 1-3초
```
3. 너무 자주 크롤링하지 않기 (하루 3회)

### 문제 4: 셀렉터가 안 맞음

**원인:** 네이버가 HTML 구조 변경

**해결:**
1. 최신 HTML 구조 확인
2. 더 안정적인 셀렉터 사용 (aria 속성, data 속성)
3. 여러 셀렉터 대비:
```javascript
const content = 
  el.querySelector('.review_text')?.textContent ||
  el.querySelector('[data-review-content]')?.textContent ||
  el.querySelector('.pui__xtsQN-')?.textContent ||
  '';
```

---

## 📋 개발 체크리스트

### Phase 1: 기본 크롤링 ✅
- [ ] Puppeteer 설치
- [ ] `puppeteer-setup.js` 작성
- [ ] `crawlVisitorReviews()` 함수 구현
- [ ] 로컬 테스트 성공

### Phase 2: 다양한 리뷰 타입 ⏳
- [ ] 블로그 리뷰 크롤링 (`crawlBlogReviews()`)
- [ ] 새소식 크롤링 (`crawlNews()`)
- [ ] 영수증 리뷰 크롤링

### Phase 3: 최적화 ⏳
- [ ] 이미지 로딩 비활성화
- [ ] 요청 간 랜덤 딜레이
- [ ] 중복 리뷰 필터링 개선
- [ ] 에러 핸들링 강화

### Phase 4: 배포 ⏳
- [ ] Render 환경 설정
- [ ] 실제 배포 테스트
- [ ] 어드민에서 수동 크롤링 테스트
- [ ] Cron 자동 실행 확인

---

## 🔗 참고 자료

### 공식 문서
- [Puppeteer Docs](https://pptr.dev/)
- [Render Docs - Node.js](https://render.com/docs/node-version)

### 코드 위치
- **메인 API**: `api/review-monitoring.js` (51-87줄)
- **전체 시스템**: `docs/REVIEW_MONITORING_GUIDE.md`
- **DB 스키마**: `database/schemas/features/review/review-monitoring.sql`

### 관련 이슈
- 네이버 봇 감지: User Agent 설정 필수
- Render 메모리: 한 번에 1개씩 크롤링
- 클래스명 변경: 정기적으로 셀렉터 업데이트 필요

---

**작성일:** 2025-10-30  
**다음 업데이트:** 크롤링 구현 완료 후  
**담당:** AI 또는 개발자

