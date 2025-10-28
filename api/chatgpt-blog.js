/**
 * ChatGPT 블로그 생성 API
 * 프롬프트 설계서(blog-prompts_사무실작.md)를 기반으로 4단계 프로세스 구현
 * 
 * 단계:
 * 1. 플레이스 정보 크롤링 (또는 사용자 입력 구조화)
 * 2. 대표 메뉴 분석
 * 3. 블로그 주제 추천 (5개)
 * 4. 블로그 글 생성 (2000자)
 */

const OpenAI = require('openai');

// OpenAI 클라이언트 초기화
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

/**
 * 1단계: 플레이스 정보 크롤링 (또는 구조화)
 * 
 * 참고: ChatGPT는 실제로 웹 크롤링을 할 수 없습니다.
 * 이 함수는 두 가지 방식으로 작동합니다:
 * 1. URL이 제공된 경우: 별도의 크롤러(Puppeteer 등)를 사용하여 실제 크롤링
 * 2. URL이 없는 경우: 사용자가 입력한 정보를 구조화
 */
async function crawlOrStructurePlaceInfo(url, userInput) {
    if (url) {
        // TODO: 실제 크롤링 구현 (Puppeteer/Playwright)
        // 현재는 사용자 입력으로 대체
        console.log('[크롤링] URL 제공됨, 하지만 현재는 사용자 입력 사용:', url);
    }

    // 사용자 입력 정보를 구조화
    const placeInfo = {
        name: userInput.companyName,
        address: userInput.companyAddress,
        phone: userInput.phone || '',
        rating: 0, // 크롤링 시 채워질 값
        reviewCount: 0, // 크롤링 시 채워질 값
        category: userInput.category || '음식점',
        description: userInput.keywords || '',
        hours: userInput.businessHours,
        mainMenu: userInput.mainMenu.split(',').map(m => m.trim()),
        landmarks: userInput.landmarks ? userInput.landmarks.split(',').map(l => l.trim()) : [],
        keywords: userInput.keywords ? userInput.keywords.split(',').map(k => k.trim()) : [],
        strengths: '',
        targetCustomers: '',
        atmosphere: '',
        region: userInput.companyAddress.split(' ').slice(0, 2).join(' ')
    };

    // ChatGPT를 사용하여 정보 보강
    try {
        const prompt = `
다음은 가게의 기본 정보입니다:

- 가게명: ${placeInfo.name}
- 주소: ${placeInfo.address}
- 영업시간: ${placeInfo.hours}
- 대표메뉴: ${placeInfo.mainMenu.join(', ')}
- 주변 랜드마크: ${placeInfo.landmarks.join(', ')}
- 키워드: ${placeInfo.keywords.join(', ')}

위 정보를 바탕으로 다음을 추론해주세요:

1. 가게의 주요 강점 3가지 (문장으로)
2. 예상 주요 고객층 (연령대, 방문 목적 등)
3. 가게 분위기 키워드 3-5개

JSON 형식으로 답변해주세요:
{
  "strengths": "강점 문장",
  "targetCustomers": "고객층 설명",
  "atmosphere": "분위기1, 분위기2, 분위기3"
}
`;

        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: "당신은 맛집 마케팅 전문가입니다. JSON 형식으로만 답변하세요." },
                { role: "user", content: prompt }
            ],
            temperature: 0.7,
            response_format: { type: "json_object" }
        });

        const enrichedData = JSON.parse(completion.choices[0].message.content);
        placeInfo.strengths = enrichedData.strengths || '';
        placeInfo.targetCustomers = enrichedData.targetCustomers || '';
        placeInfo.atmosphere = enrichedData.atmosphere || '';

    } catch (error) {
        console.error('[크롤링 단계] ChatGPT 정보 보강 실패:', error);
        // 기본값 사용
        placeInfo.strengths = placeInfo.keywords.join(', ');
        placeInfo.targetCustomers = '다양한 연령대의 고객';
        placeInfo.atmosphere = '편안하고 따뜻한 분위기';
    }

    return placeInfo;
}

/**
 * 2단계: 대표 메뉴 분석
 */
async function analyzeMainMenu(placeInfo) {
    const prompt = `
[가게 정보]
- 가게명: ${placeInfo.name}
- 위치: ${placeInfo.address}
- 카테고리: ${placeInfo.category}
- 대표 메뉴: ${placeInfo.mainMenu.join(', ')}
- 가게 특징: ${placeInfo.keywords.join(', ')}

위 정보를 바탕으로 다음을 분석해주세요:

1. 각 메뉴의 특징과 강점
2. 메뉴별 추천 포인트
3. 메뉴와 어울리는 계절/상황
4. 경쟁 업체 대비 차별화 포인트
5. 고객들이 좋아할 만한 이유

이 정보를 블로그 글 작성에 활용할 수 있도록 구조화해주세요.

JSON 형식으로 답변해주세요:
{
  "menuAnalysis": [
    {
      "menuName": "메뉴명",
      "features": "특징과 강점",
      "recommendations": "추천 포인트",
      "bestFor": "어울리는 계절/상황",
      "differentiation": "차별화 포인트",
      "customerAppeal": "고객 매력 포인트"
    }
  ],
  "overallSummary": "전체 메뉴 요약"
}
`;

    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: "당신은 음식 메뉴 분석 전문가입니다. JSON 형식으로만 답변하세요." },
                { role: "user", content: prompt }
            ],
            temperature: 0.7,
            response_format: { type: "json_object" }
        });

        return JSON.parse(completion.choices[0].message.content);
    } catch (error) {
        console.error('[메뉴 분석 단계] 오류:', error);
        throw new Error('메뉴 분석에 실패했습니다: ' + error.message);
    }
}

