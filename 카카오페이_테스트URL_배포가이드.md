# 카카오페이 테스트 URL 배포 가이드

> **목적**: 카카오페이 심사팀이 접근할 수 있는 실제 테스트 URL 만들기

---

## 🎯 현재 상황

✅ **완료된 작업**
- `payment.html`에 데모 모드 기능 추가 완료
- `?demo=true` 파라미터로 로그인 우회 가능

❌ **아직 안 된 것**
- 코드를 GitHub에 푸시하지 않음
- Vercel에 배포되지 않음
- **→ 카카오페이 심사팀이 접근할 수 있는 URL이 아직 없음**

---

## 🚀 배포 방법 (3단계)

### 1단계: GitHub에 코드 업로드

#### 방법 A: GitHub Desktop 사용 (가장 쉬움)

1. **GitHub Desktop 열기**
2. **변경사항 확인**
   - 왼쪽에 `payment.html` 파일이 표시됨
   - `docs/카카오페이_심사용_테스트URL.md` 파일도 표시됨
3. **커밋 메시지 입력**
   ```
   feat: 카카오페이 심사용 데모 모드 추가
   ```
4. **"Commit to main" 버튼 클릭**
5. **"Push origin" 버튼 클릭**
6. **완료!** → Vercel이 자동으로 배포 시작

#### 방법 B: 배치 파일 사용

1. 프로젝트 폴더에서 **`git-commit-and-push.bat`** 파일 더블클릭
2. 커밋 메시지 입력: `feat: 카카오페이 심사용 데모 모드 추가`
3. 엔터 키 누르기
4. 자동으로 푸시됨 → Vercel이 자동으로 배포 시작

---

### 2단계: 배포 완료 대기 (2-3분)

1. **Vercel 대시보드 접속**
   ```
   https://vercel.com/dashboard
   ```
2. **프로젝트 클릭**
3. **"Deployments" 탭 확인**
   - "Building..." → 배포 중
   - "Ready" → 배포 완료! ✅

---

### 3단계: 실제 테스트 URL 확인

배포가 완료되면:

1. **Vercel 대시보드에서 도메인 확인**
   - "Domains" 탭 클릭
   - 실제 도메인 확인:
     - `https://sajangpick.co.kr` 또는
     - `https://sajangpick.vercel.app`

2. **테스트 URL 접속**
   ```
   https://sajangpick.co.kr/payment.html?demo=true
   ```
   또는
   ```
   https://sajangpick.vercel.app/payment.html?demo=true
   ```

3. **확인 사항**
   - ✅ 페이지가 정상적으로 열림
   - ✅ 상단에 주황색 데모 모드 배너 표시
   - ✅ 로그인 없이 플랜 선택 화면 표시
   - ✅ 카카오페이 옵션이 결제 방법에 포함됨

---

## 📋 카카오페이 심사팀에 제공할 최종 URL

배포가 완료되면 다음 URL을 카카오페이 심사팀에 제공하세요:

### 메인 테스트 URL
```
https://sajangpick.co.kr/payment.html?demo=true
```

### 개별 플랜 URL
- **스탠다드 플랜**: `https://sajangpick.co.kr/payment.html?plan=power&demo=true`
- **프로 플랜**: `https://sajangpick.co.kr/payment.html?plan=bigpower&demo=true`
- **프리미엄 플랜**: `https://sajangpick.co.kr/payment.html?plan=premium&demo=true`

**주의**: `sajangpick.co.kr` 대신 실제 Vercel 도메인을 사용할 수도 있습니다.

---

## ✅ 배포 확인 체크리스트

배포 후 다음을 확인하세요:

- [ ] Vercel 대시보드에서 배포 상태가 "Ready"
- [ ] 브라우저에서 테스트 URL 접속 가능
- [ ] 데모 모드 배너가 상단에 표시됨
- [ ] 로그인 없이 플랜 선택 화면 표시됨
- [ ] 카카오페이 옵션이 결제 방법에 포함됨
- [ ] 결제 버튼이 비활성화되어 있음 (데모 모드)

---

## 🆘 문제 해결

### 배포가 실패하는 경우

1. **Vercel 대시보드 → Deployments → 최신 배포 클릭**
2. **로그 확인** - 오류 메시지 확인
3. **자주 발생하는 오류**:
   - `pnpm install` 실패 → `package.json`에 pnpm 버전 명시 필요
   - 환경변수 누락 → Settings → Environment Variables 확인

### 배포는 되었는데 페이지가 안 열리는 경우

1. **브라우저 캐시 삭제** (Ctrl + Shift + Delete)
2. **시크릿 모드에서 접속** 시도
3. **다른 브라우저에서 접속** 시도

---

## 📞 다음 단계

배포가 완료되면:

1. ✅ 실제 테스트 URL로 접속하여 확인
2. ✅ 카카오페이 심사팀에 URL 제공
3. ✅ 이메일 템플릿 사용 (문서 참고)

---

**작성일**: 2025년 11월 25일  
**관련 문서**: `docs/카카오페이_심사용_테스트URL.md`

