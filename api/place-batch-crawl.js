// 네이버 플레이스 배치 크롤링 (Vercel Functions)
// 키워드 검색 → 목록 수집 → 각 식당의 상세 정보 크롤링

const chromium = require("@sparticuz/chromium");
const puppeteer = require("puppeteer-core");

/**
 * 키워드로 검색한 식당 목록의 모든 상세 정보를 크롤링
 * @param {string} keyword - 검색 키워드 (예: "명장동맛집")
 * @param {object} options - 옵션
 * @param {number} options.maxPlaces - 최대 크롤링 개수 (기본: 50, 최대: 300)
 * @param {number} options.maxScrolls - 스크롤 횟수 (기본: 15)
 * @param {boolean} options.detailCrawl - 상세 정보 크롤링 여부 (기본: true)
 * @param {number} options.timeoutMs - 타임아웃 (기본: 120000)
 * @returns {Array} 식당 상세 정보 배열
 */
async function batchCrawlPlaces(
  keyword,
  {
    maxPlaces = 50,
    maxScrolls = 15,
    detailCrawl = true,
    timeoutMs = 120000,
  } = {}
) {
  if (!keyword || !keyword.trim()) {
    return [{ error: "키워드를 입력하세요." }, 400];
  }

  // 최대 300개로 제한 (서버 부하 방지)
  if (maxPlaces > 300) maxPlaces = 300;

  const q = encodeURIComponent(keyword.trim());
  const listUrl = `https://m.place.naver.com/restaurant/list?query=${q}`;

  let browser;
  let debugInfo = {
    keyword,
    maxPlaces,
    maxScrolls,
    detailCrawl,
    timestamp: new Date().toISOString(),
    steps: [],
    stats: {
      listFound: 0,
      detailCrawled: 0,
      errors: 0,
    },
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

    // ========== STEP 1: 목록 크롤링 ==========
    debugInfo.steps.push("2. 목록 페이지 로딩 중...");
    await page.goto(listUrl, { waitUntil: "networkidle2" });
    debugInfo.steps.push("✅ 목록 페이지 로드 완료");

    // 리스트 컨테이너 대기
    const possibleSelectors = [
      "ul.eDFz9",
      "ul[class*='list']",
      "ul",
    ];

    let listFound = false;
    for (const selector of possibleSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 5000 });
        debugInfo.steps.push(`✅ 리스트 발견: ${selector}`);
        listFound = true;
        break;
      } catch (e) {
        debugInfo.steps.push(`⚠️ ${selector} 없음, 다음 시도...`);
      }
    }

    if (!listFound) {
      throw new Error("리스트 컨테이너를 찾을 수 없습니다");
    }

    // 스크롤하여 더 많은 데이터 로드
    debugInfo.steps.push(`3. 스크롤 시작 (${maxScrolls}회)...`);
    for (let i = 0; i < maxScrolls; i++) {
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });
      await new Promise((resolve) => setTimeout(resolve, 1500));
      
      if ((i + 1) % 5 === 0) {
        debugInfo.steps.push(`  - 스크롤 ${i + 1}/${maxScrolls} 완료`);
      }
    }
    debugInfo.steps.push("✅ 스크롤 완료");

    // 목록 데이터 추출
    debugInfo.steps.push("4. 목록 데이터 추출 중...");
    const placeList = await page.evaluate(() => {
      const selectorCombos = [
        {
          item: "li.UEzoS",
          name: "span.TYaxT",
          link: "a.place_bluelink",
        },
        {
          item: "li",
          name: "span.place_name, span[class*='name'], .name",
          link: "a[href*='place']",
        },
      ];

      let extractedList = [];

      for (const combo of selectorCombos) {
        const items = Array.from(document.querySelectorAll(combo.item));

        if (items.length > 0) {
          extractedList = items
            .map((el, i) => {
              let name = "";
              if (combo.name) {
                const nameEl = el.querySelector(combo.name);
                name = nameEl?.textContent?.trim() || "";
              }

              const linkEl = el.querySelector(combo.link);
              const href = linkEl?.getAttribute("href") || "";

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

              if (!name && linkEl) {
                name = linkEl.textContent?.trim() || "";
              }

              if (name || href) {
                return {
                  rank: i + 1,
                  place_name: name,
                  place_url: href,
                  place_id: placeId,
                };
              }
              return null;
            })
            .filter((item) => item !== null);

          if (extractedList.length > 0) break;
        }
      }

      return extractedList;
    });

    debugInfo.stats.listFound = placeList.length;
    debugInfo.steps.push(`✅ 목록 ${placeList.length}개 발견`);

    // maxPlaces 개수만큼만 선택
    const selectedPlaces = placeList.slice(0, maxPlaces);
    debugInfo.steps.push(`5. 상위 ${selectedPlaces.length}개 선택`);

    // ========== STEP 2: 상세 정보 크롤링 (옵션) ==========
    if (!detailCrawl) {
      await browser.close();
      return [
        {
          success: true,
          keyword,
          total: selectedPlaces.length,
          places: selectedPlaces,
          crawled_at: new Date().toISOString(),
          debug: debugInfo,
        },
        200,
      ];
    }

    debugInfo.steps.push("6. 상세 정보 크롤링 시작...");
    const detailedPlaces = [];

    for (let i = 0; i < selectedPlaces.length; i++) {
      const place = selectedPlaces[i];
      
      if (!place.place_id) {
        debugInfo.steps.push(`  ⚠️ [${i + 1}/${selectedPlaces.length}] ${place.place_name}: place_id 없음, 스킵`);
        detailedPlaces.push({
          ...place,
          detail: null,
          error: "place_id 없음",
        });
        debugInfo.stats.errors++;
        continue;
      }

      try {
        debugInfo.steps.push(`  🔍 [${i + 1}/${selectedPlaces.length}] ${place.place_name} 크롤링 중...`);
        
        const detailUrl = `https://m.place.naver.com/restaurant/${place.place_id}`;
        await page.goto(detailUrl, { waitUntil: "networkidle2" });
        await new Promise((resolve) => setTimeout(resolve, 2000));

        const detail = await page.evaluate(() => {
          const data = {
            basic: {},
            contact: {},
            business: {},
            stats: {},
            facilities: {},
            media: {},
          };

          // 업체명
          const nameEl = document.querySelector(".GHAhO, .place_detail_name, h1");
          if (nameEl) data.basic.name = nameEl.textContent.trim();

          // 카테고리
          const categoryEl = document.querySelector(".DJJvD, .category");
          if (categoryEl) data.basic.category = categoryEl.textContent.trim();

          // 평점
          const ratingEl = document.querySelector(".PXMot, .rating");
          if (ratingEl) data.stats.rating = ratingEl.textContent.trim();

          // 리뷰 수 - 더 정확한 셀렉터
          const reviewCountEls = Array.from(document.querySelectorAll("span, div")).filter(
            el => el.textContent.includes("방문자리뷰") || el.textContent.includes("방문자 리뷰")
          );
          if (reviewCountEls.length > 0) {
            const match = reviewCountEls[0].textContent.match(/(\d+[\d,]*)/);
            if (match) data.stats.visitor_reviews = match[1].replace(/,/g, "");
          }

          // 블로그 리뷰
          const blogEls = Array.from(document.querySelectorAll("span, div")).filter(
            el => el.textContent.includes("블로그리뷰") || el.textContent.includes("블로그 리뷰")
          );
          if (blogEls.length > 0) {
            const match = blogEls[0].textContent.match(/(\d+[\d,]*)/);
            if (match) data.stats.blog_reviews = match[1].replace(/,/g, "");
          }

          // 주소
          const addressEls = Array.from(document.querySelectorAll("span, div")).filter(
            el => {
              const text = el.textContent;
              return text.includes("도") || text.includes("시") || text.includes("구") || text.includes("동");
            }
          );
          if (addressEls.length > 0) {
            let address = addressEls[0].textContent.trim();
            address = address.replace(/^주소\s*/, "");
            if (address.length > 10) data.contact.address = address;
          }

          // 전화번호
          const phoneEl = document.querySelector("[href^='tel:']");
          if (phoneEl) {
            data.contact.phone = phoneEl.getAttribute("href").replace("tel:", "");
          }

          // 영업시간
          const hoursEls = Array.from(document.querySelectorAll("span, div")).filter(
            el => el.textContent.includes("영업") || el.textContent.includes("시작")
          );
          if (hoursEls.length > 0) {
            data.business.hours = hoursEls[0].textContent.trim();
          }

          // 편의시설
          const facilityEls = document.querySelectorAll("[class*='tag'], [class*='chip'], [class*='badge']");
          if (facilityEls.length > 0) {
            data.facilities.list = Array.from(facilityEls)
              .map((el) => el.textContent.trim())
              .filter((t) => t && t.length < 20 && !t.includes("더보기"));
          }

          return data;
        });

        detailedPlaces.push({
          ...place,
          detail,
        });
        
        debugInfo.stats.detailCrawled++;
        
        // 진행률 표시 (10개마다)
        if ((i + 1) % 10 === 0) {
          debugInfo.steps.push(`  ✅ ${i + 1}/${selectedPlaces.length} 완료 (${Math.round((i + 1) / selectedPlaces.length * 100)}%)`);
        }
        
      } catch (err) {
        debugInfo.steps.push(`  ❌ [${i + 1}/${selectedPlaces.length}] ${place.place_name}: ${err.message}`);
        detailedPlaces.push({
          ...place,
          detail: null,
          error: err.message,
        });
        debugInfo.stats.errors++;
      }
    }

    debugInfo.steps.push(`✅ 상세 크롤링 완료 (성공: ${debugInfo.stats.detailCrawled}, 실패: ${debugInfo.stats.errors})`);

    await browser.close();
    debugInfo.steps.push("7. 브라우저 종료");

    return [
      {
        success: true,
        keyword,
        total: detailedPlaces.length,
        places: detailedPlaces,
        crawled_at: new Date().toISOString(),
        stats: debugInfo.stats,
        debug: debugInfo,
      },
      200,
    ];
  } catch (err) {
    console.error("배치 크롤링 오류:", err);
    if (browser) {
      try {
        await browser.close();
      } catch (closeErr) {
        console.error("브라우저 종료 오류:", closeErr);
      }
    }

    return [
      {
        success: false,
        error: err.message || String(err),
        debug: debugInfo,
      },
      500,
    ];
  }
}