/**
 * 3단계: 블로그 주제 추천 (5개)
 */
async function recommendBlogTopics(placeInfo, menuAnalysis) {
    const currentSeason = getCurrentSeason();

    const prompt = `
[역할]
당신은 10년 경력의 맛집 마케팅 전문가입니다. 음식점 블로그를 통해 수많은 가게의 매출을 증대시킨 경험이 있습니다.

[가게 정보]
- 가게명: ${placeInfo.name}
- 위치: ${placeInfo.address}
- 카테고리: ${placeInfo.category}
- 평점: ${placeInfo.rating || '신규'}점 (리뷰 ${placeInfo.reviewCount || 0}개)
- 가게 특징: ${placeInfo.description}
- 주요 강점: ${placeInfo.strengths}
- 주요 고객층: ${placeInfo.targetCustomers}
- 분위기: ${placeInfo.atmosphere}

[대표 메뉴]
${JSON.stringify(menuAnalysis, null, 2)}

[현재 계절]
${currentSeason}

[미션]
위 가게의 사장님 입장에서, 블로그를 통해 손님들에게 가게를 효과적으로 어필할 수 있는 블로그 주제 5가지를 추천해주세요.

[추천 기준]
1. 가게의 실제 강점을 부각시킬 수 있는 주제
2. 잠재 고객의 관심을 끌 수 있는 주제
3. 검색 노출에 유리한 주제
4. 사장님의 진정성 있는 이야기를 담을 수 있는 주제
5. 경쟁 업체와 차별화할 수 있는 주제

JSON 형식으로 답변해주세요:
{
  "topics": [
    {
      "title": "클릭을 유도하는 매력적인 제목",
      "description": "이 주제가 왜 효과적인지 100자 내외로 설명",
      "keywords": "SEO에 유리한 키워드 3-5개 (쉼표로 구분)",
      "expectedEffect": "이 글이 가져올 마케팅 효과"
    }
  ]
}

반드시 5개의 주제를 제공해주세요.
`;

    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                { role: "system", content: "당신은 맛집 마케팅 전문가입니다. JSON 형식으로만 답변하세요." },
                { role: "user", content: prompt }
            ],
            temperature: 0.8,
            response_format: { type: "json_object" }
        });

        return JSON.parse(completion.choices[0].message.content);
    } catch (error) {
        console.error('[주제 추천 단계] 오류:', error);
        throw new Error('주제 추천에 실패했습니다: ' + error.message);
    }
}

/**
 * 4단계: 블로그 글 생성 (2000자)
 */
