# Git 저장소 경로 찾기 가이드

## 🔍 문제 원인

현재 폴더(`C:\Users\오다쉐프\Desktop\naver-keyword-tool-main`)가 Git 저장소가 아닙니다.
- `.git` 폴더가 없어서 "This directory does not appear to be a Git repository" 오류가 발생합니다.

---

## ✅ 해결 방법

### 방법 1: GitHub Desktop에서 실제 저장소 경로 찾기 (추천)

1. **GitHub Desktop 메인 화면**에서
2. **Repository** → **Show in Explorer** 클릭
   - 또는 **Repository** → **Repository Settings** → "Local path" 확인
3. 열린 폴더의 **전체 경로**를 복사하세요
   - 예: `C:\Users\오다쉐프\Documents\GitHub\naver-keyword-tool`
4. 이 경로를 "Add local repository"에 입력하세요

---

### 방법 2: 현재 폴더를 Git 저장소로 만들기

⚠️ **주의**: 이 방법은 현재 폴더를 새 Git 저장소로 만듭니다.
기존 GitHub 저장소와 연결하려면 원격 저장소를 추가해야 합니다.

1. "Add local repository" 다이얼로그에서
2. 경로를 `C:\Users\오다쉐프\Desktop\naver-keyword-tool-main\naver-keyword-tool-main`로 설정
3. "create a repository here instead?" 링크 클릭
4. 새 저장소 생성 후 원격 저장소 연결 필요

---

### 방법 3: 올바른 경로 찾기

**GitHub Desktop에서:**
1. 왼쪽 사이드바에서 `naver-keyword-tool` 저장소 선택
2. **Repository** → **Show in Explorer** 클릭
3. 주소창의 경로를 복사
4. 이 경로를 사용하세요

---

## 🎯 가장 좋은 방법

**GitHub Desktop에서 이미 열려있는 저장소 사용하기:**

1. "Add local repository" 창을 **닫으세요** (Cancel)
2. GitHub Desktop 메인 화면에서 `naver-keyword-tool` 저장소가 열려있는지 확인
3. 파일을 수정하면 자동으로 변경사항이 표시됩니다
4. 커밋 메시지 입력 → 커밋 → 푸시

**"Add local repository"를 사용할 필요가 없습니다!**

---

## 📝 확인 사항

현재 GitHub Desktop에 `naver-keyword-tool` 저장소가 열려있다면:
- 그 저장소에서 바로 작업하면 됩니다
- "Add local repository"는 사용하지 마세요
- 파일을 수정하면 자동으로 변경사항이 표시됩니다

