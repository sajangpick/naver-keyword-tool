const OpenAI = require('openai');

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
 * AI 뉴스 해석 API
 * 
 * POST /api/news-ai-summary
 * - 뉴스 제목과 내용을 AI가 분석하여 해석 제공
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
        error: 'AI 서비스가 설정되지 않았습니다. OPENAI_API_KEY를 확인해주세요.'
      });
    }

    const { title, content, url } = req.body;

    // 입력 데이터 검증
    if (!title && !content) {
      return res.status(400).json({
        success: false,
        error: '제목 또는 내용이 필요합니다.'
      });
    }

    // 내용이 너무 긴 경우 제한
    const contentLength = (content || '').length;
    if (contentLength > 10000) {
      return res.status(400).json({
        success: false,
        error: '내용이 너무 깁니다. 10,000자 이하로 입력해주세요.'
      });
    }

    // 프롬프트 생성
    const prompt = `다음은 식당 대표님들을 위한 뉴스 기사입니다. 이 뉴스를 분석하여 실질적으로 도움이 되는 해석을 제공해주세요.

제목: ${title || '(제목 없음)'}
내용: ${content || '(내용 없음)'}
${url ? `원문 링크: ${url}` : ''}

다음 항목들을 포함하여 해석해주세요:
1. 핵심 내용 요약 (2-3문장)
2. 식당 대표님들에게 중요한 점 (왜 이 뉴스가 중요한지)
3. 실질적인 도움 (이 뉴스를 통해 얻을 수 있는 정보나 액션 아이템)
4. 주의사항이나 고려사항 (있다면)

응답 형식:
- 간결하고 명확하게 작성
- 실제 업무에 도움이 되는 정보 위주
- 전문 용어는 쉽게 설명
- 구체적인 예시나 제안 포함

해석을 작성해주세요:`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `당신은 식당 대표님들을 위한 뉴스 해석 전문가입니다.
뉴스를 읽고 실질적으로 도움이 되는 해석을 제공해주세요.
특히 외식업, 소상공인, 정책, 트렌드 관련 뉴스를 잘 해석해주세요.`
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 1500
    });

    const analysis = completion.choices[0].message.content;

    if (!analysis) {
      throw new Error('AI 해석 결과를 받을 수 없습니다.');
    }

    return res.status(200).json({
      success: true,
      analysis: {
        summary: analysis,
        content: analysis
      },
      data: {
        summary: analysis,
        content: analysis
      }
    });

  } catch (error) {
    console.error('AI News Summary Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'AI 뉴스 해석에 실패했습니다.'
    });
  }
};
