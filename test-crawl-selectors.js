// 네이버 플레이스 DOM 구조 분석 스크립트
// 로컬에서 실행하여 현재 셀렉터가 유효한지 확인

const chromium = require("@sparticuz/chromium");
const puppeteer = require("puppeteer-core");

async function testSelectors(keyword = "부산고기맛집") {
  console.log("🔍 네이버 플레이스 DOM 구조 분석 시작...\n");
  
  const q = encodeURIComponent(keyword);
  const url = `https://m.place.naver.com/restaurant/list?query=${q}`;
  console.log("📍 URL:", url, "\n");

  let browser;
  try {
    // 로컬에서는 일반 puppeteer 사용 가능
    const puppeteerLocal = require("puppeteer");
    
    browser = await puppeteerLocal.launch({
      headless: false, // 브라우저 창을 보기 위해
      defaultViewport: { width: 412, height: 915 },
    });

    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15"
    );

    console.log("🌐 페이지 로딩 중...");
    await page.goto(url, { waitUntil: "networkidle2" });
    await page.waitForTimeout(3000); // 페이지 완전 로드 대기

    console.log("✅ 페이지 로드 완료\n");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    // 1. 기존 셀렉터 테스트
    console.log("📋 [테스트 1] 기존 셀렉터 확인");
    const oldSelectors = {
      "ul.eDFz9": "리스트 컨테이너",
      "li.UEzoS": "개별 아이템",
      "span.TYaxT": "업체명",
      "a.place_bluelink": "링크",
    };

    for (const [selector, desc] of Object.entries(oldSelectors)) {
      const count = await page.evaluate((sel) => {
        return document.querySelectorAll(sel).length;
      }, selector);
      
      const status = count > 0 ? "✅" : "❌";
      console.log(`  ${status} ${selector} (${desc}): ${count}개`);
    }

    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    // 2. 현재 페이지의 실제 구조 분석
    console.log("📋 [테스트 2] 현재 페이지 구조 분석");
    
    const analysis = await page.evaluate(() => {
      // 리스트 컨테이너 찾기
      const possibleContainers = document.querySelectorAll("ul");
      console.log("UL 태그 개수:", possibleContainers.length);

      // 리스트 아이템 찾기
      const allLi = document.querySelectorAll("li");
      console.log("LI 태그 개수:", allLi.length);

      // 링크 찾기
      const allLinks = document.querySelectorAll("a[href*='place']");
      console.log("플레이스 링크 개수:", allLinks.length);

      // 첫 번째 아이템 상세 분석
      let firstItemInfo = null;
      if (allLinks.length > 0) {
        const firstLink = allLinks[0];
        const parent = firstLink.closest("li");
        
        if (parent) {
          firstItemInfo = {
            liClasses: parent.className,
            linkHref: firstLink.href,
            linkClasses: firstLink.className,
            innerText: parent.innerText.substring(0, 100),
            html: parent.outerHTML.substring(0, 500),
          };
        }
      }

      // 실제 데이터 추출 시도
      const extractedData = [];
      allLinks.forEach((link, i) => {
        if (i < 5) { // 처음 5개만
          const parent = link.closest("li");
          if (parent) {
            // 여러 방법으로 이름 찾기 시도
            const nameSpan = parent.querySelector("span.place_name, span[class*='name'], .name");
            const nameFromLink = link.textContent.trim();
            
            extractedData.push({
              rank: i + 1,
              name: nameSpan?.textContent?.trim() || nameFromLink || "이름 없음",
              href: link.href,
              parentClasses: parent.className,
            });
          }
        }
      });

      return {
        ulCount: possibleContainers.length,
        liCount: allLi.length,
        placeLinksCount: allLinks.length,
        firstItemInfo,
        extractedData,
      };
    });

    console.log("\n  📊 페이지 통계:");
    console.log(`    - UL 태그: ${analysis.ulCount}개`);
    console.log(`    - LI 태그: ${analysis.liCount}개`);
    console.log(`    - 플레이스 링크: ${analysis.placeLinksCount}개`);

    if (analysis.firstItemInfo) {
      console.log("\n  🔍 첫 번째 아이템 분석:");
      console.log(`    - LI 클래스: "${analysis.firstItemInfo.liClasses}"`);
      console.log(`    - 링크 클래스: "${analysis.firstItemInfo.linkClasses}"`);
      console.log(`    - 링크 URL: ${analysis.firstItemInfo.linkHref}`);
      console.log(`    - 텍스트 미리보기: ${analysis.firstItemInfo.innerText.substring(0, 50)}...`);
      console.log(`\n    - HTML 미리보기:`);
      console.log(`      ${analysis.firstItemInfo.html.substring(0, 200)}...`);
    }

    if (analysis.extractedData.length > 0) {
      console.log("\n  📝 추출된 데이터 (상위 5개):");
      analysis.extractedData.forEach((item) => {
        console.log(`    ${item.rank}. ${item.name}`);
        console.log(`       클래스: ${item.parentClasses}`);
        console.log(`       URL: ${item.href}`);
      });
    }

    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    // 3. 스크린샷 저장
    await page.screenshot({ path: "naver-place-page.png", fullPage: true });
    console.log("📸 스크린샷 저장: naver-place-page.png\n");

    // 4. HTML 저장
    const html = await page.content();
    const fs = require("fs");
    fs.writeFileSync("naver-place-page.html", html);
    console.log("💾 HTML 저장: naver-place-page.html\n");

    console.log("✅ 분석 완료!\n");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    // 10초 대기 후 종료
    console.log("⏱️  10초 후 브라우저 종료...");
    await page.waitForTimeout(10000);

  } catch (e) {
    console.error("\n❌ 에러 발생:");
    console.error(e);
  } finally {
    if (browser) {
      await browser.close();
      console.log("\n🔚 브라우저 종료");
    }
  }
}

// 실행
testSelectors().catch(console.error);

