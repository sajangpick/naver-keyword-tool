# .env 예시

아래 내용을 `.env` 파일로 복사해 사용하세요.

```bash
# Server
PORT=10000
NODE_ENV=development
# CORS_ORIGIN: 단일 또는 콤마(,)로 구분된 다중 도메인 허용
# 예) http://localhost:10000 또는 https://www.example.com,https://staging.example.com
CORS_ORIGIN=https://www.sajangpick.co.kr,https://sajangpick.co.kr

# Naver Ads API (SearchAd)
NAVER_CUSTOMER_ID=
NAVER_API_KEY=
NAVER_SECRET_KEY=

# Naver OpenAPI (Local Search)
NAVER_SEARCH_CLIENT_ID=
NAVER_SEARCH_CLIENT_SECRET=

# Naver DataLab (Trends)
NAVER_DATALAB_CLIENT_ID=
NAVER_DATALAB_CLIENT_SECRET=

# OpenAI
OPENAI_API_KEY=

# Google Gemini
GEMINI_API_KEY=

# Anthropic Claude
CLAUDE_API_KEY=

# Kakao OAuth
KAKAO_REST_API_KEY=
KAKAO_REDIRECT_URI=https://www.sajangpick.co.kr/auth/kakao/callback
# 선택(활성화되어 있으면 토큰 교환에 포함)
KAKAO_CLIENT_SECRET=

# Auth / JWT
# 반드시 충분히 긴 랜덤 문자열로 설정하고 환경별(.env, .env.production)로 분리하세요.
JWT_SECRET=

# CSP
# true로 설정 시 CSP를 Report-Only에서 Enforce로 전환합니다.
CSP_ENFORCE=false

# Feature Flags
FEATURE_API_READ_NEXT=false
FEATURE_API_CHAT_NEXT=false
FEATURE_AUTH_NEXT=false
```
