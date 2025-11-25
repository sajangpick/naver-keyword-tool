const OpenAI = require('openai');
const { trackTokenUsage, checkTokenLimit, extractUserId } = require('./middleware/token-tracker');

// OpenAI 초기화 (키가 없으면 null)
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

/**
 * AI 뉴스 추천 API
 * 
 * POST /api/ai-news-recommend
 * - 외식업 관련 최신 뉴스를 AI가 찾아서 요약
 */
module.exports = async (req, res) => {
  // CORS 설정
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: '지원하지 않는 메서드입니다.' });
  }

  try {
    // OpenAI 연결 확인
    if (!openai) {
      return res.status(503).json({ 
        success: false, 
        error: 'AI service unavailable' 
      });
    }

    // 사용자 ID 추출
    const userId = await extractUserId(req) || req.body.userId || null;

    const { category } = req.body;

    // 카테고리별 프롬프트
    const categoryPrompts = {
      policy: '정책, 법규, 위생, 세금, 지원금',
      trend: '트렌드, 유행 메뉴, 소비 패턴, 외식 트렌드',
      management: '경영 팁, 마케팅, 인건비 절감, 운영 노하우',
      ingredients: '식자재, 가격, 원산지, 식품 안전',
      technology: '기술, 도구, POS, 배달앱, 키오스크'
    };

    const categoryText = category && categoryPrompts[category] 
      ? categoryPrompts[category] 
      : '외식업 전반';

    // 토큰 한도 체크
    if (userId) {
      const limitCheck = await checkTokenLimit(userId, 1000);
      if (!limitCheck.success) {
        return res.status(403).json({
          success: false,
          error: limitCheck.error
        });
      }
    }

    // ChatGPT에게 뉴스 추천 요청
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `당신은 식당 대표님들을 위한 뉴스 큐레이터입니다.
최신 외식업 관련 뉴스를 찾아서 요약하고, 왜 이 뉴스가 유용한지 설명해주세요.

응답 형식 (반드시 JSON 형식으로):
{
  "suggestions": [
    {
      "title": "뉴스 제목",
      "category": "policy|trend|management|ingredients|technology 중 하나",
      "summary": "뉴스 요약 (2-3문장)",
      "why_useful": "왜 식당 대표님들에게 유용한지 설명 (1문장)",
      "content": "뉴스 전체 내용 (5-7문장, HTML 태그 사용 가능)"
    }
  ]
}

주의사항:
- 5개의 뉴스를 추천해주세요
- 실제 최근 이슈나 일반적인 업계 정보를 기반으로 작성
- 제목은 명확하고 구체적으로
- 내용은 실질적이고 유용한 정보 위주
- 출처나 날짜는 포함하지 마세요 (AI 생성 콘텐츠이므로)`
        },
        {
          role: 'user',
          content: `${categoryText} 관련해서 식당 대표님들에게 유용한 뉴스 5개를 추천해주세요.`
        }
      ],
      temperature: 0.8,
      response_format: { type: 'json_object' }
    });

    // 토큰 사용량 추적
    if (userId && completion.usage) {
      await trackTokenUsage(userId, completion.usage, 'ai-news-recommend');
    }

    const result = JSON.parse(completion.choices[0].message.content);

    if (!result.suggestions || !Array.isArray(result.suggestions)) {
      throw new Error('AI 응답 형식이 올바르지 않습니다.');
    }

    return res.status(200).json({
      success: true,
      data: result.suggestions
    });

  } catch (error) {
    console.error('AI News Recommend Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'AI 뉴스 추천에 실패했습니다.'
    });
  }
};

