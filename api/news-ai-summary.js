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

    // 데모 모드 확인
    const demoMode = isDemoMode(req);
    if (demoMode) {
      console.log('✅ [news-ai-summary] 데모 모드 감지: 토큰 체크 우회');
    }
    
    // 사용자 ID 추출
    const userId = await extractUserId(req) || req.body.userId || null;

    const { title, content, url, press, publishedAt } = req.body;

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

    // 카테고리 자동 분류 함수
    function categorizeNews(title, content) {
      const text = `${title} ${content}`.toLowerCase();
      
      // 정책/법규: 지원금, 정책, 법규, 위생, 세금, 규제, 의무사항
      if (text.match(/(지원금|보조금|정책|법규|위생|세금|규제|의무사항|행정|정부|지자체|시청|구청|국세청|식약처)/)) {
        return 'policy';
      }
      
      // 트렌드: 트렌드, 유행, 인기, 소비 패턴, 외식 트렌드, MZ세대
      if (text.match(/(트렌드|유행|인기|소비 패턴|외식 트렌드|mz세대|밀레니얼|젠z|소비자|선호|인기 메뉴|유행 메뉴)/)) {
        return 'trend';
      }
      
      // 경영 팁: 경영, 마케팅, 매출, 성공, 운영, 인건비, 비용 절감, 고객 관리
      if (text.match(/(경영|마케팅|매출|성공|운영|인건비|비용 절감|고객 관리|영업|매장|사업|창업|경영 노하우|운영 팁)/)) {
        return 'management';
      }
      
      // 식자재 정보: 식자재, 원가, 가격, 원산지, 식품 안전, 재료, 농산물
      if (text.match(/(식자재|원가|가격|원산지|식품 안전|재료|농산물|축산물|수산물|채소|과일|고기|생선|식품 가격|식재료 가격)/)) {
        return 'ingredients';
      }
      
      // 기술/도구: 기술, 도구, POS, 배달앱, 키오스크, 플랫폼, 앱, 시스템
      if (text.match(/(기술|도구|pos|배달앱|키오스크|플랫폼|앱|시스템|디지털|온라인|인터넷|소프트웨어|하드웨어|배민|쿠팡이츠|요기요)/)) {
        return 'technology';
      }
      
      // 기본값: 정책/법규
      return 'policy';
    }

    // 카테고리 자동 분류
    const category = categorizeNews(title || '', content || '');

    // 프롬프트 생성
    const prompt = `다음은 소상공인을 위한 뉴스 기사입니다. 아래 형식에 맞춰 해석을 작성해주세요.

제목: ${title || '(제목 없음)'}
내용: ${content || '(내용 없음)'}
${press ? `언론사: ${press}` : ''}
${publishedAt ? `입력 시각: ${publishedAt}` : ''}
${url ? `원문 링크: ${url}` : ''}

🧭 출력 형식

📌 제목: ${title || '뉴스 제목'}

📰 1️⃣ 뉴스 핵심 요약 (3문장 이내)

뉴스의 주요 내용을 짧고 친근한 문장으로 정리하세요.
기사 원문에서 가장 중요한 핵심 사실, 정책 방향, 변화 사항을 중심으로 명확히 요약하세요.
단순 복사가 아닌, 객관적 사실 중심으로 재작성하세요.
문어체 대신 "~한 거예요", "~하실 수 있습니다" 같은 구어체로 표현하세요.
이모티콘을 적절히 사용하여 읽기 쉽고 친근하게 작성하세요.

💬 2️⃣ 사장님 눈높이 해석

사장님들이 "내 사업에도 해당되는 이야기네"라고 느낄 수 있도록 풀어주세요.
이 뉴스가 소상공인에게 어떤 의미가 있는지 해석하세요.
경제, 정책, 금융, 마케팅, 소비 트렌드 중 관련된 관점에서 서술하세요.
어려운 정책 설명 대신, "예를 들어 이런 상황이라면 이렇게 하시면 됩니다"처럼 구체적인 비유나 예시를 넣으세요.
소상공인 입장에서 기회 요인 / 위험 요인 / 대응 전략을 구체적으로 제시하세요.
문장은 3~5줄 정도로 간결하고 따뜻한 느낌으로 구성하세요.
이모티콘을 적절히 사용하여 중요한 포인트를 강조하세요.
불필요한 정치·연예·사건 중심 뉴스의 경우 "소상공인 관련성 낮음" 문구로 표시 후 핵심 요약만 남기세요.

📌 3️⃣ 현실적 조언 3가지 (바로 쓸 수 있는 팁)

⚠️ 반드시 이 섹션을 포함해야 합니다. 생략하지 마세요.

사장님이 당장 실행할 수 있는 구체적인 3가지 행동 조언을 반드시 제시하세요.
각 조언은 "- " (하이픈과 공백)으로 시작하고, 관련 이모티콘을 앞에 붙이세요.
조언은 구체적이고 실행 가능해야 하며, 추상적인 내용이 아닌 실제 행동 지침이어야 합니다.

반드시 다음 형식으로 작성하세요:
- 💡 "구체적인 조언 1 (실행 가능한 행동)"
- 📱 "구체적인 조언 2 (실행 가능한 행동)"
- 💬 "구체적인 조언 3 (실행 가능한 행동)"

예시:
- 💡 "요즘 정부 지원사업이 많으니까, 꼭 중기부 홈페이지를 한 번 확인해보세요."
- 📱 "온라인 판매를 시작하신다면, SNS 홍보 사진을 직접 찍는 것보다 후기 사진을 활용해보세요."
- 💬 "단골 고객 관리에는 카톡보다는 네이버 톡톡을 써보시는 게 효과적이에요."

이 섹션은 반드시 포함되어야 하며, 뉴스 내용과 관련된 실질적인 조언이어야 합니다.

---

📋 출처 정보
${press ? `언론사: ${press}` : '언론사: (정보 없음)'}
${publishedAt ? `입력 시각: ${publishedAt}` : '입력 시각: (정보 없음)'}
${url ? `원문 링크: ${url}` : '원문 링크: (정보 없음)'}

⚙️ 작성 규칙

- 제목을 맨 위에 표시하고, 출처 정보(언론사, 기자, 입력 시각, 원문 링크)는 글 맨 밑에 표기하세요.
- 기사 문장을 그대로 복사하지 말고 반드시 새롭게 표현할 것.
- 정치적 의견·주관적 해석은 배제하고 소상공인 실무 관점으로만 작성.
- 문체는 분석적이되, 뉴스 브리핑처럼 간결하고 읽기 쉬운 구조로 유지.
- 기자명, 이메일, 전화번호, 카카오톡, 유튜브 구독 문구 등은 자동 제외.
- 이미지 URL은 기사 썸네일로 사용할 수 있도록 그대로 유지.
- 결과물의 어투는 "분석 리포트 + 조언형 뉴스" 스타일로 유지할 것.
- 소상공인 관련성이 낮을 경우, 다음 형식으로 정리:
  "⚠️ 본 기사는 소상공인과의 직접적 연관성이 낮아 핵심 요약만 제공합니다."
- 말투는 사근사근하고 친절한 비서처럼 작성하세요. "~해주세요", "~하시면 좋을 것 같아요", "~하는 것을 추천드려요" 같은 친근하고 배려하는 톤을 사용하세요.
- 핵심 내용은 유지하되 너무 전문적인 표현 대신 현실적이고 따뜻한 톤을 사용하세요.
- 경제 전문 용어가 있으면 짧게 풀어서 설명해주시고, 실제 사장님들의 상황에 맞는 조언을 포함해주세요.
- 이모티콘을 적절히 사용하여 내용을 더 읽기 쉽고 친근하게 만들어주세요. 예: 📰 📌 💡 💬 ⚠️ ✅ 📱 💰 등
- ⚠️ 반드시 "📌 3️⃣ 현실적 조언 3가지 (바로 쓸 수 있는 팁)" 섹션을 포함해야 합니다. 이 섹션은 생략하면 안 되며, "- " (하이픈과 공백) 형식으로 3가지 구체적인 조언을 제시해야 합니다.

위 형식에 맞춰 해석을 작성해주세요:`;

    // 토큰 한도 체크 (데모 모드일 때는 우회)
    if (userId && userId !== 'demo_user_12345') {
      const limitCheck = await checkTokenLimit(userId, 2000, demoMode);
      if (!limitCheck.success) {
        return res.status(403).json({
          success: false,
          error: limitCheck.error
        });
      }
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-5.2',
      messages: [
        {
          role: 'system',
          content: `당신은 소상공인을 위한 뉴스 해석 전문가이자 친절한 비서입니다.
뉴스를 읽고 소상공인에게 실질적으로 도움이 되는 해석을 제공해주세요.
특히 소상공인, 정책, 경제, 금융, 마케팅, 소비 트렌드 관련 뉴스를 잘 해석해주세요.
객관적이고 실무적인 관점으로 작성하며, 정치적 의견이나 주관적 해석은 배제하세요.
말투는 사근사근하고 친절한 비서처럼 작성하세요. "~해주세요", "~하시면 좋을 것 같아요", "~하는 것을 추천드려요" 같은 친근하고 배려하는 톤을 사용하세요.

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
      max_tokens: 2500
    });

    // 토큰 사용량 추적 (데모 모드일 때는 우회)
    if (userId && completion.usage && userId !== 'demo_user_12345') {
      await trackTokenUsage(userId, completion.usage, 'news-ai-summary', null, demoMode);
    } else if (demoMode || userId === 'demo_user_12345') {
      console.log('✅ [news-ai-summary] 데모 모드: 토큰 추적 우회');
    }

    const analysis = completion.choices[0].message.content;

    if (!analysis) {
      throw new Error('AI 해석 결과를 받을 수 없습니다.');
    }

    return res.status(200).json({
      success: true,
      analysis: {
        summary: analysis,
        content: analysis,
        category: category
      },
      data: {
        summary: analysis,
        content: analysis,
        category: category
      },
      category: category
    });

  } catch (error) {
    console.error('AI News Summary Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'AI 뉴스 해석에 실패했습니다.'
    });
  }
};
