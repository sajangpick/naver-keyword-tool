// 네이버 플레이스 상세 정보 크롤링 (Vercel Functions)
// 특정 place_id의 모든 데이터를 수집

const chromium = require("@sparticuz/chromium");
const puppeteer = require("puppeteer-core");

/**
 * 네이버 플레이스 상세 페이지에서 모든 정보 크롤링
 * @param {string} placeId - 네이버 플레이스 ID (예: 1390003666)
 * @param {object} options - 옵션 { timeoutMs: 30000 }
 * @returns {object} 상세 정보 객체
 */
async function crawlPlaceDetail(placeId, { timeoutMs = 30000 } = {}) {
  if (!placeId || !placeId.toString().trim()) {
    return [{ error: "place_id를 입력하세요." }, 400];
  }

  const url = `https://m.place.naver.com/restaurant/${placeId}`;
  let browser;
  let debugInfo = {
    url,
    placeId,
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
    debugInfo.steps.push("3. 네이버 플레이스 페이지 로딩 중...");
    await page.goto(url, { waitUntil: "networkidle2" });
    debugInfo.steps.push("✅ 페이지 로드 완료");

    // 잠시 대기 (동적 콘텐츠 로딩)
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // 데이터 추출
    debugInfo.steps.push("4. 상세 데이터 추출 중...");

    const placeData = await page.evaluate(() => {
      const data = {
        basic: {},
        contact: {},
        business: {},
        stats: {},
        facilities: {},
        media: {},
      };

      // ========== 기본 정보 ==========
      // 업체명
      const nameSelectors = [
        ".GHAhO", // 최신 셀렉터
        ".place_detail_name",
        "h1",
        "[class*='name']",
      ];
      for (const sel of nameSelectors) {
        const el = document.querySelector(sel);
        if (el?.textContent?.trim()) {
          data.basic.name = el.textContent.trim();
          break;
        }
      }

      // 카테고리
      const categorySelectors = [
        ".DJJvD", // 카테고리
        ".category",
        "[class*='category']",
      ];
      for (const sel of categorySelectors) {
        const el = document.querySelector(sel);
        if (el?.textContent?.trim()) {
          data.basic.category = el.textContent.trim();
          break;
        }
      }

      // 평점 및 리뷰 수
      const ratingEl = document.querySelector(".PXMot, .rating, [class*='rating']");
      if (ratingEl) {
        data.stats.rating = ratingEl.textContent.trim();
      }

      // 방문자 리뷰 수
      const visitorReviewEl = document.querySelector("[class*='visitor'], [class*='review']");
      if (visitorReviewEl) {
        const match = visitorReviewEl.textContent.match(/방문자.*?(\d+[\d,]*)/);
        if (match) data.stats.visitor_reviews = match[1].replace(/,/g, "");
      }

      // 블로그 리뷰 수
      const blogReviewEl = document.querySelector("[class*='blog']");
      if (blogReviewEl) {
        const match = blogReviewEl.textContent.match(/블로그.*?(\d+[\d,]*)/);
        if (match) data.stats.blog_reviews = match[1].replace(/,/g, "");
      }

      // 위생등급
      const hygieneEl = document.querySelector("[class*='hygiene'], [class*='위생']");
      if (hygieneEl) {
        data.stats.hygiene_grade = hygieneEl.textContent.trim();
      }

      // ========== 연락처 정보 ==========
      // 주소
      const addressSelectors = [
        ".LDgIH", // 주소
        "[class*='address']",
        "[class*='addr']",
      ];
      for (const sel of addressSelectors) {
        const el = document.querySelector(sel);
        if (el?.textContent?.trim()) {
          // "주소" 레이블 제거
          let address = el.textContent.trim();
          address = address.replace(/^주소\s*/, "");
          data.contact.address = address;
          break;
        }
      }

      // 전화번호
      const phoneSelectors = [
        "[href^='tel:']",
        ".phone",
        "[class*='phone']",
        "[class*='tel']",
      ];
      for (const sel of phoneSelectors) {
        const el = document.querySelector(sel);
        if (el) {
          const phone =
            el.getAttribute("href")?.replace("tel:", "") ||
            el.textContent?.trim();
          if (phone) {
            data.contact.phone = phone;
            break;
          }
        }
      }

      // 홈페이지/SNS
      const homepageEl = document.querySelector(
        "a[href*='instagram'], a[href*='facebook'], a[href*='http']:not([href*='naver'])"
      );
      if (homepageEl) {
        data.contact.homepage = homepageEl.getAttribute("href");
      }

      // ========== 영업 정보 ==========
      // 영업시간
      const hoursSelectors = [
        ".gKP9i", // 영업시간
        "[class*='hour']",
        "[class*='time']",
      ];
      for (const sel of hoursSelectors) {
        const el = document.querySelector(sel);
        if (el?.textContent?.trim()) {
          let hours = el.textContent.trim();
          hours = hours.replace(/^영업시간\s*/, "");
          data.business.hours = hours;
          break;
        }
      }

      // 브레이크타임
      const breakTimeEl = document.querySelector("[class*='break']");
      if (breakTimeEl) {
        data.business.break_time = breakTimeEl.textContent.trim();
      }

      // ========== 편의시설 ==========
      const facilitiesEl = document.querySelector(
        "[class*='편의'], [class*='convenience'], [class*='facility']"
      );
      if (facilitiesEl) {
        const facilitiesText = facilitiesEl.textContent.trim();
        // "편의" 레이블 제거하고 쉼표로 분리
        const facilities = facilitiesText
          .replace(/^편의\s*/, "")
          .split(",")
          .map((f) => f.trim())
          .filter((f) => f);
        data.facilities.list = facilities;
      } else {
        // 각 편의시설 항목 개별 수집
        const facilityItems = document.querySelectorAll(
          "[class*='tag'], [class*='chip']"
        );
        if (facilityItems.length > 0) {
          data.facilities.list = Array.from(facilityItems)
            .map((el) => el.textContent.trim())
            .filter((t) => t && t !== "편의");
        }
      }

      // 주차 정보
      if (
        data.facilities.list &&
        data.facilities.list.some((f) => f.includes("주차"))
      ) {
        data.facilities.parking = true;
      }

      // 예약 가능 여부
      if (
        data.facilities.list &&
        data.facilities.list.some((f) => f.includes("예약"))
      ) {
        data.facilities.reservation = true;
      }

      // ========== 미디어 정보 ==========
      // TV 방송 정보
      const tvInfoEl = document.querySelector(
        "[class*='tv'], [class*='broadcast'], [class*='방송']"
      );
      if (tvInfoEl) {
        data.media.tv_shows = tvInfoEl.textContent.trim();
      }

      // 사진 수
      const photoCountEl = document.querySelector(
        "[class*='photo'], [class*='image']"
      );
      if (photoCountEl) {
        const match = photoCountEl.textContent.match(/(\d+[\d,]*)/);
        if (match) data.media.photo_count = match[1].replace(/,/g, "");
      }

      // ========== 찾아가는 길 ==========
      const directionsEl = document.querySelector(
        "[class*='directions'], [class*='찾아가']"
      );
      if (directionsEl) {
        data.contact.directions = directionsEl.textContent.trim();
      }

      // 지하철역 정보
      const subwayEl = document.querySelector("[class*='subway'], [class*='역']");
      if (subwayEl) {
        data.contact.subway = subwayEl.textContent.trim();
      }

      return data;
    });

    debugInfo.steps.push("✅ 데이터 추출 완료");

    await browser.close();
    debugInfo.steps.push("5. 브라우저 종료");

    // 결과 반환
    return [
      {
        success: true,
        place_id: placeId,
        url,
        data: placeData,
        crawled_at: new Date().toISOString(),
        debug: debugInfo,
      },
      200,
    ];
  } catch (err) {
    console.error("크롤링 오류:", err);
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
  // CORS 헤더
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  let placeId;
  let options = {};

  if (req.method === "POST") {
    placeId = req.body?.place_id || req.body?.placeId;
    options.timeoutMs = req.body?.timeoutMs || 30000;
  } else {
    // GET 요청
    placeId = req.query?.place_id || req.query?.placeId;
    options.timeoutMs = Number(req.query?.timeoutMs) || 30000;
  }

  if (!placeId) {
    return res.status(400).json({
      error: "place_id 파라미터가 필요합니다.",
      usage: {
        method: "POST or GET",
        body: { place_id: "1390003666" },
        query: "?place_id=1390003666",
      },
    });
  }

  const [result, statusCode] = await crawlPlaceDetail(placeId, options);
  return res.status(statusCode).json(result);
};

// 로컬 테스트용
if (require.main === module) {
  (async () => {
    console.log("로컬 테스트 시작...");
    const testPlaceId = "1390003666"; // 스무고개 해운대점
    const [result, status] = await crawlPlaceDetail(testPlaceId);
    console.log("결과:", JSON.stringify(result, null, 2));
    console.log("상태:", status);
  })();
}

