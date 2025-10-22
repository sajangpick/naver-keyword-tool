# 🕷️ 네이버 플레이스 크롤링 가이드

> **AI 작업자**: 이 프로젝트는 Puppeteer (Node.js) 대신 Selenium (Python) + pyautogui로 크롤링합니다.  
> 네이버의 봇 감지를 우회하기 위해 실제 브라우저를 제어합니다.

---

## 🎯 AI용 빠른 참조

### 현재 크롤링 방식
- **도구**: Python Selenium + pyautogui + pyperclip
- **브라우저**: Chrome (실제 브라우저, headless 아님)
- **왜 Python?**: Puppeteer headless는 네이버 봇 감지에 걸림

### 핵심 파일
- **`api/rank-list-crawl.js`**: Node.js에서 Python 크롤러 호출 (child_process)
- **`crawler/naver_place_scraper.py`**: 실제 크롤링 로직 (Selenium)
- **`api/place-batch-crawl-optimized.js`**: 배치 크롤링 (여러 업체 동시 처리)

### 주요 문제점 및 해결책
| 문제                        | 원인                    | 해결책                               |
| --------------------------- | ----------------------- | ------------------------------------ |
| Puppeteer 크롤링 실패       | 네이버 봇 감지          | Selenium + pyautogui로 전환          |
| DOM 셀렉터 변경             | 네이버 UI 업데이트      | 다중 셀렉터 + 에러 로깅              |
| Chrome 경로 오류            | 환경마다 다른 경로      | 자동 감지 + 수동 설정 옵션           |
| "데이터 수집 안됨"          | 네이버 구조 변경        | 실패 시 대체 셀렉터 시도             |

### 배포 환경별 설정
- **로컬 (Windows)**: Chrome + Python 설치 필요
- **Render**: Dockerfile로 Chrome + Python 환경 구성
- **Vercel**: 크롤링 불가 (서버리스 제약) → Render에서만 실행

---

## ⚡ 빠른 설정 가이드

### 1. Python 설치 확인

```bash
python --version
# 또는
python3 --version
```

**3.7 이상** 필요. 없으면 https://www.python.org/downloads/ 에서 설치

### 2. 필수 라이브러리 설치

```bash
# 프로젝트 폴더에서
cd crawler
pip install -r requirements.txt
```

**requirements.txt 내용**:
```txt
selenium==4.15.2
pyautogui==0.9.54
pyperclip==1.8.2
```

### 3. Chrome 드라이버 자동 설치

**selenium 4.6+**는 자동으로 ChromeDriver를 다운로드합니다.  
수동 설치 불필요!

### 4. 테스트 실행

```bash
# 크롤링 테스트
python crawler/naver_place_scraper.py "강남역맛집"
```

**성공 시 출력**:
```json
{
  "success": true,
  "items": [
    {
      "rank": 1,
      "name": "강남 고기집",
      "category": "한우",
      "url": "https://...",
      "placeId": "123456"
    },
    ...
  ]
}
```

---

## 🔧 Node.js 통합

### API 엔드포인트 구조

```
/api/rank-list-crawl?keyword=강남역맛집
  ↓
api/rank-list-crawl.js (Node.js)
  ↓ child_process.spawn
crawler/naver_place_scraper.py (Python)
  ↓ Selenium + pyautogui
네이버 플레이스 크롤링
  ↓
JSON 결과 반환
```

### 코드 예시 (`api/rank-list-crawl.js`)

```javascript
const { spawn } = require("child_process");
const path = require("path");

module.exports = async (req, res) => {
  const { keyword } = req.query;

  if (!keyword) {
    return res.status(400).json({ error: "키워드를 입력하세요" });
  }

  try {
    // Python 크롤러 실행
    const pythonProcess = spawn("python", [
      path.join(__dirname, "../crawler/naver_place_scraper.py"),
      keyword,
    ]);

    let dataString = "";

    // 출력 수집
    pythonProcess.stdout.on("data", (data) => {
      dataString += data.toString();
    });

    // 에러 처리
    pythonProcess.stderr.on("data", (data) => {
      console.error("Python 에러:", data.toString());
    });

    // 완료
    pythonProcess.on("close", (code) => {
      if (code !== 0) {
        return res.status(500).json({ error: "크롤링 실패" });
      }

      try {
        const result = JSON.parse(dataString);
        res.json(result);
      } catch (e) {
        res.status(500).json({ error: "JSON 파싱 실패" });
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
```

---

## 🐍 Python 크롤러 코드

### 기본 구조 (`crawler/naver_place_scraper.py`)

