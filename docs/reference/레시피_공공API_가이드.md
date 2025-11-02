# 📚 레시피 공공 API 가이드

> 작성일: 2025년 11월 2일  
> 최종 업데이트: 2025년 11월 2일

---

## ⚠️ 주의: RSS는 레시피 API가 아닙니다

### 농촌진흥청 RSS 서비스 (뉴스 피드)
농촌진흥청 RSS서비스를 통해 인물/동정, 농업기술, 그린매거진의 실시간 업데이트 정보를 알림이 농촌진흥청 홈페이지의 접속할 필요 없이 RSS로 제공되는 새로운 소식들이 업데이트 될 때마다 쉽게 알 수 있습니다.

**RSS 피드 URL (뉴스용):**
- 인물/동정: `https://www.rda.go.kr/rss/rss.jsp?board_id=ppemovent` 
- 농업기술: `https://www.rda.go.kr/rss/rss.jsp?board_id=pubctebook`
- 그린매거진: `https://www.rda.go.kr/rss/rss.jsp?board_id=webzine`

**이것은 레시피가 아닌 농업 뉴스 피드입니다!**

---

## 🍳 실제 레시피 공공 API 목록

### 1. 농촌진흥청 레시피 API ⭐추천

#### 📍 접속 방법
1. **공공데이터포털** 접속: [www.data.go.kr](https://www.data.go.kr)
2. 회원가입 및 로그인
3. 검색창에 다음 키워드로 검색:
   - "농촌진흥청 음식"
   - "농촌진흥청 레시피"
   - "농식품 레시피"
   - "국가표준식품성분"

#### 🔑 API 신청 절차
1. 원하는 API 선택
2. "활용신청" 버튼 클릭
3. 사용 목적 작성 (예: "식당 레시피 관리 시스템 개발")
4. 승인 대기 (보통 즉시 ~ 1일)
5. 승인 후 API 키 발급
6. 발급받은 키를 `.env` 파일에 저장

#### 💾 예상 데이터
- 한식 레시피 9,000개 이상
- 재료, 조리법, 영양정보 포함
- 이미지 URL 제공

---

### 2. 식품안전나라 API

#### 📍 웹사이트
[www.foodsafetykorea.go.kr](https://www.foodsafetykorea.go.kr)

#### 🔑 특징
- 식품 영양 데이터베이스
- 레시피 및 영양 성분 정보
- 무료 사용 가능

---

### 3. 한국관광공사 Tour API

#### 📍 웹사이트
[api.visitkorea.or.kr](http://api.visitkorea.or.kr)

#### 🔑 특징
- 한국 전통 음식 레시피
- 지역별 특산 음식 정보
- 관광지 음식점 데이터

---

### 4. 국제 레시피 API (영문)

#### 🌍 Spoonacular API
- **웹사이트**: [spoonacular.com/food-api](https://spoonacular.com/food-api)
- **무료 한도**: 150 요청/일
- **데이터**: 5,000개 이상 레시피
- **특징**: 영양 정보, 와인 매칭, 식사 계획

#### 🌍 Edamam Recipe API
- **웹사이트**: [developer.edamam.com](https://developer.edamam.com)
- **무료 한도**: 10,000 요청/월
- **데이터**: 2백만개 이상 레시피
- **특징**: 영양 분석, 알레르기 필터, 다이어트 태그

#### 🌍 TheMealDB
- **웹사이트**: [themealdb.com/api.php](https://www.themealdb.com/api.php)
- **무료 한도**: 제한 없음 (완전 무료)
- **데이터**: 300개 이상 레시피
- **특징**: 카테고리별 정리, 비디오 링크

---

## 💻 API 키 설정 방법

### 1. 환경변수 파일 생성
```bash
# .env 파일에 추가
RURAL_DEV_API_KEY=발급받은_API_키
FOOD_SAFETY_API_KEY=발급받은_API_키
TOUR_API_KEY=발급받은_API_키
```

### 2. api/recipes.js 수정
```javascript
// Line 207-212 수정
const apiResponse = await axios.get('실제_API_엔드포인트_URL', {
  params: { 
    apiKey: process.env.RURAL_DEV_API_KEY,
    searchKeyword: keyword,
    // 필요한 다른 파라미터
  }
});
```

---

## 🧪 현재 테스트 환경

### 샘플 데이터 (5개)
API 키 없이도 테스트 가능하도록 5개 샘플 레시피가 하드코딩되어 있습니다:
1. **김치찌개** (한식/찌개/초급/30분)
2. **된장찌개** (한식/찌개/초급/25분)
3. **제육볶음** (한식/볶음/중급/40분)
4. **짜장면** (중식/면요리/중급/45분)
5. **카레라이스** (일식/덮밥/초급/35분)

### 테스트 방법
1. 검색창 비우고 "검색하기" → 5개 모두 표시
2. "김치" 검색 → 김치찌개만 표시
3. 카테고리 "한식" 선택 → 3개 표시
4. 난이도 "초급" 선택 → 초급 레시피만 표시
5. 시간 "30분 이내" → 30분 이하 레시피만 표시

---

## 📝 RSS 리더 활용

RSS는 레시피가 아니지만, 농업/식품 관련 뉴스를 받아보는 용도로 활용 가능:

### RSS리더 프로그램
- **Feedly**: [feedly.com](https://feedly.com)
- **Inoreader**: [inoreader.com](https://www.inoreader.com)
- **The Old Reader**: [theoldreader.com](https://theoldreader.com)

### 활용 방법
1. RSS 리더에 위 농촌진흥청 RSS URL 추가
2. 농업 기술, 식품 트렌드 뉴스 자동 수신
3. 레스토랑 운영에 도움되는 정보 습득

---

## 🎯 권장 사항

### 즉시 시작하려면
1. **현재 샘플 데이터로 시스템 테스트**
2. **AI 레시피 생성 기능 활용** (ChatGPT 연동 완료)
3. **수동으로 레시피 추가** (새 레시피 만들기 탭)

### 장기적으로
1. **공공데이터포털에서 API 키 발급**
2. **환경변수 설정**
3. **실제 API 연동 코드 구현**
4. **9,000개 이상 레시피 데이터 활용**

---

## 📞 문의처

### 공공데이터포털
- 전화: 1566-5121
- 이메일: data@nia.or.kr
- 운영시간: 평일 09:00~18:00

### 농촌진흥청
- 전화: 1544-8572
- 홈페이지: [www.rda.go.kr](https://www.rda.go.kr)

---

> 💡 **팁**: API 키 발급은 보통 즉시~1일 내 완료되며, 대부분 무료로 사용 가능합니다.  
> 상업적 이용도 대부분 허용되니 안심하고 신청하세요!
