const OpenAI = require('openai');
const { createClient } = require('@supabase/supabase-js');
const { trackTokenUsage, checkTokenLimit, extractUserId } = require('./middleware/token-tracker');

// OpenAI 초기화
let openai = null;
if (process.env.OPENAI_API_KEY) {
  try {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  } catch (error) {
    console.error('OpenAI 초기화 실패:', error.message);
  }
}

// Supabase 초기화
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
let supabase = null;
if (supabaseUrl && supabaseKey) {
  try {
    supabase = createClient(supabaseUrl, supabaseKey);
  } catch (error) {
    console.error('Supabase 초기화 실패:', error.message);
  }
}

/**
 * 오늘 하루 경제/사회 뉴스 AI 해석 API
 * 
 * GET /api/daily-news-analysis
 * - 오늘 날짜의 경제/사회 카테고리 뉴스를 가져와서 AI로 종합 해석
 */
module.exports = async (req, res) => {
  // CORS 설정
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: '지원하지 않는 메서드입니다.' });
  }

  try {
    // OpenAI 및 Supabase 연결 확인
    if (!openai) {
      return res.status(503).json({ 
        success: false, 
        error: 'OpenAI 서비스를 사용할 수 없습니다.' 
      });
    }

    if (!supabase) {
      return res.status(503).json({ 
        success: false, 
        error: 'Database 서비스를 사용할 수 없습니다.' 
      });
    }

    // 사용자 ID 추출 (토큰 추적용)
    const userId = extractUserId(req);

    // 오늘 날짜 계산 (한국 시간 기준)
    const now = new Date();
    const koreaTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
    const todayStart = new Date(koreaTime);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(koreaTime);
    todayEnd.setHours(23, 59, 59, 999);

    // 오늘 날짜의 경제/사회 뉴스 가져오기
    // 정책/법규, 트렌드 카테고리 또는 제목/내용에 경제/사회 관련 키워드가 있는 뉴스
    const { data: todayNews, error: newsError } = await supabase
      .from('news_board')
      .select('*')
      .in('category', ['정책/법규', '트렌드', '경영 팁'])
      .gte('created_at', todayStart.toISOString())
      .lte('created_at', todayEnd.toISOString())
      .order('created_at', { ascending: false })
      .limit(20);

    if (newsError) {
      console.error('[daily-news-analysis] 뉴스 조회 오류:', newsError);
      return res.status(500).json({ 
        success: false, 
        error: '뉴스를 불러오는데 실패했습니다.' 
      });
    }

    // 뉴스가 없으면 안내 메시지
    if (!todayNews || todayNews.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          analysis: '오늘 등록된 경제/사회 뉴스가 없습니다. 내일 다시 확인해주세요! 📰',
          newsCount: 0,
          date: koreaTime.toLocaleDateString('ko-KR')
        }
      });
    }

    // 뉴스 제목과 요약만 추출 (AI 프롬프트용)
    const newsSummary = todayNews.map((news, index) => {
      const content = news.content.replace(/<[^>]*>/g, '').substring(0, 200);
      return `${index + 1}. [${news.category}] ${news.title}\n   ${content}...`;
    }).join('\n\n');

    // 토큰 한도 체크
    if (userId) {
      const limitCheck = await checkTokenLimit(userId, 3000);
      if (!limitCheck.success) {
        return res.status(403).json({
          success: false,
          error: limitCheck.error
        });
      }
    }

    // AI에게 오늘의 뉴스를 종합 해석 요청
    const todayDate = koreaTime.toLocaleDateString('ko-KR', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      weekday: 'long'
    });

    const prompt = `오늘(${todayDate}) 식당 대표님들을 위해 등록된 경제/사회 뉴스 ${todayNews.length}개를 종합적으로 해석해주세요.

📰 오늘의 뉴스 목록:
${newsSummary}

⚙️ 작성 규칙:
- 오늘의 경제/사회 뉴스를 종합적으로 분석하여 식당 대표님들에게 실질적으로 도움이 되는 해석을 제공해주세요.
- 정치적 의견이나 주관적 해석은 배제하고, 객관적이고 실무적인 관점으로 작성해주세요.
- 말투는 사근사근하고 친절한 비서처럼 작성해주세요. "~해주세요", "~하시면 좋을 것 같아요", "~하는 것을 추천드려요" 같은 친근하고 배려하는 톤을 사용해주세요.
- 핵심 내용은 유지하되 너무 전문적인 표현 대신 현실적이고 따뜻한 톤을 사용해주세요.
- 경제 전문 용어가 있으면 짧게 풀어서 설명해주시고, 실제 사장님들의 상황에 맞는 조언을 포함해주세요.
- 이모티콘을 적절히 사용하여 내용을 더 읽기 쉽고 친근하게 만들어주세요. 예: 📰 📌 💡 💬 ⚠️ ✅ 📱 💰 🎯 등

📋 작성 형식:
1. 📰 오늘의 주요 이슈 (3-5개 핵심 뉴스 요약)
2. 💡 종합 분석 (전체적인 흐름과 의미)
3. 📌 3️⃣ 현실적 조언 3가지 (바로 쓸 수 있는 팁)
   - 각 조언 앞에 관련 이모티콘을 붙이고, 실제로 사장님이 당장 실행할 수 있는 구체적인 행동 지침이어야 합니다.
4. 🎯 주의사항 (있다면)

위 형식에 맞춰 해석을 작성해주세요:`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `당신은 식당 대표님들을 위한 뉴스 해석 전문가이자 친절한 비서입니다.
오늘의 경제/사회 뉴스를 읽고 식당 대표님들에게 실질적으로 도움이 되는 종합 해석을 제공해주세요.
객관적이고 실무적인 관점으로 작성하며, 정치적 의견이나 주관적 해석은 배제하세요.
말투는 사근사근하고 친절한 비서처럼 작성하세요.

⚠️ 중요: 반드시 "📌 3️⃣ 현실적 조언 3가지 (바로 쓸 수 있는 팁)" 섹션을 포함해야 합니다.
이 섹션은 생략하면 안 되며, 구체적이고 실행 가능한 3가지 조언을 "- " (하이픈과 공백) 형식으로 제시해야 합니다.
각 조언 앞에 관련 이모티콘을 붙이고, 실제로 사장님이 당장 실행할 수 있는 구체적인 행동 지침이어야 합니다.`
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 3000
    });

    // 토큰 사용량 추적
    if (userId && completion.usage) {
      await trackTokenUsage(userId, completion.usage, 'daily-news-analysis');
    }

    const analysis = completion.choices[0].message.content;

    if (!analysis) {
      throw new Error('AI 해석 생성에 실패했습니다.');
    }

    return res.status(200).json({
      success: true,
      data: {
        analysis,
        newsCount: todayNews.length,
        date: todayDate,
        newsTitles: todayNews.map(n => n.title)
      }
    });

  } catch (error) {
    console.error('[daily-news-analysis] 오류:', error);
    return res.status(500).json({
      success: false,
      error: 'AI 해석 생성 중 오류가 발생했습니다.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

