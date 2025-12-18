/**
 * RPA 브라우저 제어 모듈
 * Puppeteer 기반 Headless Browser 제어
 * 장사닥터 방식의 서버 측 브라우저 자동화
 */

const isProduction = process.env.NODE_ENV === 'production';
let chromium, puppeteer;

// 환경에 따른 Puppeteer 설정
if (isProduction) {
  // Render/Vercel: 경량 Chromium 사용
  chromium = require('@sparticuz/chromium');
  puppeteer = require('puppeteer-core');
} else {
  // 로컬: 일반 Puppeteer 사용
  puppeteer = require('puppeteer');
}

/**
 * 브라우저 인스턴스 생성
 * @returns {Promise<Object>} 브라우저 인스턴스
 */
async function createBrowser() {
  let launchOptions;
  
  if (isProduction) {
    const executablePath = await chromium.executablePath();
    launchOptions = {
      args: [
        ...chromium.args,
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
      ],
      defaultViewport: { width: 1920, height: 1080 },
      executablePath,
      headless: chromium.headless,
      ignoreHTTPSErrors: true,
    };
  } else {
    launchOptions = {
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
      headless: true,
      ignoreHTTPSErrors: true,
    };
  }
  
  return await puppeteer.launch(launchOptions);
}

/**
 * 페이지 생성 및 설정
 * @param {Object} browser - 브라우저 인스턴스
 * @param {Object} options - 옵션 (cookies, userAgent 등)
 * @returns {Promise<Object>} 페이지 인스턴스
 */
async function createPage(browser, options = {}) {
  const page = await browser.newPage();
  
  // User-Agent 설정
  if (options.userAgent) {
    await page.setUserAgent(options.userAgent);
  } else {
    // 기본 User-Agent (실제 브라우저처럼)
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );
  }
  
  // 쿠키 설정
  if (options.cookies && Array.isArray(options.cookies)) {
    await page.setCookie(...options.cookies);
  }
  
  // 뷰포트 설정
  if (options.viewport) {
    await page.setViewport(options.viewport);
  }
  
  // 추가 헤더 설정
  if (options.headers) {
    await page.setExtraHTTPHeaders(options.headers);
  }
  
  return page;
}

/**
 * 안전한 페이지 네비게이션 (재시도 로직 포함)
 * @param {Object} page - 페이지 인스턴스
 * @param {string} url - 이동할 URL
 * @param {Object} options - 옵션
 * @returns {Promise<void>}
 */
async function safeNavigate(page, url, options = {}) {
  const maxRetries = options.maxRetries || 3;
  const timeout = options.timeout || 30000;
  const waitUntil = options.waitUntil || 'networkidle2';
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      await page.goto(url, {
        waitUntil,
        timeout,
      });
      return;
    } catch (error) {
      if (i === maxRetries - 1) {
        throw new Error(`페이지 로드 실패 (${maxRetries}회 시도): ${error.message}`);
      }
      console.warn(`[재시도 ${i + 1}/${maxRetries}] 페이지 로드 실패:`, error.message);
      await new Promise(resolve => setTimeout(resolve, 2000 * (i + 1))); // 지수 백오프
    }
  }
}

/**
 * 요소 대기 및 클릭 (재시도 로직 포함)
 * @param {Object} page - 페이지 인스턴스
 * @param {string} selector - CSS 선택자
 * @param {Object} options - 옵션
 * @returns {Promise<void>}
 */
async function waitAndClick(page, selector, options = {}) {
  const timeout = options.timeout || 10000;
  const maxRetries = options.maxRetries || 3;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      await page.waitForSelector(selector, { timeout, visible: true });
      await page.click(selector);
      return;
    } catch (error) {
      if (i === maxRetries - 1) {
        throw new Error(`요소 클릭 실패 (${maxRetries}회 시도): ${error.message}`);
      }
      console.warn(`[재시도 ${i + 1}/${maxRetries}] 요소 클릭 실패:`, error.message);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

/**
 * 요소 대기 및 입력
 * @param {Object} page - 페이지 인스턴스
 * @param {string} selector - CSS 선택자
 * @param {string} text - 입력할 텍스트
 * @param {Object} options - 옵션
 * @returns {Promise<void>}
 */
async function waitAndType(page, selector, text, options = {}) {
  const timeout = options.timeout || 10000;
  const delay = options.delay || 100; // 타이핑 딜레이 (사람처럼)
  
  await page.waitForSelector(selector, { timeout, visible: true });
  
  // 기존 내용 지우기
  await page.click(selector, { clickCount: 3 }); // 전체 선택
  await page.keyboard.press('Backspace');
  
  // 텍스트 입력 (사람처럼 천천히)
  await page.type(selector, text, { delay });
}

/**
 * 스크린샷 저장 (디버깅용)
 * @param {Object} page - 페이지 인스턴스
 * @param {string} filename - 파일명
 * @returns {Promise<string>} 파일 경로
 */
async function takeScreenshot(page, filename) {
  if (!isProduction) {
    // 로컬에서만 스크린샷 저장
    const path = require('path');
    const fs = require('fs');
    const screenshotDir = path.join(__dirname, '../../screenshots');
    
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }
    
    const filepath = path.join(screenshotDir, `${filename}_${Date.now()}.png`);
    await page.screenshot({ path: filepath, fullPage: true });
    return filepath;
  }
  return null;
}

/**
 * 쿠키 가져오기
 * @param {Object} page - 페이지 인스턴스
 * @returns {Promise<Array>} 쿠키 배열
 */
async function getCookies(page) {
  return await page.cookies();
}

/**
 * 쿠키 설정
 * @param {Object} page - 페이지 인스턴스
 * @param {Array} cookies - 쿠키 배열
 * @returns {Promise<void>}
 */
async function setCookies(page, cookies) {
  if (Array.isArray(cookies) && cookies.length > 0) {
    await page.setCookie(...cookies);
  }
}

/**
 * JavaScript 실행 (페이지 내에서)
 * @param {Object} page - 페이지 인스턴스
 * @param {Function} fn - 실행할 함수
 * @param {...any} args - 함수 인자
 * @returns {Promise<any>} 실행 결과
 */
async function evaluate(page, fn, ...args) {
  return await page.evaluate(fn, ...args);
}

/**
 * 네트워크 요청 모니터링
 * @param {Object} page - 페이지 인스턴스
 * @param {Function} callback - 콜백 함수
 * @returns {Promise<void>}
 */
async function monitorNetwork(page, callback) {
  page.on('request', (request) => {
    callback('request', request);
  });
  
  page.on('response', (response) => {
    callback('response', response);
  });
  
  page.on('requestfailed', (request) => {
    callback('requestfailed', request);
  });
}

module.exports = {
  createBrowser,
  createPage,
  safeNavigate,
  waitAndClick,
  waitAndType,
  takeScreenshot,
  getCookies,
  setCookies,
  evaluate,
  monitorNetwork,
};

