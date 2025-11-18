// 🔍 네이버 플레이스 크롤링 디버깅 도구
// HTML 구조를 캡처하여 올바른 셀렉터를 찾습니다

const puppeteer = require("puppeteer");
const fs = require("fs");

async function debugCrawl(keyword = "명장동맛집") {
  console.log("🔍 네이버 플레이스 HTML 구조 분석 시작...\n");
  
  const q = encodeURIComponent(keyword);
  const listUrl = `https://m.place.naver.com/restaurant/list?query=${q}`;
  
  console.log(`📍 URL: ${listUrl}\n`);
  
  let browser;
  
  try {
    // 브라우저 실행 (화면 보이게)
    browser = await puppeteer.launch({
      headless: false,  // 화면을 보여줌
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
      defaultViewport: { width: 412, height: 915 },
    });
    
    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1"
    );
    
    console.log("⏳ 페이지 로딩 중...");
    await page.goto(listUrl, { waitUntil: "networkidle2", timeout: 30000 });
    
    console.log("✅ 페이지 로드 완료\n");
    
    // 3초 대기 (렌더링 완료)
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // 스크롤
    console.log("📜 스크롤 중...");
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
    
    console.log("✅ 스크롤 완료\n");
    
    // 스크린샷 저장
    console.log("📸 스크린샷 저장...");
    await page.screenshot({ path: "debug-screenshot.png", fullPage: true });
    console.log("✅ 스크린샷 저장됨: debug-screenshot.png\n");
    
    // HTML 저장
    console.log("💾 HTML 저장...");
    const html = await page.content();
    fs.writeFileSync("debug-page.html", html, "utf-8");
    console.log("✅ HTML 저장됨: debug-page.html\n");
    
    // 다양한 셀렉터 시도
    console.log("🔍 다양한 셀렉터 테스트 중...\n");
    
    const selectors = [
      "li.UEzoS",                    // 기존 셀렉터
      "li.TYaxT",
      "li[class*='place']",
      "li[class*='item']",
      "div[class*='place']",
      "a[href*='restaurant']",
      "a[href*='place']",
      "ul > li",
      "article",
      "[data-id]",
      "[data-place-id]",
    ];
    
    for (const selector of selectors) {
      const count = await page.evaluate((sel) => {
        return document.querySelectorAll(sel).length;
      }, selector);
      
      if (count > 0) {
        console.log(`✅ "${selector}" → ${count}개 발견`);
        
        // 첫 3개 요소의 내용 확인
        const samples = await page.evaluate((sel) => {
          const elements = Array.from(document.querySelectorAll(sel)).slice(0, 3);
          return elements.map((el, i) => ({
            index: i + 1,
            tagName: el.tagName,
            className: el.className,
            innerHTML: el.innerHTML.substring(0, 200) + "...",
            text: el.textContent?.trim().substring(0, 100) || "",
          }));
        }, selector);
        
        console.log("  샘플 데이터:");
        samples.forEach(s => {
          console.log(`    ${s.index}. <${s.tagName} class="${s.className}">`);
          console.log(`       텍스트: ${s.text}`);
        });
        console.log("");
      } else {
        console.log(`❌ "${selector}" → 0개`);
      }
    }
    
    // 모든 링크 찾기
    console.log("\n🔗 페이지의 모든 링크 분석...\n");
    const links = await page.evaluate(() => {
      const allLinks = Array.from(document.querySelectorAll("a"));
      return allLinks
        .map(a => ({
          href: a.getAttribute("href") || "",
          text: a.textContent?.trim().substring(0, 50) || "",
          classes: a.className,
        }))
        .filter(l => l.href.includes("restaurant") || l.href.includes("place"));
    });
    
    console.log(`✅ 업체 관련 링크 ${links.length}개 발견:\n`);
    links.slice(0, 5).forEach((link, i) => {
      console.log(`${i + 1}. ${link.text}`);
      console.log(`   href: ${link.href}`);
      console.log(`   class: ${link.classes}\n`);
    });
    
    // body의 모든 클래스 수집
    console.log("📋 페이지의 모든 고유 클래스 분석...\n");
    const allClasses = await page.evaluate(() => {
      const classes = new Set();
      document.querySelectorAll("*").forEach(el => {
        if (el.className && typeof el.className === "string") {
          el.className.split(" ").forEach(c => {
            if (c.trim()) classes.add(c.trim());
          });
        }
      });
      return Array.from(classes).sort();
    });
    
    const placeClasses = allClasses.filter(c => 
      c.includes("place") || 
      c.includes("item") || 
      c.includes("list") ||
      c.includes("restaurant")
    );
    
    console.log("✅ '업체' 관련 클래스:");
    placeClasses.forEach(c => console.log(`   .${c}`));
    
    console.log("\n\n⏸️  브라우저를 10초간 열어둡니다. 직접 확인하세요...");
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    await browser.close();
    
    console.log("\n" + "=".repeat(60));
    console.log("✅ 디버깅 완료!");
    console.log("=".repeat(60));
    console.log("\n📁 생성된 파일:");
    console.log("  - debug-screenshot.png  (스크린샷)");
    console.log("  - debug-page.html       (전체 HTML)");
    console.log("\n💡 위 결과를 바탕으로 셀렉터를 업데이트하세요!");
    
  } catch (err) {
    console.error("\n❌ 오류 발생:", err.message);
    console.error(err.stack);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// 실행
const keyword = process.argv[2] || "명장동맛집";
debugCrawl(keyword);