async function generateBlogPost(placeInfo, menuAnalysis, selectedTopic) {
    const currentSeason = getCurrentSeason();

    const prompt = `
[역할]
당신은 ${placeInfo.name}의 사장입니다. 손님들과 소통하고 우리 가게를 알리기 위해 블로그 글을 작성하려고 합니다.

[가게 정보]
- 가게명: ${placeInfo.name}
- 위치: ${placeInfo.address}
- 전화번호: ${placeInfo.phone}
- 카테고리: ${placeInfo.category}
- 평점: ${placeInfo.rating || '신규'}점 (리뷰 ${placeInfo.reviewCount || 0}개)
- 영업시간: ${placeInfo.hours}
- 가게 특징: ${placeInfo.description}
- 주요 강점: ${placeInfo.strengths}
- 주요 고객층: ${placeInfo.targetCustomers}
- 가게 분위기: ${placeInfo.atmosphere}

[대표 메뉴 분석]
${JSON.stringify(menuAnalysis, null, 2)}

[선택된 주제]
- 제목: ${selectedTopic.title}
- 설명: ${selectedTopic.description}
- 핵심 키워드: ${selectedTopic.keywords}

[작성 가이드라인]

1. **톤 & 매너**
   - 따뜻하고 친근한 사장님의 목소리
   - 과도한 마케팅 느낌 배제
   - 진정성 있는 스토리텔링
   - 손님을 존중하는 겸손한 태도

2. **글 구조** (2000자 내외)

   **서론 (300자)**
   - 따뜻한 인사와 자기소개 (가게 이름, 위치, 운영 기간)
   - 오늘 글의 주제 소개 및 독자의 관심을 끄는 질문이나 일화
   - 가게의 기본 정보 (평점, 리뷰 수, 주요 특징) 자연스럽게 언급
   - 독자가 글을 끝까지 읽고 싶게 만드는 호기심 유발

   **본론 (1000자)**
   - **본론 1부 (400자)**: 선택된 주제의 핵심 내용 전개
     - 구체적인 사례나 경험 공유
     - 우리 가게만의 특별한 점 강조
     - 메뉴 개발 과정이나 조리법의 특별함
   
   - **본론 2부 (400자)**: 대표 메뉴와 연결된 스토리
     - 실제 메뉴 정보와 특징 상세 설명
     - 재료에 대한 정성과 철학
     - 손님들의 반응
   
   - **본론 3부 (200자)**: 손님들과의 소중한 인연
     - 가게 운영의 보람과 감사
     - 실제 손님들과의 에피소드

   **결론 (700자)**
   - **결론 1부 (300자)**: 앞으로의 계획이나 다짐
     - 가게 발전 방향과 새로운 시도
     - 손님들께 약속드리는 것들
   
   - **결론 2부 (400자)**: 방문 안내 및 마무리
     - 따뜻한 초대 메시지
     - 상세한 방문 안내 (위치, 영업시간, 전화번호)
     - 감사 인사 및 다음 약속

3. **필수 포함 요소**
   - 가게 이름 최소 3회 자연스럽게 언급
   - 대표 메뉴 구체적으로 소개
   - 실제 가게 정보 (주소, 전화번호, 영업시간) 포함
   - 평점과 리뷰 수 자연스럽게 언급 (자랑스럽게, 하지만 겸손하게)

4. **스타일링**
   - 문단 나누기로 가독성 확보
   - 중요한 메뉴명이나 특징은 **볼드** 처리
   - 너무 많은 형식 장식 지양
   - 자연스러운 한국어 표현 사용

5. **해시태그** (글 마지막에 추가)
   - 가게 특징 관련 3개
   - 메뉴 관련 3개
   - 지역 관련 2개
   - 분위기/상황 관련 2개
   - 총 10개 내외

6. **금지 사항**
   - 과장된 표현이나 허위 정보
   - 다른 가게 비하
   - 지나친 자화자찬
   - 부정확한 정보
   - 너무 상업적인 톤

[추가 지침]
- 계절감: 현재 계절(${currentSeason}) 반영
- 지역 특성: ${placeInfo.region} 활용
- 실제 가게의 강점 포함

이제 위 모든 정보를 바탕으로 블로그 글을 작성해주세요. 
마크다운 형식은 사용하지 말고, 일반 텍스트로 작성해주세요.
`;

    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                { role: "system", content: "당신은 가게 사장님입니다. 따뜻하고 진정성 있는 블로그 글을 작성하세요." },
                { role: "user", content: prompt }
            ],
            temperature: 0.8,
            max_tokens: 3000
        });

        return completion.choices[0].message.content;
    } catch (error) {
        console.error('[블로그 생성 단계] 오류:', error);
        throw new Error('블로그 생성에 실패했습니다: ' + error.message);
    }
}

/**
 * 현재 계절 가져오기
 */
function getCurrentSeason() {
    const month = new Date().getMonth() + 1;
    if (month >= 3 && month <= 5) return "봄";
    if (month >= 6 && month <= 8) return "여름";
    if (month >= 9 && month <= 11) return "가을";
    return "겨울";
}

/**
 * Express 라우트 핸들러
 */
module.exports = async function handler(req, res) {
    // CORS 헤더 설정
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    // OPTIONS 요청 처리
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // POST 요청만 허용
    if (req.method !== 'POST') {
        return res.status(405).json({ 
            success: false, 
            error: 'Method not allowed' 
        });
    }

    try {
        const { step, data } = req.body;

        // 환경 변수 확인
        if (!process.env.OPENAI_API_KEY) {
            throw new Error('OPENAI_API_KEY가 설정되지 않았습니다.');
        }

        let result;

        switch (step) {
            case 'crawl':
                // 1단계: 플레이스 정보 크롤링/구조화
                result = await crawlOrStructurePlaceInfo(data.placeUrl, data);
                break;

            case 'analyze':
                // 2단계: 메뉴 분석
                result = await analyzeMainMenu(data.placeInfo);
                break;

            case 'recommend':
                // 3단계: 주제 추천
                result = await recommendBlogTopics(data.placeInfo, data.menuAnalysis);
                break;

            case 'generate':
                // 4단계: 블로그 글 생성
                result = await generateBlogPost(data.placeInfo, data.menuAnalysis, data.selectedTopic);
                break;

            default:
                throw new Error('잘못된 단계입니다.');
        }

        res.status(200).json({
            success: true,
            data: result
        });

    } catch (error) {
        console.error('[ChatGPT Blog API] 오류:', error);
        res.status(500).json({
            success: false,
            error: error.message || '서버 오류가 발생했습니다.'
        });
    }
};