// Vercel Serverless Function Handler
module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  let keyword, options = {};

  if (req.method === "POST") {
    keyword = req.body?.keyword;
    options.maxPlaces = req.body?.maxPlaces || 50;
    options.maxScrolls = req.body?.maxScrolls || 15;
    options.detailCrawl = req.body?.detailCrawl !== false;
    options.timeoutMs = req.body?.timeoutMs || 120000;
  } else {
    keyword = req.query?.keyword;
    options.maxPlaces = Number(req.query?.maxPlaces) || 50;
    options.maxScrolls = Number(req.query?.maxScrolls) || 15;
    options.detailCrawl = req.query?.detailCrawl !== "false";
    options.timeoutMs = Number(req.query?.timeoutMs) || 120000;
  }

  if (!keyword) {
    return res.status(400).json({
      error: "keyword 파라미터가 필요합니다.",
      usage: {
        method: "POST or GET",
        body: {
          keyword: "명장동맛집",
          maxPlaces: 50,
          maxScrolls: 15,
          detailCrawl: true,
        },
        query: "?keyword=명장동맛집&maxPlaces=50",
      },
    });
  }

  const [result, statusCode] = await batchCrawlPlaces(keyword, options);
  return res.status(statusCode).json(result);
};

// 로컬 테스트용
if (require.main === module) {
  (async () => {
    console.log("배치 크롤링 테스트 시작...");
    const testKeyword = "명장동맛집";
    const [result, status] = await batchCrawlPlaces(testKeyword, {
      maxPlaces: 10,
      maxScrolls: 5,
      detailCrawl: true,
    });
    console.log("결과:", JSON.stringify(result, null, 2));
    console.log("상태:", status);
  })();
}

