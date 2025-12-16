// AI 답글 생성 + 네이버 스마트플레이스 등록 API
// 사용자가 버튼 클릭 시 실행됩니다

const { createClient } = require('@supabase/supabase-js');
const { OpenAI } = require('openai');
const CryptoJS = require('crypto-js');
const { trackTokenUsage, checkTokenLimit, isDemoMode } = require('../middleware/token-tracker');

// Puppeteer 환경 설정 (Render/Vercel 호환)
const isProduction = process.env.NODE_ENV === 'production';
let chromium, puppeteer;

if (isProduction) {
  // Render/Vercel: @sparticuz/chromium 사용 (경량 Chromium 바이너리)
  chromium = require('@sparticuz/chromium');
  puppeteer = require('puppeteer-core');
} else {
  // 로컬: 일반 puppeteer 사용 (자동 Chrome 다운로드)
  puppeteer = require('puppeteer');
}

// Supabase 클라이언트 초기화
let supabase = null;
if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
  supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

// OpenAI 클라이언트 초기화
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// 암호화 키
const ENCRYPTION_KEY = process.env.NAVER_ENCRYPTION_KEY || 'default-key-change-in-production';

// 복호화 함수
function decrypt(encryptedText) {
  const bytes = CryptoJS.AES.decrypt(encryptedText, ENCRYPTION_KEY);
  return bytes.toString(CryptoJS.enc.Utf8);
}

// 쿠키 문자열을 배열로 변환
function parseCookies(cookieString) {
  try {
    return JSON.parse(cookieString);
  } catch {
    return [];
  }
}

// AI 답글 생성
async function generateAIReply(reviewText, replyTone, placeName) {
  const tonePrompts = {
    friendly: `당신은 네이버 플레이스 리뷰 답글 작성 전문가입니다. (친근한 톤)

**핵심 원칙:**
- 50자 이내로 간결하게 작성
- 이모지 1-2개 자연스럽게 사용
- 따뜻하고 친근한 존댓말
- 진심 어린 감사 인사

**답글 예시:**
"감사합니다! 😊 다음에도 맛있게 드실 수 있도록 더 노력하겠습니다. 또 뵙겠습니다!"

위 형식에 맞춰 답글만 작성해주세요. 다른 설명은 하지 마세요.`,

    professional: `당신은 네이버 플레이스 리뷰 답글 작성 전문가입니다. (전문적인 톤)

**핵심 원칙:**
- 70자 이내로 정중하게 작성
- 이모지 사용 최소화
- 격식 있고 예의 바른 존댓말
- 전문적이고 신뢰감 있는 표현

**답글 예시:**
"소중한 리뷰 감사드립니다. 고객님의 만족이 저희의 최우선 가치입니다. 더욱 노력하는 ${placeName}이 되겠습니다."

위 형식에 맞춰 답글만 작성해주세요. 다른 설명은 하지 마세요.`,

    casual: `당신은 네이버 플레이스 리뷰 답글 작성 전문가입니다. (캐주얼 톤)

**핵심 원칙:**
- 40자 이내로 짧고 간결하게
- 반말 가능 (친근한 느낌)
- 이모지 적절히 사용
- 편안하고 자연스러운 표현

**답글 예시:**
"고마워요! 😄 또 오세요~"

위 형식에 맞춰 답글만 작성해주세요. 다른 설명은 하지 마세요.`
  };

  const systemPrompt = tonePrompts[replyTone] || tonePrompts.friendly;

  const userPrompt = `[고객 리뷰]
${reviewText}

위 리뷰에 대한 ${replyTone === 'friendly' ? '친근한' : replyTone === 'professional' ? '전문적인' : '캐주얼'} 톤의 답글을 작성해주세요.`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-5.2',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    temperature: 0.7,
    max_tokens: 200
  });

  return completion.choices[0].message.content.trim();
}

