# GitHub Desktop 사용법 가이드

## ✅ 올바른 사용 방법

### 1. 파일 수정 후 커밋하기

1. **파일 수정**
   - 코드를 수정하면 GitHub Desktop에 자동으로 변경사항이 표시됩니다

2. **커밋 메시지 작성**
   - 하단 "Summary" 필드에 커밋 메시지 입력
   - 예: "Update files - 레시피 AI 기능 추가"
   - "Description"은 선택사항 (자세한 설명이 필요할 때만)

3. **커밋하기**
   - "Commit to main" 버튼 클릭
   - 또는 "Commit [숫자] files to main" 버튼 클릭

4. **푸시하기**
   - 커밋 후 상단에 "Push origin" 버튼이 나타납니다
   - 클릭하면 GitHub에 업로드됩니다
   - Vercel이 자동으로 배포를 시작합니다!

---

## ❌ 잘못된 사용 방법

### "Add local repository"를 사용하는 경우

**"Add local repository"는 언제 사용하나요?**
- 새로운 저장소를 처음 추가할 때만 사용합니다
- 이미 열려있는 저장소에 파일을 업로드하는 용도가 아닙니다

**이미 저장소가 열려있다면?**
- 그냥 커밋하고 푸시하면 됩니다!
- "Add local repository"를 사용할 필요가 없습니다

---

## 🔍 저장소 경로 확인하는 방법

GitHub Desktop에서:
1. **Repository** → **Show in Explorer** 클릭
2. 열린 폴더의 경로를 확인하세요
3. 이 경로가 실제 Git 저장소입니다

또는:
1. **Repository** → **Repository Settings**
2. "Local path" 항목에서 경로 확인

---

## 📝 간단 요약

```
파일 수정 → 커밋 메시지 입력 → 커밋 → 푸시 → Vercel 자동 배포 ✅
```

"Add local repository"는 사용하지 마세요! 이미 저장소가 열려있으면 그냥 커밋하고 푸시하면 됩니다.

