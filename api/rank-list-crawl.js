// Serverless crawler for Naver Place list on Vercel
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
  try {
    const executablePath = await chromium.executablePath();
    browser = await puppeteer.launch({
      args: [...chromium.args, "--no-sandbox", "--disable-setuid-sandbox"],
      defaultViewport: { width: 412, height: 915, deviceScaleFactor: 2 },
      executablePath,
      headless: chromium.headless,
    });
    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1"
    );
    page.setDefaultNavigationTimeout(timeoutMs);
    page.setDefaultTimeout(timeoutMs);

    await page.goto(url, { waitUntil: "domcontentloaded" });
    // Wait for list container
    await page.waitForSelector("ul.eDFz9", { timeout: timeoutMs });

    // Scroll to load more
    for (let i = 0; i < maxScrolls; i++) {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(1000);
    }

    const list = await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll("li.UEzoS"));
      return items.map((el, i) => {
        const name = el.querySelector("span.TYaxT")?.textContent?.trim() || "";
        const a = el.querySelector("a.place_bluelink");
        const href = a?.getAttribute("href") || "";
        const m = href.match(/\/restaurant\/(\d+)/);
        const placeId = m ? m[1] : "";
        return {
          rank: i + 1,
          place_name: name,
          place_url: href,
          place_id: placeId,
        };
      });
    });

    return [{ keyword, total: list.length, list }, 200];
  } catch (e) {
    return [
      { error: "크롤링 오류", detail: String((e && e.message) || e) },
      500,
    ];
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (_) {}
    }
  }
}

module.exports = async (req, res) => {
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