// 네이버 스마트플레이스에 답글 등록
async function registerReplyOnNaver(connection, reviewId, replyText) {
  let launchOptions;
  
  if (isProduction) {
    // Render/Vercel: chromium 사용
    const executablePath = await chromium.executablePath();
    launchOptions = {
      args: [
        ...chromium.args,
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
      defaultViewport: { width: 1920, height: 1080 },
      executablePath,
      headless: chromium.headless,
    };
  } else {
    // 로컬: 일반 puppeteer
    launchOptions = {
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
      headless: true,
    };
  }
  
  const browser = await puppeteer.launch(launchOptions);

  const page = await browser.newPage();

  try {
    // 세션 쿠키 설정
    const cookies = parseCookies(connection.session_cookies || '[]');
    if (cookies.length > 0) {
      await page.setCookie(...cookies);
    }

    // 리뷰 답글 페이지로 이동
    const replyUrl = `https://m.place.naver.com/my-place/${connection.place_id}/review/${reviewId}`;
    await page.goto(replyUrl, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    // 로그인 필요 여부 확인
    const isLoginRequired = await page.evaluate(() => {
      return document.body.textContent.includes('로그인') || 
             document.body.textContent.includes('로그인이 필요');
    });

    if (isLoginRequired) {
      // 재로그인
      const naverId = decrypt(connection.naver_id_encrypted);
      const naverPassword = decrypt(connection.naver_password_encrypted);

      await page.goto('https://nid.naver.com/nidlogin.login', {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      await page.waitForSelector('#id', { timeout: 10000 });
      await page.type('#id', naverId, { delay: 100 });
      await page.waitForSelector('#pw', { timeout: 10000 });
      await page.type('#pw', naverPassword, { delay: 100 });
      await page.click('#log\\.login');
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });

      // 답글 페이지로 다시 이동
      await page.goto(replyUrl, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      // 새 쿠키 저장
      const newCookies = await page.cookies();
      await supabase
        .from('naver_place_connections')
        .update({ session_cookies: JSON.stringify(newCookies) })
        .eq('id', connection.id);
    }

    // 답글 입력란 찾기 및 입력
    await page.waitForSelector('textarea, [contenteditable="true"], input[type="text"]', {
      timeout: 10000
    });

    // 여러 선택자 시도
    const textareaSelectors = [
      'textarea',
      '[contenteditable="true"]',
      'input[type="text"]',
      '[class*="reply"]',
      '[class*="comment"]'
    ];

    let inputElement = null;
    for (const selector of textareaSelectors) {
      try {
        inputElement = await page.$(selector);
        if (inputElement) break;
      } catch (e) {
        continue;
      }
    }

    if (!inputElement) {
      throw new Error('답글 입력란을 찾을 수 없습니다');
    }

    // 답글 입력
    await inputElement.click();
    await page.type(textareaSelectors[0], replyText, { delay: 50 });

    // 등록 버튼 클릭
    const submitSelectors = [
      'button[type="submit"]',
      'button:contains("등록")',
      'button:contains("작성")',
      '[class*="submit"]',
      '[class*="register"]'
    ];

    let submitButton = null;
    for (const selector of submitSelectors) {
      try {
        submitButton = await page.$(selector);
        if (submitButton) break;
      } catch (e) {
        continue;
      }
    }

    if (!submitButton) {
      // 모든 버튼 중 "등록" 텍스트가 있는 것 찾기
      submitButton = await page.evaluateHandle(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        return buttons.find(btn => btn.textContent.includes('등록') || btn.textContent.includes('작성'));
      });
    }

    if (submitButton) {
      await submitButton.click();
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }).catch(() => {
        // 네비게이션이 없어도 성공할 수 있음
      });
    } else {
      throw new Error('등록 버튼을 찾을 수 없습니다');
    }

    await browser.close();
    return { success: true };

  } catch (error) {
    await browser.close();
    throw error;
  }
}

