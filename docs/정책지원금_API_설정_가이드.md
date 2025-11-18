# 정책지원금 실제 데이터 API 설정 가이드

## 📋 개요

정책지원금 시스템에서 실제 정부 데이터를 가져오기 위한 API 키 설정 방법입니다.

## 🔑 API 키 설정

### 1. 로컬 개발 환경 (.env 파일)

프로젝트 루트에 `.env` 파일을 생성하고 다음 내용을 추가하세요:

```bash
# 공공데이터포털 API (정책지원금 데이터 수집용)
PUBLIC_DATA_KEY=e45b26951c63da01a0d82653dd6101417c57f3812905e604bb4f60f80157bac8
```

### 2. Render 배포 환경

1. Render 대시보드 접속
2. 프로젝트 선택 → Environment 탭
3. "Add Environment Variable" 클릭
4. 다음 정보 입력:
   - **Key**: `PUBLIC_DATA_KEY`
   - **Value**: `e45b26951c63da01a0d82653dd6101417c57f3812905e604bb4f60f80157bac8`
5. 저장 후 서버 재시작

### 3. Vercel 배포 환경

1. Vercel 대시보드 접속
2. 프로젝트 선택 → Settings → Environment Variables
3. "Add New" 클릭
4. 다음 정보 입력:
   - **Name**: `PUBLIC_DATA_KEY`
   - **Value**: `e45b26951c63da01a0d82653dd6101417c57f3812905e604bb4f60f80157bac8`
   - **Environment**: Production, Preview, Development 모두 선택
5. 저장 후 재배포

## 🔌 API 엔드포인트

현재 구현된 실제 데이터 소스:

1. **공공데이터포털 API** (기업마당)
   - 엔드포인트: `https://api.odcloud.kr/api/3074462/v1/uddi:f3f4df8b-5b64-4165-8581-973bf5d50c94`
   - 인증: Service Key (PUBLIC_DATA_KEY)

2. **정책브리핑 RSS**
   - 엔드포인트: `https://www.korea.kr/rss/policy.xml`
   - 인증: 불필요

## 📊 데이터 수집 방법

### 방법 1: 관리자 페이지에서 가져오기 (권장)

1. `/admin/policy-management.html` 접속
2. "실제 데이터 가져오기" 버튼 클릭
3. 자동으로 실제 데이터가 수집되어 데이터베이스에 저장됩니다

### 방법 2: API 직접 호출

```javascript
// GET: 데이터 조회만 (저장 안 함)
fetch('/api/fetch-real-policies')
  .then(res => res.json())
  .then(data => console.log(data));

// POST: 데이터 수집 및 저장
fetch('/api/fetch-real-policies', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({ save: true })
})
  .then(res => res.json())
  .then(data => console.log(data));
```

## 🔍 데이터 필터링

API는 다음 키워드로 소상공인 관련 정책만 필터링합니다:
- 소상공인
- 중소기업
- 자영업
- 창업
- 지원금
- 보조금

## ⚠️ 주의사항

1. **API 키 보안**
   - API 키는 절대 공개 저장소에 커밋하지 마세요
   - `.env` 파일은 `.gitignore`에 포함되어 있어야 합니다

2. **API 호출 제한**
   - 공공데이터포털 API는 일일 호출 제한이 있을 수 있습니다
   - 과도한 호출 시 IP 차단될 수 있으니 주의하세요

3. **데이터 백업**
   - 실제 API 호출 실패 시 내장된 6개 샘플 데이터가 자동으로 사용됩니다
   - 이는 시스템이 항상 작동하도록 보장합니다

## 🐛 트러블슈팅

### API 호출 실패 시

1. **환경변수 확인**
   ```bash
   # 로컬에서 확인
   echo $PUBLIC_DATA_KEY
   
   # Node.js에서 확인
   console.log(process.env.PUBLIC_DATA_KEY);
   ```

2. **API 키 유효성 확인**
   - 공공데이터포털(data.go.kr)에서 API 키가 활성화되어 있는지 확인
   - 키가 만료되었거나 비활성화된 경우 재발급 필요

3. **로그 확인**
   - 서버 콘솔에서 에러 메시지 확인
   - `console.log`로 API 응답 확인

### 데이터가 안 나올 때

1. **RSS 피드 확인**
   - RSS 피드는 인증이 필요 없으므로 항상 작동해야 합니다
   - `https://www.korea.kr/rss/policy.xml` 직접 접속하여 확인

2. **필터링 확인**
   - 소상공인 관련 키워드가 없는 정책은 필터링됩니다
   - 필요시 `api/fetch-real-policy-data.js`의 필터링 로직 수정

## 📚 참고 자료

- [공공데이터포털](https://www.data.go.kr)
- [기업마당](https://www.bizinfo.go.kr)
- [소상공인마당](https://www.sbiz.or.kr)
- [정책브리핑](https://www.korea.kr)