```python
import sys
import json
import time
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

def crawl_naver_place(keyword):
    # Chrome 옵션 설정
    options = webdriver.ChromeOptions()
    # options.add_argument("--headless")  # 봇 감지 우회를 위해 주석 처리
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    
    # 드라이버 초기화
    driver = webdriver.Chrome(options=options)
    
    try:
        # 네이버 플레이스 검색
        url = f"https://m.place.naver.com/restaurant/list?query={keyword}"
        driver.get(url)
        
        # 페이지 로드 대기
        time.sleep(3)
        
        # 목록 찾기
        items = driver.find_elements(By.CSS_SELECTOR, "li.UEzoS")
        
        results = []
        for idx, item in enumerate(items[:30], start=1):  # 상위 30개
            try:
                name = item.find_element(By.CSS_SELECTOR, "span.TYaxT").text
                link = item.find_element(By.CSS_SELECTOR, "a.place_bluelink")
                url = link.get_attribute("href")
                place_id = url.split("/")[-1] if url else ""
                
                results.append({
                    "rank": idx,
                    "name": name,
                    "url": url,
                    "placeId": place_id
                })
            except Exception as e:
                continue
        
        return {"success": True, "items": results}
    
    except Exception as e:
        return {"success": False, "error": str(e)}
    
    finally:
        driver.quit()

if __name__ == "__main__":
    keyword = sys.argv[1] if len(sys.argv) > 1 else "강남역맛집"
    result = crawl_naver_place(keyword)
    print(json.dumps(result, ensure_ascii=False))
```

---

## 🗄️ Supabase 연동

### 크롤링 결과 저장

```javascript
// api/place-batch-crawl-optimized.js
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function saveCrawlResults(keyword, items) {
  // places 테이블에 저장
  for (const item of items) {
    const { data, error } = await supabase
      .from("places")
      .upsert(
        {
          place_id: item.placeId,
          name: item.name,
          url: item.url,
          keyword: keyword,
          rank: item.rank,
          crawled_at: new Date().toISOString(),
        },
        { onConflict: "place_id" }
      );

    if (error) {
      console.error("저장 실패:", error);
    }
  }

  // rank_history 테이블에 순위 기록
  const { error: historyError } = await supabase.from("rank_history").insert(
    items.map((item) => ({
      place_id: item.placeId,
      keyword: keyword,
      rank: item.rank,
      recorded_at: new Date().toISOString(),
    }))
  );

  if (historyError) {
    console.error("순위 기록 실패:", historyError);
  }
}
```

---

## ⏰ 자동화 설정

### Cron Job (매일 자동 크롤링)

**Render에서 설정**:

1. Render Dashboard → 프로젝트 선택
2. "Cron Jobs" 탭 클릭
3. 새 Cron Job 추가:
   - **Command**: `node api/place-batch-crawl-optimized.js`
   - **Schedule**: `0 3 * * *` (매일 오전 3시)
4. 저장

**로컬 테스트 (node-cron)**:

```javascript
// cron-scheduler.js
const cron = require("node-cron");
const batchCrawl = require("./api/place-batch-crawl-optimized");

// 매일 오전 3시 실행
cron.schedule("0 3 * * *", async () => {
  console.log("자동 크롤링 시작:", new Date());
  await batchCrawl.execute();
  console.log("자동 크롤링 완료:", new Date());
});
```

---

## 🚀 배포 전략

### Render 배포 (권장)

**장점**:
- Python + Chrome 환경 지원
- 긴 실행 시간 허용 (30분+)
- Cron Job 자동화

**Dockerfile**:
```dockerfile
FROM python:3.10

# Chrome 설치
RUN apt-get update && apt-get install -y \
    chromium \
    chromium-driver

# Node.js 설치
RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
RUN apt-get install -y nodejs

WORKDIR /app

# Python 라이브러리
COPY crawler/requirements.txt .
RUN pip install -r requirements.txt

# Node.js 라이브러리
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm
RUN pnpm install

COPY . .

CMD ["node", "server.js"]
```

### Vercel 배포 (제약 있음)

**문제점**:
- Python 실행 불가 (서버리스 환경)
- Chrome 설치 불가
- 실행 시간 제한 (10-30초)

**대안**:
- Vercel: 프론트엔드 + API (간단한 것만)
- Render: 크롤링 전용 서버
- API 통신: Vercel → Render 크롤링 요청

---

## 🔧 트러블슈팅

### 1. "데이터 수집 안됨" (0개)

**원인**: 네이버 DOM 셀렉터 변경

**해결 방법**:

1. **실제 페이지 구조 확인**:
   ```bash
   # Python 스크립트에 디버그 추가
   print(driver.page_source)  # HTML 전체 출력
   ```

2. **대체 셀렉터 사용**:
   ```python
   # 기존 셀렉터
   items = driver.find_elements(By.CSS_SELECTOR, "li.UEzoS")
   
   # 대체 방법 1: 부모 요소에서 찾기
   items = driver.find_elements(By.CSS_SELECTOR, "ul.list > li")
   
   # 대체 방법 2: XPath 사용
   items = driver.find_elements(By.XPATH, "//li[contains(@class, 'place-item')]")
   
   # 대체 방법 3: 텍스트로 찾기
   items = driver.find_elements(By.XPATH, "//li[.//span[contains(text(), '순위')]]")
   ```

3. **네이버 구조 변경 로그 기록**:
   ```python
   # Supabase에 실패 로그 저장
   supabase.table('crawl_logs').insert({
       'keyword': keyword,
       'status': 'failed',
       'error': '셀렉터 찾기 실패',
       'page_source': driver.page_source[:1000],  # 일부만
       'timestamp': datetime.now().isoformat()
   })
   ```

