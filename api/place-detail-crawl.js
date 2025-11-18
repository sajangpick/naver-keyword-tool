// 네이버 플레이스 상세 정보 크롤링 (Render & Vercel 호환)
// 특정 place_id의 모든 데이터를 수집

// 프로덕션(Render/Vercel)에서는 chromium 사용, 로컬에서만 puppeteer 사용
const isProduction = process.env.NODE_ENV === "production";

let chromium, puppeteer;

if (isProduction) {
  // Render/Vercel: @sparticuz/chromium 사용
  chromium = require("@sparticuz/chromium");
  puppeteer = require("puppeteer-core");
} else {
  // 로컬: 일반 puppeteer 사용
  puppeteer = require("puppeteer");
}

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
        basic: {},           // 기본 정보 (업체명, 카테고리)
        contact: {},         // 연락처 (주소, 전화번호)
        business: {},        // 영업 정보 (시간, 메뉴)
        stats: {},           // 통계 (평점, 리뷰 수)
        facilities: {},      // 편의시설
        media: {},           // 미디어 (사진)
        introduction: {},    // 소개/소식 ✨ NEW
        menu: [],            // 메뉴 목록 ✨ NEW
        images: [],          // 메인 사진 5장 ✨ NEW
        receipts: {},        // 영수증 정보 ✨ NEW
      };

      // ========== 기본 정보 ==========
      // 업체명 (우선 CSS, 실패 시 og:title, 실패 시 문서 타이틀)
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
      if (!data.basic.name) {
        const og = document.querySelector('meta[property="og:title"]')?.getAttribute('content') || "";
        if (og && og.trim()) {
          // 보통 "가게명" 형태. 사이트명이 붙으면 분리
          data.basic.name = og.replace(/\s*[|-].*$/, '').trim();
        }
      }
      if (!data.basic.name && document.title) {
        data.basic.name = document.title.replace(/\s*[|-].*$/, '').trim();
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
      // 카테고리 폴백: 이름 인접 텍스트에서 작은 회색 글씨 형태가 흔함
      if (!data.basic.category && data.basic.name) {
        const nameEl = document.querySelector(".GHAhO, .place_detail_name, h1");
        const sibling = nameEl?.parentElement?.querySelector('span, div');
        const sibText = sibling?.textContent?.trim() || "";
        if (sibText && sibText.length <= 20 && !/리뷰|예약|알림|전화/.test(sibText)) {
          data.basic.category = sibText;
        }
      }

      // 평점 및 리뷰 수
      const ratingEl = document.querySelector(".PXMot, .rating, [class*='rating']");
      if (ratingEl) {
        data.stats.rating = ratingEl.textContent.trim();
      }
      // 평점 폴백: 별점 숫자가 텍스트로만 있을 수 있음 (예: 4.7)
      if (!data.stats.rating) {
        const maybeRating = Array.from(document.querySelectorAll('span, div'))
          .map(el => el.textContent?.trim() || "")
          .find(t => /^(?:[0-5](?:\.[0-9])?)$/.test(t));
        if (maybeRating) data.stats.rating = maybeRating;
      }

      // 방문자 리뷰 수 (텍스트 기반 폴백 포함)
      let visitorTextEl = document.querySelector("[class*='visitor'], [class*='review']");
      let blogTextEl = document.querySelector("[class*='blog']");
      if (!visitorTextEl || !/방문자\s*리뷰/.test(visitorTextEl.textContent)) {
        visitorTextEl = Array.from(document.querySelectorAll('span, div')).find(el => /방문자\s*리뷰/.test(el.textContent));
      }
      if (!blogTextEl || !/블로그\s*리뷰/.test(blogTextEl.textContent)) {
        blogTextEl = Array.from(document.querySelectorAll('span, div')).find(el => /블로그\s*리뷰/.test(el.textContent));
      }
      if (visitorTextEl) {
        const match = visitorTextEl.textContent.match(/(\d[\d,]*)/);
        if (match) data.stats.visitor_reviews = match[1].replace(/,/g, "");
      }
      if (blogTextEl) {
        const match = blogTextEl.textContent.match(/(\d[\d,]*)/);
        if (match) data.stats.blog_reviews = match[1].replace(/,/g, "");
      }

      // 위생등급
      const hygieneEl = document.querySelector("[class*='hygiene'], [class*='위생']");
      if (hygieneEl) {
        data.stats.hygiene_grade = hygieneEl.textContent.trim();
      }

      // ========== 연락처 정보 ==========
      // 주소 (도로명 + 지번)
      const addressElements = document.querySelectorAll('.LDgIH, [class*="address"], [class*="addr"]');
      addressElements.forEach((el) => {
        const text = el.textContent.trim().replace(/^주소\s*/, '');
        if (text) {
          // 도로명 주소 (보통 첫번째)
          if (!data.contact.road_address && !text.includes('지번')) {
            data.contact.road_address = text;
          }
          // 지번 주소 찾기
          if (text.includes('지번') || /\d+번지/.test(text)) {
            data.contact.lot_address = text.replace(/^지번\s*/, '');
          }
        }
      });
      
      // "지도" 버튼 클릭시 나오는 지번 주소도 확인
      const lotAddressEl = document.querySelector('[class*="lot"], [class*="지번"]');
      if (lotAddressEl && !data.contact.lot_address) {
        const lotText = lotAddressEl.textContent.trim();
        if (lotText) {
          data.contact.lot_address = lotText.replace(/^지번\s*/, '');
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
      // 영업시간 폴백: 본문 텍스트 내 "영업" 라인이 있는 경우
      if (!data.business.hours) {
        const hoursEl = Array.from(document.querySelectorAll('span, div')).find(el => /영업\s*시작|영업\s*시간/.test(el.textContent));
        if (hoursEl) data.business.hours = hoursEl.textContent.trim();
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

      // ========== ✨ 소개/소식 (NEW) ==========
      const introSelectors = [
        '[class*="introduction"]',
        '[class*="소개"]',
        '[class*="info"]',
        '.place_intro',
        '[class*="description"]'
      ];
      for (const sel of introSelectors) {
        const el = document.querySelector(sel);
        if (el?.textContent?.trim() && el.textContent.length > 10) {
          data.introduction.text = el.textContent.trim();
          break;
        }
      }

      // ========== ✨ 메뉴 (NEW) ==========
      const menuItems = [];
      const menuSelectors = [
        '.place_section_content .list_menu li', // 메뉴 리스트
        '[class*="menu"] li',
        '.menu_list li',
      ];
      
      for (const sel of menuSelectors) {
        const items = document.querySelectorAll(sel);
        if (items.length > 0) {
          items.forEach((item) => {
            const nameEl = item.querySelector('[class*="name"], .menu_name, strong');
            const priceEl = item.querySelector('[class*="price"], .menu_price, .price');
            
            if (nameEl) {
              const menuItem = {
                name: nameEl.textContent.trim(),
                price: priceEl ? priceEl.textContent.trim() : null
              };
              menuItems.push(menuItem);
            }
          });
          break;
        }
      }
      data.menu = menuItems;

      // ========== ✨ 메인 사진 5장 (NEW) ==========
      const imageUrls = [];
      const imgSelectors = [
        '.place_thumb img',           // 메인 썸네일
        '.photo_list img',            // 사진 리스트
        '[class*="photo"] img',
        '[class*="image"] img',
        '.swiper-slide img',          // 슬라이드
      ];

      for (const sel of imgSelectors) {
        const imgs = document.querySelectorAll(sel);
        imgs.forEach((img) => {
          const src = img.src || img.dataset.src || img.getAttribute('data-original');
          if (src && !src.includes('placeholder') && !imageUrls.includes(src)) {
            imageUrls.push(src);
          }
        });
        if (imageUrls.length >= 5) break;
      }
      data.images = imageUrls.slice(0, 5); // 최대 5장

      // ========== ✨ 신규영수증 개수 (NEW) ==========
      const receiptSelectors = [
        '[class*="receipt"]',
        '[class*="영수증"]',
        '[class*="payment"]',
        '.new_receipt_count'
      ];
      
      for (const sel of receiptSelectors) {
        const el = document.querySelector(sel);
        if (el) {
          const text = el.textContent;
          // "신규 영수증 123개" 같은 패턴 찾기
          const match = text.match(/신규.*?(\d+)/);
          if (match) {
            data.receipts.new_count = parseInt(match[1], 10);
          }
          // 전체 영수증 개수
          const totalMatch = text.match(/영수증.*?(\d+)/);
          if (totalMatch) {
            data.receipts.total_count = parseInt(totalMatch[1], 10);
          }
          break;
        }
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



