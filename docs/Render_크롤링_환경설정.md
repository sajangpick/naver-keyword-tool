# 🔧 Render 크롤링 환경변수 설정 가이드

## 🚨 문제 상황
- **로컬**: Puppeteer 크롤링 정상 작동 ✅
- **Render**: Puppeteer 크롤링 실패 ❌

## 🔍 근본 원인
```javascript
// ❌ 기존 코드 (잘못된 환경 판별)
const isVercel = process.env.VERCEL || process.env.NODE_ENV === "production";

if (isVercel) {
  // @sparticuz/chromium 사용
} else {
  // 일반 puppeteer 사용 (Render에 Chrome 없음 → 실패!)
}
```

**문제점:**
1. Render는 `process.env.VERCEL`이 없음
2. Render는 `NODE_ENV=production`이지만 위 로직으로는 `isVercel = false`
3. 일반 `puppeteer` 사용 시도 → **Chrome이 설치되어 있지 않아 실패**

## ✅ 해결 방법

### 1. 코드 수정 (완료!)
```javascript
// ✅ 수정된 코드 (올바른 환경 판별)
const isProduction = process.env.NODE_ENV === "production";

let chromium, puppeteer;

if (isProduction) {
  // Render/Vercel: @sparticuz/chromium 사용 (경량 Chromium 바이너리)
  chromium = require("@sparticuz/chromium");
  puppeteer = require("puppeteer-core");
} else {
  // 로컬: 일반 puppeteer 사용 (자동 Chrome 다운로드)
  puppeteer = require("puppeteer");
}
```

**수정된 파일:**
- ✅ `api/place-crawl.js`
- ✅ `api/place-batch-crawl.js`
- ✅ `api/place-detail-crawl.js`
- ✅ `api/review-monitoring.js`
- ✅ `api/rank-list-crawl.js`

### 2. Render 환경변수 설정

#### Render Dashboard 접속
1. https://dashboard.render.com 로그인
2. 사장픽 서비스 선택
3. **"Environment"** 탭 클릭

#### 필수 환경변수 확인

| 환경변수 | 값 | 설명 |
|---------|-----|------|
| `NODE_ENV` | `production` | **반드시 필요!** 크롤링 환경 분기용 |
| `PORT` | `3003` | 서버 포트 |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://...supabase.co` | Supabase URL |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` | Supabase 서비스 키 |
| `OPENAI_API_KEY` | `sk-proj-...` | OpenAI API 키 |

#### 크롤링 성능 최적화 (선택사항)

```bash
# Chromium 메모리 최적화
PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

# 동시 크롤링 제한
MAX_CONCURRENT_CRAWLS=3
```

### 3. 배포 및 확인

#### 3-1. Git Push
```powershell
git add .
git commit -m "fix: Render 크롤링 환경 분기 수정 (isProduction)"
git push origin main
```

#### 3-2. Render 자동 배포 대기
- Render Dashboard에서 **"Logs"** 탭 확인
- 배포 완료까지 약 2-3분 소요

#### 3-3. 배포 후 테스트
```bash
# Render 서버 URL로 크롤링 API 테스트
curl -X POST https://your-render-app.onrender.com/api/place-crawl \
  -H "Content-Type: application/json" \
  -d '{"placeUrl": "https://m.place.naver.com/restaurant/1390003666"}'
```

**정상 응답 예시:**
```json
{
  "success": true,
  "data": {
    "basic": {
      "name": "삼겹살집",
      "category": "한식"
    },
    "contact": {
      "address": "서울시 강남구...",
      "phone": "02-1234-5678"
    }
  }
}
```

## 🔍 트러블슈팅

### 문제 1: 여전히 크롤링 실패
```
Error: Failed to launch the browser process!
```

**해결:**
1. Render 환경변수 확인: `NODE_ENV=production` 설정되었는지 확인
2. 로그 확인: `console.log('isProduction:', isProduction)` 추가
3. Dependencies 확인: `package.json`에 `@sparticuz/chromium`, `puppeteer-core` 있는지 확인

### 문제 2: Timeout 에러
```
Error: Navigation timeout of 30000 ms exceeded
```

**해결:**
```javascript
// timeout 증가
await page.goto(url, { 
  waitUntil: "domcontentloaded", 
  timeout: 60000  // 30초 → 60초
});
```

### 문제 3: 메모리 부족
```
Error: Protocol error (Runtime.callFunctionOn): Target closed
```

**해결:**
- Render 플랜 업그레이드 (Free → Starter)
- 또는 동시 크롤링 수 제한

```javascript
// 병렬 크롤링 제한
const parallelPages = process.env.MAX_CONCURRENT_CRAWLS || 3;
```

## 📊 환경별 동작 차이

| 환경 | NODE_ENV | Puppeteer 패키지 | Chrome 설치 |
|------|----------|------------------|-------------|
| **로컬** | `development` | `puppeteer` (일반) | 자동 다운로드 |
| **Render** | `production` | `puppeteer-core` + `@sparticuz/chromium` | 경량 바이너리 포함 |
| **Vercel** | `production` | `puppeteer-core` + `@sparticuz/chromium` | 경량 바이너리 포함 |

## ✅ 최종 체크리스트

- [x] 코드 수정: `isVercel` → `isProduction`
- [x] 5개 크롤링 API 파일 모두 수정
- [ ] Render 환경변수: `NODE_ENV=production` 설정
- [ ] Git Push 및 Render 자동 배포
- [ ] 배포 후 크롤링 API 테스트
- [ ] 로그 확인: "✅ Chrome 실행 성공" 메시지

## 📝 변경 이력

**2025-11-02**
- 문제 발견: Render에서 `isVercel` 로직이 잘못 작동
- 해결: `isProduction` 기반 환경 분기로 변경
- 영향: 모든 크롤링 API가 Render에서 정상 작동
- 파일: `api/place-*.js`, `api/review-monitoring.js`, `api/rank-list-crawl.js`

---

**더 자세한 내용**: `docs/배포_아키텍처.md`, `.github/copilot-instructions.md` 참조