### 2. Chrome 경로 오류

**증상**: `WebDriverException: unknown error: cannot find Chrome binary`

**해결 방법**:

**Windows**:
```python
options.binary_location = "C:/Program Files/Google/Chrome/Application/chrome.exe"
```

**macOS**:
```python
options.binary_location = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
```

**Linux (Render)**:
```python
options.binary_location = "/usr/bin/chromium"
```

**자동 감지 코드**:
```python
import platform

def get_chrome_path():
    system = platform.system()
    if system == "Windows":
        return "C:/Program Files/Google/Chrome/Application/chrome.exe"
    elif system == "Darwin":  # macOS
        return "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    else:  # Linux
        return "/usr/bin/chromium"

options.binary_location = get_chrome_path()
```

### 3. "봇 감지" 메시지

**증상**: 네이버에서 "자동화된 요청" 차단

**해결 방법**:

1. **headless 모드 끄기**:
   ```python
   # options.add_argument("--headless")  # 주석 처리
   ```

2. **User-Agent 변경**:
   ```python
   options.add_argument("user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
   ```

3. **자동화 감지 우회**:
   ```python
   options.add_experimental_option("excludeSwitches", ["enable-automation"])
   options.add_experimental_option("useAutomationExtension", False)
   driver.execute_cdp_cmd("Page.addScriptToEvaluateOnNewDocument", {
       "source": "Object.defineProperty(navigator, 'webdriver', {get: () => undefined})"
   })
   ```

4. **pyautogui 사용 (최종 수단)**:
   ```python
   import pyautogui
   import pyperclip
   
   # 키워드를 클립보드에 복사
   pyperclip.copy(keyword)
   
   # 검색창 클릭 (좌표 사전 확인 필요)
   pyautogui.click(500, 200)
   
   # Ctrl+V로 붙여넣기
   pyautogui.hotkey("ctrl", "v")
   
   # Enter 키 입력
   pyautogui.press("enter")
   ```

### 4. Python 프로세스 응답 없음

**증상**: Node.js에서 Python 실행 후 무한 대기

**해결 방법**:

1. **타임아웃 설정**:
   ```javascript
   const timeout = setTimeout(() => {
     pythonProcess.kill();
     res.status(500).json({ error: "크롤링 시간 초과" });
   }, 60000); // 60초

   pythonProcess.on("close", (code) => {
     clearTimeout(timeout);
     // ...
   });
   ```

2. **Python 출력 버퍼 비활성화**:
   ```javascript
   const pythonProcess = spawn("python", ["-u", "..."]); // -u 플래그 추가
   ```

3. **에러 로그 확인**:
   ```javascript
   pythonProcess.stderr.on("data", (data) => {
     console.error("Python 에러:", data.toString());
   });
   ```

### 5. Render 배포 후 Chrome 실행 실패

**증상**: `selenium.common.exceptions.WebDriverException`

**해결 방법**:

1. **Dockerfile 확인**:
   ```dockerfile
   # Chromium 및 의존성 설치
   RUN apt-get update && apt-get install -y \
       chromium \
       chromium-driver \
       fonts-liberation \
       libasound2 \
       libatk-bridge2.0-0 \
       libatk1.0-0 \
       libcups2 \
       libdbus-1-3 \
       libgdk-pixbuf2.0-0 \
       libnspr4 \
       libnss3 \
       libx11-xcb1 \
       libxcomposite1 \
       libxdamage1 \
       libxrandr2 \
       xdg-utils
   ```

2. **Python 코드에서 Chromium 경로 지정**:
   ```python
   if os.environ.get("RENDER"):  # Render 환경 감지
       options.binary_location = "/usr/bin/chromium"
       options.add_argument("--disable-gpu")
       options.add_argument("--headless")  # Render에서는 headless 필수
   ```

---

## 📚 참고 자료

### 공식 문서
- [Selenium Python 문서](https://selenium-python.readthedocs.io/)
- [PyAutoGUI 문서](https://pyautogui.readthedocs.io/)
- [ChromeDriver 다운로드](https://chromedriver.chromium.org/)

### 프로젝트 내 관련 파일
- `api/rank-list-crawl.js`: Node.js → Python 호출
- `crawler/naver_place_scraper.py`: 실제 크롤링 구현
- `api/place-batch-crawl-optimized.js`: 배치 크롤링
- `docs/AI_LOG.md`: 크롤링 방식 변경 히스토리

---

## 🎉 완료!

이제 네이버 플레이스 크롤링이 안정적으로 작동합니다! 🎊

**다음 단계**:
1. ✅ 크롤링 결과 Supabase에 저장
2. ✅ Cron Job으로 자동화
3. ✅ Render에 배포
4. ✅ 에러 모니터링 설정

**문제가 발생하면**:
- 위 "트러블슈팅" 섹션 참조
- Python 에러 로그 확인 (`pythonProcess.stderr`)
- Supabase `crawl_logs` 테이블 확인
