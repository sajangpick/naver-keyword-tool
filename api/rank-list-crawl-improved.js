// Improved Serverless crawler for Naver Place list on Vercel
// Uses puppeteer-core with @sparticuz/chromium for AWS Lambda-compatible Chromium

const chromium = require("@sparticuz/chromium");
const puppeteer = require("puppeteer-core");

async function crawlList(keyword, { maxScrolls = 6, timeoutMs = 30000 } = {}) {
  if (!keyword || !keyword.trim()) {
    return [{ error: "키워드를 입력하세요." }, 400];
  }
  
  const q = encodeURIComponent(keyword.trim());
  const url = `https://m.place.naver.com/restaurant/list?query=${q}`;

  let browser;
  let debugInfo = {
    url,
    keyword,
    timestamp: new Date().toISOString(),
    steps: [],
  };

  try {
    debugInfo.steps.push("1. Chrome 실행 시작");
    const executablePath = await chromium.executablePath();
    
    browser = await puppeteer.launch({
      args: [
        ...chromium.args,
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
      ],
      defaultViewport: { width: 412, height: 915, deviceScaleFactor: 2 },
      executablePath,
      headless: chromium.headless,
    });
    debugInfo.steps.push("✅ Chrome 실행 성공");

    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1"
    );
    page.setDefaultNavigationTimeout(timeoutMs);
    page.setDefaultTimeout(timeoutMs);
    debugInfo.steps.push("2. 페이지 생성 완료");

    // 페이지 로드
    debugInfo.steps.push("3. 네이버 페이지 로딩 중...");
    await page.goto(url, { waitUntil: "networkidle2" });
    debugInfo.steps.push("✅ 페이지 로드 완료");

    // 여러 셀렉터 시도 (네이버가 변경했을 경우 대비)
    debugInfo.steps.push("4. 리스트 컨테이너 찾는 중...");
    
    const possibleSelectors = [
      "ul.eDFz9",           // 기존 셀렉터
      "ul[class*='list']",  // 리스트 클래스 포함
      "ul",                 // 모든 ul (마지막 수단)
    ];

    let listFound = false;
    for (const selector of possibleSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 5000 });
        debugInfo.steps.push(`✅ 리스트 발견: ${selector}`);
        debugInfo.usedSelector = selector;
        listFound = true;
        break;
      } catch (e) {
        debugInfo.steps.push(`⚠️ ${selector} 없음, 다음 시도...`);
      }
    }

    if (!listFound) {
      // 페이지 스크린샷 캡처 (디버깅용)
      const screenshot = await page.screenshot({ encoding: "base64" });
      debugInfo.screenshot = `data:image/png;base64,${screenshot.substring(0, 100)}...`;
      throw new Error("리스트 컨테이너를 찾을 수 없습니다");
    }

    // 스크롤하여 더 많은 데이터 로드
    debugInfo.steps.push(`5. 스크롤 시작 (${maxScrolls}회)...`);
    for (let i = 0; i < maxScrolls; i++) {
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });
      await new Promise((resolve) => setTimeout(resolve, 1000));
      debugInfo.steps.push(`  - 스크롤 ${i + 1}/${maxScrolls}`);
    }
    debugInfo.steps.push("✅ 스크롤 완료");

    // 데이터 추출 (여러 방법 시도)
    debugInfo.steps.push("6. 데이터 추출 중...");
    
    const list = await page.evaluate(() => {
      // 여러 셀렉터 조합 시도
      const selectorCombos = [
        // 방법 1: 기존 셀렉터
        {
          item: "li.UEzoS",
          name: "span.TYaxT",
          link: "a.place_bluelink",
        },
        // 방법 2: 일반적인 클래스명
        {
          item: "li",
          name: "span.place_name, span[class*='name'], .name",
          link: "a[href*='place']",
        },
        // 방법 3: 데이터 속성
        {
          item: "li[data-index], li[data-id]",
          name: "span",
          link: "a",
        },
      ];

      let extractedList = [];

      // 각 조합을 순서대로 시도
      for (const combo of selectorCombos) {
        const items = Array.from(document.querySelectorAll(combo.item));
        
        if (items.length > 0) {
          extractedList = items
            .map((el, i) => {
              // 이름 추출
              let name = "";
              if (combo.name) {
                const nameEl = el.querySelector(combo.name);
                name = nameEl?.textContent?.trim() || "";
              }
              
              // 링크 추출
              const linkEl = el.querySelector(combo.link);
              const href = linkEl?.getAttribute("href") || "";
              
              // place_id 추출 (여러 패턴 시도)
              let placeId = "";
              const patterns = [
                /\/restaurant\/(\d+)/,
                /\/place\/(\d+)/,
                /place[_-]?id[=:](\d+)/i,
              ];
              
              for (const pattern of patterns) {
                const match = href.match(pattern);
                if (match) {
                  placeId = match[1];
                  break;
                }
              }

              // 이름이 없으면 링크 텍스트 사용
              if (!name && linkEl) {
                name = linkEl.textContent?.trim() || "";
              }

              // 최소한 이름이나 링크가 있어야 유효
              if (name || href) {
                return {
                  rank: i + 1,
                  place_name: name,
                  place_url: href,
                  place_id: placeId,
                  method: selectorCombos.indexOf(combo) + 1,
                };
              }
              return null;
            })
            .filter((item) => item !== null);

          // 데이터를 찾았으면 중단
          if (extractedList.length > 0) {
            break;
          }
        }
      }

      return extractedList;
    });

    debugInfo.steps.push(`✅ 데이터 추출 완료: ${list.length}개`);
    
    if (list.length === 0) {
      // HTML 구조 분석 정보 추가
      const pageInfo = await page.evaluate(() => {
        return {
          ulCount: document.querySelectorAll("ul").length,
          liCount: document.querySelectorAll("li").length,
          linkCount: document.querySelectorAll("a[href*='place']").length,
          bodyText: document.body.textContent.substring(0, 200),
        };
      });
      debugInfo.pageInfo = pageInfo;
      throw new Error("데이터를 추출할 수 없습니다");
    }

    return [
      {
        success: true,
        keyword,
        total: list.length,
        list,
        debug: debugInfo,
      },
      200,
    ];
  } catch (e) {
    debugInfo.steps.push(`❌ 에러: ${e.message}`);
    debugInfo.error = {
      message: e.message,
      stack: e.stack,
    };

    return [
      {
        success: false,
        error: "크롤링 오류",
        message: e.message,
        detail: String(e),
        debug: debugInfo,
      },
      500,
    ];
  } finally {
    if (browser) {
      try {
        await browser.close();
        debugInfo.steps.push("7. 브라우저 종료");
      } catch (_) {}
    }
  }
}

module.exports = async (req, res) => {
  // CORS 헤더 추가
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method Not Allowed" });
    return;
  }

  let body = req.body;
  if (!body || typeof body === "string") {
    try {
      body = JSON.parse(body || "{}");
    } catch (_) {
      body = {};
    }
  }

  const keyword = (body.keyword || "").trim();
  const maxScrolls = parseInt(body.max_scrolls || 6, 10);
  
  const [payload, status] = await crawlList(keyword, { maxScrolls });
  res.status(status).json(payload);
};