module.exports = async (req, res) => {
  try {
    // CORS 헤더 설정
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, user-id');

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    if (req.method !== 'POST') {
      return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    const userId = req.headers['user-id'] || req.body.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: '사용자 ID가 필요합니다' });
    }

    const { reviewId } = req.body;

    if (!reviewId) {
      return res.status(400).json({
        success: false,
        error: '리뷰 ID가 필요합니다'
      });
    }

    console.log(`[AI 답글 등록] 사용자 ${userId} - 리뷰 ID: ${reviewId}`);

    // 리뷰 정보 가져오기
    const { data: review, error: reviewError } = await supabase
      .from('naver_reviews')
      .select(`
        *,
        naver_place_connections (
          id,
          place_id,
          place_name,
          reply_tone,
          naver_id_encrypted,
          naver_password_encrypted,
          session_cookies
        )
      `)
      .eq('id', reviewId)
      .eq('user_id', userId)
      .single();

    if (reviewError || !review) {
      return res.status(404).json({
        success: false,
        error: '리뷰를 찾을 수 없습니다'
      });
    }

    if (review.reply_status === 'registered') {
      return res.status(400).json({
        success: false,
        error: '이미 등록된 답글입니다'
      });
    }

    const connection = review.naver_place_connections;

    // 데모 모드 확인
    const demoMode = isDemoMode(req);
    if (demoMode) {
      console.log('✅ [naver/auto-reply] 데모 모드 감지: 토큰 체크 우회');
    }

    // 토큰 한도 체크 (데모 모드일 때는 우회)
    if (userId && userId !== 'demo_user_12345') {
      const limitCheck = await checkTokenLimit(userId, 500, demoMode);
      if (!limitCheck.success) {
        return res.status(403).json({
          success: false,
          error: limitCheck.error
        });
      }
    }

    // AI 답글 생성
    let aiReply;
    try {
      aiReply = await generateAIReply(
        review.review_text,
        connection.reply_tone || 'friendly',
        connection.place_name || ''
      );

      // 토큰 사용량 추적 (데모 모드일 때는 우회)
      if (userId && userId !== 'demo_user_12345') {
        await trackTokenUsage(userId, { total_tokens: 200 }, 'naver-auto-reply', null, demoMode);
      } else if (demoMode || userId === 'demo_user_12345') {
        console.log('✅ [naver/auto-reply] 데모 모드: 토큰 추적 우회');
      }
    } catch (error) {
      console.error('[AI 답글 생성] 실패:', error);
      return res.status(500).json({
        success: false,
        error: 'AI 답글 생성 실패: ' + error.message
      });
    }

    // DB에 답글 저장
    const { error: updateError } = await supabase
      .from('naver_reviews')
      .update({
        ai_reply_text: aiReply,
        reply_status: 'processing'
      })
      .eq('id', reviewId);

    if (updateError) {
      console.error('[DB 업데이트] 실패:', updateError);
      return res.status(500).json({
        success: false,
        error: '답글 저장 실패: ' + updateError.message
      });
    }

    // 네이버 스마트플레이스에 답글 등록
    try {
      await registerReplyOnNaver(connection, review.naver_review_id, aiReply);

      // 등록 성공
      await supabase
        .from('naver_reviews')
        .update({
          reply_status: 'registered',
          registered_at: new Date().toISOString()
        })
        .eq('id', reviewId);

      // 통계 업데이트
      const { count: pendingCount } = await supabase
        .from('naver_reviews')
        .select('*', { count: 'exact', head: true })
        .eq('connection_id', connection.id)
        .eq('reply_status', 'pending');

      await supabase
        .from('naver_place_connections')
        .update({ pending_replies: pendingCount || 0 })
        .eq('id', connection.id);

      console.log(`[AI 답글 등록] 성공 - 리뷰 ID: ${reviewId}`);

      res.json({
        success: true,
        message: '네이버 스마트플레이스에 답글이 등록되었습니다!',
        reply: aiReply
      });

    } catch (error) {
      console.error('[네이버 등록] 실패:', error);

      // 실패 상태 저장
      await supabase
        .from('naver_reviews')
        .update({
          reply_status: 'failed',
          error_message: error.message
        })
        .eq('id', reviewId);

      return res.status(500).json({
        success: false,
        error: '네이버 등록 실패: ' + error.message
      });
    }

  } catch (error) {
    console.error('[AI 답글 등록] 오류:', error);
    res.status(500).json({
      success: false,
      error: '답글 등록 중 오류가 발생했습니다: ' + error.message
    });
  }
};

