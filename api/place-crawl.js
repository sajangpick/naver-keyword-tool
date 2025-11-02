/**
 * 블로그 생성용 플레이스 크롤링 API
 * Render & Vercel 호환
 */

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
 * URL에서 Place ID 추출
 */
function extractPlaceId(url) {
    try {
        // 패턴: restaurant/숫자 또는 place/숫자
        const match = url.match(/(?:restaurant|place)\/(\d+)/);
        if (match && match[1]) {
            return match[1];
        }
        
        // naver.me 단축 URL은 리다이렉트 필요 (현재는 미지원)
        if (url.includes('naver.me')) {
            return null;
        }
        
        return null;
    } catch (error) {
        console.error('[Place ID 추출 실패]', error);
        return null;
    }
}

/**
 * 플레이스 크롤링
 */
async function crawlPlace(placeId) {
    const url = `https://m.place.naver.com/restaurant/${placeId}`;
    let browser;

    try {
        console.log('[크롤링 시작]', url);
        
        // 환경별 브라우저 설정
        let launchOptions;
        
        if (isProduction) {
            // Render/Vercel: chromium 사용
            const executablePath = await chromium.executablePath();
            launchOptions = {
                args: [
                    ...chromium.args,
                    "--no-sandbox",
                    "--disable-setuid-sandbox",
                    "--disable-dev-shm-usage",
                    "--disable-gpu",
                ],
                defaultViewport: { width: 412, height: 915 },
                executablePath,
                headless: chromium.headless,
            };
        } else {
            // 로컬: 일반 puppeteer
            launchOptions = {
                args: [
                    "--no-sandbox",
                    "--disable-setuid-sandbox",
                    "--disable-dev-shm-usage",
                    "--disable-gpu",
                ],
                defaultViewport: { width: 412, height: 915 },
                headless: true,
            };
        }
        
        browser = await puppeteer.launch(launchOptions);

        const page = await browser.newPage();
        await page.setUserAgent(
            "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15"
        );
        
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
        await page.waitForTimeout(2000);

        const placeData = await page.evaluate(() => {
            const data = {
                basic: {},
                contact: {},
                business: {},
                stats: {},
                menu: []
            };

            // 업체명
            const nameSelectors = [".GHAhO", ".place_detail_name", "h1"];
            for (const sel of nameSelectors) {
                const el = document.querySelector(sel);
                if (el?.textContent?.trim()) {
                    data.basic.name = el.textContent.trim();
                    break;
                }
            }

            // 카테고리
            const categoryEl = document.querySelector(".DJJvD, .category");
            if (categoryEl) {
                data.basic.category = categoryEl.textContent.trim();
            }

            // 주소
            const addressSelectors = [".LDgIH", ".addr", "[class*='address']"];
            for (const sel of addressSelectors) {
                const el = document.querySelector(sel);
                if (el?.textContent?.trim()) {
                    data.contact.address = el.textContent.trim();
                    break;
                }
            }

            // 전화번호
            const phoneSelectors = [".xlx7Q", ".phone", "[class*='phone']"];
            for (const sel of phoneSelectors) {
                const el = document.querySelector(sel);
                const text = el?.textContent?.trim();
                if (text && /\d/.test(text)) {
                    data.contact.phone = text;
                    break;
                }
            }

            // 영업시간
            const hoursSelectors = [".A_cdD", ".hour", "[class*='hour']"];
            for (const sel of hoursSelectors) {
                const el = document.querySelector(sel);
                if (el?.textContent?.trim()) {
                    data.business.hours = el.textContent.trim();
                    break;
                }
            }

            // 평점
            const ratingEl = document.querySelector(".PXMot, .rating");
            if (ratingEl) {
                data.stats.rating = ratingEl.textContent.trim();
            }

            // 메뉴 (간단하게)
            const menuElements = document.querySelectorAll(".place_section_content li, .menu-item");
            menuElements.forEach(el => {
                const nameEl = el.querySelector(".menu_name, .name");
                const priceEl = el.querySelector(".price");
                if (nameEl) {
                    data.menu.push({
                        name: nameEl.textContent.trim(),
                        price: priceEl ? priceEl.textContent.trim() : ''
                    });
                }
            });

            return data;
        });

        console.log('[크롤링 완료]', placeData.basic.name);
        return placeData;

    } catch (error) {
        console.error('[크롤링 실패]', error);
        throw error;
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

/**
 * Vercel Serverless Handler
 */
module.exports = async (req, res) => {
    // CORS
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({
            success: false,
            error: 'Method not allowed'
        });
    }

    try {
        const { placeUrl } = req.body;

        if (!placeUrl) {
            return res.status(400).json({
                success: false,
                error: '플레이스 URL을 입력해주세요.'
            });
        }

        // Place ID 추출
        const placeId = extractPlaceId(placeUrl);
        if (!placeId) {
            return res.status(400).json({
                success: false,
                error: '유효하지 않은 플레이스 URL입니다.\n예: https://m.place.naver.com/restaurant/1390003666'
            });
        }

        console.log('[API] Place ID:', placeId);

        // 크롤링 실행
        const data = await crawlPlace(placeId);

        if (!data || !data.basic || !data.basic.name) {
            return res.status(500).json({
                success: false,
                error: '플레이스 정보를 가져올 수 없습니다. 직접 입력해주세요.'
            });
        }

        return res.status(200).json({
            success: true,
            data: data
        });

    } catch (error) {
        console.error('[API 오류]', error);
        return res.status(500).json({
            success: false,
            error: error.message || '크롤링 중 오류가 발생했습니다.'
        });
    }
};

