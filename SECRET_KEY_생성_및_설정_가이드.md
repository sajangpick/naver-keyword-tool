# SECRET_KEY 생성 및 설정 가이드

## 🔑 SECRET_KEY 생성 방법

### 방법 1: PowerShell에서 생성 (가장 쉬움)

PowerShell에서 아래 명령어 실행:

```powershell
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

**출력 예시:**
```
DZFSS8Dp6oS1rKy_Z0fGUhrpGRveIk-pA9mU19MZUr4=
```

이 문자열을 복사하세요!

### 방법 2: Python 파일로 생성

1. 임시 파일 생성: `generate_key.py`
2. 내용:
```python
from cryptography.fernet import Fernet
print(Fernet.generate_key().decode())
```
3. 실행:
```powershell
python generate_key.py
```

## 📝 .env 파일에 추가하기

### 1. .env 파일 찾기

프로젝트 루트 디렉토리(`최종251120`)에 `.env` 파일이 있어야 합니다.

만약 없다면:
- VS Code에서 새 파일 만들기
- 파일 이름: `.env` (점으로 시작, 확장자 없음)
- 저장 위치: 프로젝트 루트 (`D:\오연수사무실\개인\공부\최종251120\.env`)

### 2. .env 파일 내용 추가

`.env` 파일을 열고 (메모장이나 VS Code로), 아래 줄을 추가하세요:

```env
SECRET_KEY=DZFSS8Dp6oS1rKy_Z0fGUhrpGRveIk-pA9mU19MZUr4=
```

**중요:** 
- 위의 키는 예시입니다. 위에서 생성한 본인의 키를 사용하세요!
- `=` 기호도 포함해야 합니다.
- 따옴표 없이 입력하세요.

### 3. 기존 .env 파일에 추가하는 경우

만약 이미 `.env` 파일이 있고 다른 환경변수들이 있다면:

```env
# 기존 환경변수들...
SUPABASE_URL=...
SUPABASE_KEY=...

# 전화번호 암호화 키 (보안카드 역할)
SECRET_KEY=DZFSS8Dp6oS1rKy_Z0fGUhrpGRveIk-pA9mU19MZUr4=
```

파일 맨 끝에 추가하시면 됩니다.

## ✅ 설정 확인

설정이 제대로 되었는지 확인하려면:

```powershell
python api/utils/cipher_service.py encrypt "010-6664-3744"
```

오류 없이 암호화된 문자열이 나오면 성공입니다!

## 🔒 보안 주의사항

1. **절대 공개하지 마세요**: 이 키는 절대 GitHub나 다른 사람에게 공개하면 안 됩니다.
2. **.gitignore 확인**: `.env` 파일이 `.gitignore`에 포함되어 있는지 확인하세요.
3. **백업**: 이 키를 안전한 곳에 백업해두세요. 키를 잃어버리면 암호화된 데이터를 복호화할 수 없습니다.

## ❓ 문제 해결

### "SECRET_KEY가 설정되지 않았습니다" 오류

1. `.env` 파일이 프로젝트 루트에 있는지 확인
2. 파일 이름이 정확히 `.env`인지 확인 (`.env.txt` 아님!)
3. `SECRET_KEY=...` 형식이 정확한지 확인 (공백, 따옴표 없이)
4. 파일을 저장했는지 확인

### Python 명령어 오류

```powershell
pip install cryptography
```

cryptography 패키지를 설치하세요.

