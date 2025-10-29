# 🔧 개발 가이드 인덱스

> 리뷰 모니터링 시스템 지속 개발을 위한 문서 모음

---

## 🎯 개발 우선순위

### 🔥 높음 (즉시 개발 필요)

#### 1. 네이버 플레이스 크롤링 구현
- **문서**: [docs/CRAWLING_DEVELOPMENT.md](./docs/CRAWLING_DEVELOPMENT.md)
- **현재 상태**: 더미 데이터 반환 중
- **개발 필요**: Puppeteer로 실제 크롤링
- **예상 시간**: 4-6시간
- **난이도**: ⭐⭐⭐⭐☆

#### 2. 카카오 알림톡 연동
- **문서**: [docs/KAKAO_ALIMTALK_DEVELOPMENT.md](./docs/KAKAO_ALIMTALK_DEVELOPMENT.md)
- **현재 상태**: 함수 구조만 준비됨
- **개발 필요**: 
  1. 템플릿 등록 및 승인 (사용자 작업)
  2. API 함수 구현
- **예상 시간**: 3-4시간 (템플릿 승인 제외)
- **난이도**: ⭐⭐⭐☆☆

### ⚡ 중간 (기능 개선)

#### 3. 마이페이지 최근 리뷰 표시
- **파일**: `mypage.html` (loadRecentReviews 함수)
- **현재 상태**: UI만 준비됨
- **개발 필요**: Supabase에서 데이터 가져와서 렌더링
- **예상 시간**: 1-2시간
- **난이도**: ⭐⭐☆☆☆

#### 4. 블로그 리뷰 & 새소식 크롤링
- **파일**: `api/review-monitoring.js`
- **현재 상태**: 방문자 리뷰만 크롤링
- **개발 필요**: 
  - `crawlBlogReviews()` 함수
  - `crawlNews()` 함수
- **예상 시간**: 2-3시간
- **난이도**: ⭐⭐⭐☆☆

### 🌟 낮음 (추가 기능)

#### 5. 일일 요약 리포트 Cron
- **개발 필요**: 매일 저녁 8시 요약 발송
- **예상 시간**: 1-2시간
- **난이도**: ⭐⭐☆☆☆

#### 6. 리뷰 감정 분석 개선
- **현재**: 단순 평점 기반
- **개선**: 자연어 처리 (긍정/부정 키워드 분석)
- **예상 시간**: 3-4시간
- **난이도**: ⭐⭐⭐⭐☆

---

## 📚 문서 구조

```
admin/
├── DEVELOPMENT_INDEX.md (이 파일) ← 전체 개발 가이드 인덱스
└── docs/
    ├── CRAWLING_DEVELOPMENT.md ← 크롤링 구현 가이드
    ├── KAKAO_ALIMTALK_DEVELOPMENT.md ← 알림톡 연동 가이드
    └── MONITORING_SETUP_COMPLETE.md ← 모니터링 설정 가이드
```

---

## 🚀 빠른 시작

### 새 AI/개발자를 위한 체크리스트

#### 1. 프로젝트 이해 (10분)
- [ ] `docs/REVIEW_MONITORING_GUIDE.md` 읽기
- [ ] `docs/AI_LOG.md` (5211줄부터) 읽기
- [ ] 현재 시스템 구조 파악

#### 2. 개발 환경 설정 (5분)
- [ ] 로컬에서 프로젝트 실행
- [ ] `.env` 파일 확인
- [ ] Supabase 테이블 생성 여부 확인

#### 3. 개발 시작
**크롤링부터 시작하는 경우:**
1. [docs/CRAWLING_DEVELOPMENT.md](./docs/CRAWLING_DEVELOPMENT.md) 읽기
2. Puppeteer 설치: `pnpm add puppeteer`
3. `api/utils/puppeteer-setup.js` 생성
4. `api/review-monitoring.js` (51-87줄) 수정
5. 로컬 테스트: `node test-crawling.js`

**알림톡부터 시작하는 경우:**
1. [docs/KAKAO_ALIMTALK_DEVELOPMENT.md](./docs/KAKAO_ALIMTALK_DEVELOPMENT.md) 읽기
2. 카카오 템플릿 승인 상태 확인
3. `.env`에 API 키 추가
4. `api/kakao-alimtalk.js` 함수 구현
5. 테스트 발송

---

## 🔗 관련 문서

### 사용자용 가이드
- `docs/REVIEW_MONITORING_GUIDE.md` - 전체 시스템 사용 가이드
- `docs/SUPABASE_REVIEW_MONITORING_SETUP.md` - DB 설정
- `docs/KAKAO_ALIMTALK_SETUP.md` - 카카오 설정 (사용자용)

### 개발자용 가이드
- `admin/docs/CRAWLING_DEVELOPMENT.md` - 크롤링 구현
- `admin/docs/KAKAO_ALIMTALK_DEVELOPMENT.md` - 알림톡 연동
- `docs/AI_LOG.md` (5211줄~) - 최신 작업 기록

### 코드 위치
- **크롤링**: `api/review-monitoring.js` (51-87줄)
- **알림톡**: `api/kakao-alimtalk.js`
- **마이페이지**: `mypage.html`
- **어드민**: `admin/review-monitoring.html`
- **DB 스키마**: `database/schemas/features/review/review-monitoring.sql`

---

## 💡 개발 팁

### 크롤링 개발 시
1. **로컬에서 먼저 테스트** (Render는 느림)
2. **HTML 구조는 변경될 수 있음** → 여러 셀렉터 준비
3. **메모리 사용량 체크** → 브라우저 즉시 종료
4. **봇 감지 회피** → User Agent 설정, 랜덤 딜레이

### 알림톡 개발 시
1. **"나에게 보내기" API로 먼저 테스트**
2. **템플릿 변수명 정확히 일치** 필수
3. **전화번호 없는 사용자 처리** 로직 필요
4. **에러 핸들링 철저히** (알림 실패해도 시스템 중단 X)

### 배포 시
1. **Render 환경변수 등록** (Puppeteer, 카카오 API 키)
2. **Git 커밋 전 로컬 테스트**
3. **배포 후 로그 모니터링** (Render Dashboard)

---

## 🎯 다음 단계

### 지금 바로 시작하기

**Option 1: 크롤링부터**
```bash
# 1. 문서 읽기
open admin/docs/CRAWLING_DEVELOPMENT.md

# 2. Puppeteer 설치
pnpm add puppeteer

# 3. 개발 시작
# api/utils/puppeteer-setup.js 생성
# api/review-monitoring.js 수정
```

**Option 2: 알림톡부터**
```bash
# 1. 문서 읽기
open admin/docs/KAKAO_ALIMTALK_DEVELOPMENT.md

# 2. 템플릿 승인 확인
# 카카오 비즈니스 센터 접속

# 3. API 키 설정
# .env 파일 수정
```

---

**업데이트:** 2025-10-30  
**다음 업데이트:** 크롤링 또는 알림톡 구현 완료 후

