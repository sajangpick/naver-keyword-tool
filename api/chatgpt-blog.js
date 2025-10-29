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
const { createClient } = require('@supabase/supabase-js');

// Supabase 클라이언트 초기화
let supabase = null;
if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );
}

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
 * 체험단 리뷰 생성 (기존 블로그 글 스타일 학습)
 */
async function generateReviewTeamPost(storeInfo, existingBlog) {
    const currentSeason = getCurrentSeason();

    const prompt = `
[역할]
당신은 ${storeInfo.companyName}을(를) 체험한 블로거입니다. 체험단으로 방문하여 솔직하고 자세한 리뷰를 작성합니다.

[가게 정보]
- 가게명: ${storeInfo.companyName}
- 위치: ${storeInfo.companyAddress}
- 영업시간: ${storeInfo.businessHours}
- 대표메뉴: ${storeInfo.mainMenu}
- 주변 랜드마크: ${storeInfo.landmarks || '없음'}
- 키워드: ${storeInfo.keywords || '없음'}

[기존 블로그 글 - 스타일 참고용]
${existingBlog}

[미션]
위 기존 블로그 글의 스타일(톤, 문체, 구조, 표현 방식)을 학습하여, 
같은 스타일로 ${storeInfo.companyName}의 체험단 리뷰를 작성해주세요.

[작성 가이드라인]

1. **톤 & 매너** (기존 글 스타일 유지)
   - 기존 블로그의 말투와 문체를 그대로 사용
   - 기존 글에서 사용한 이모티콘이나 특수문자 패턴 반영
   - 기존 글의 친근함/격식 수준 유지

2. **글 구조** (1500-2000자)

   **서론 (200-300자)**
   - 체험단으로 방문하게 된 계기
   - 가게에 대한 첫인상
   - 오늘 리뷰할 내용 간단히 소개

   **본론 (1000-1200자)**
   - **매장 분위기 (300자)**: 인테리어, 좌석, 청결도, 전반적 분위기
   - **메뉴 소개 (400자)**: 주문한 메뉴들의 상세한 설명
     - 비주얼, 양, 맛, 향, 식감 등
     - 메뉴별 가격과 구성
   - **서비스 (200자)**: 직원 친절도, 서빙 속도, 특별한 서비스
   - **특별한 점 (300자)**: 다른 곳과 차별화되는 포인트

   **결론 (300-500자)**
   - 전반적인 만족도 평가
   - 추천 대상 (어떤 사람에게 추천할지)
   - 재방문 의사
   - 방문 정보 (주소, 영업시간, 주차, 예약 등)

3. **필수 포함 요소**
   - 가게 이름 자연스럽게 3-5회 언급
   - 대표 메뉴 상세 리뷰
   - 실제 방문 경험을 담은 구체적 묘사
   - 주소, 영업시간 등 기본 정보
   - 가격대 언급

4. **스타일링**
   - 기존 글에서 사용한 문단 나누기 방식 모방
   - 기존 글에서 자주 사용한 강조 표현 활용
   - 사진 위치 표시: [사진: 설명]

5. **해시태그** (글 마지막)
   - 가게명, 지역, 메뉴, 분위기 관련 해시태그 10개 내외

6. **금지 사항**
   - 과장되거나 허위 정보
   - 너무 상업적인 홍보 톤
   - 기존 글 내용을 그대로 복사

[추가 지침]
- 현재 계절: ${currentSeason}
- 실제 체험한 것처럼 생생하고 구체적으로 작성
- 기존 블로그 글의 특징적인 표현이나 습관을 자연스럽게 반영

이제 위 정보를 바탕으로 체험단 리뷰를 작성해주세요.
마크다운 형식은 사용하지 말고, 일반 텍스트로 작성해주세요.
`;

    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                { role: "system", content: "당신은 솔직하고 상세한 리뷰를 작성하는 블로거입니다. 기존 글의 스타일을 정확히 모방하세요." },
                { role: "user", content: prompt }
            ],
            temperature: 0.8,
            max_tokens: 3000
        });

        return completion.choices[0].message.content;
    } catch (error) {
        console.error('[체험단 리뷰 생성] 오류:', error);
        throw new Error('체험단 리뷰 생성에 실패했습니다: ' + error.message);
    }
}

/**
 * 방문 후기 생성 (기존 블로그 글 스타일 학습)
 */
async function generateVisitReviewPost(storeInfo, existingBlog) {
    const currentSeason = getCurrentSeason();

    const prompt = `
[역할]
당신은 ${storeInfo.companyName}을(를) 방문한 일반 손님입니다. 개인적으로 방문한 경험을 블로그에 기록합니다.

[가게 정보]
- 가게명: ${storeInfo.companyName}
- 위치: ${storeInfo.companyAddress}
- 영업시간: ${storeInfo.businessHours}
- 대표메뉴: ${storeInfo.mainMenu}
- 주변 랜드마크: ${storeInfo.landmarks || '없음'}
- 키워드: ${storeInfo.keywords || '없음'}

[기존 블로그 글 - 스타일 참고용]
${existingBlog}

[미션]
위 기존 블로그 글의 스타일(톤, 문체, 구조, 표현 방식)을 학습하여,
같은 스타일로 ${storeInfo.companyName}의 방문 후기를 작성해주세요.

[작성 가이드라인]

1. **톤 & 매너** (기존 글 스타일 유지)
   - 기존 블로그의 말투와 문체를 그대로 사용
   - 기존 글에서 사용한 이모티콘이나 특수문자 패턴 반영
   - 기존 글의 친근함/격식 수준 유지
   - 일반 손님의 솔직한 시각 유지

2. **글 구조** (1200-1500자)

   **서론 (150-200자)**
   - 방문하게 된 계기나 상황
   - 함께 간 사람 (친구, 가족, 연인 등)
   - 첫인상이나 기대감

   **본론 (800-1000자)**
   - **찾아가는 길 (100자)**: 위치, 주차, 접근성
   - **매장 분위기 (200자)**: 인테리어, 분위기, 좌석 배치
   - **주문 과정 (150자)**: 메뉴 선택, 대기 시간, 직원 응대
   - **음식 리뷰 (350-450자)**: 주문한 메뉴의 맛, 양, 가격
     - 비주얼과 첫 느낌
     - 맛에 대한 솔직한 평가
     - 가성비 평가
   - **전반적 경험 (200자)**: 서비스, 청결도, 특이사항

   **결론 (250-300자)**
   - 전체적인 만족도
   - 아쉬운 점이나 개선 제안 (있다면)
   - 재방문 의사
   - 추천 대상
   - 방문 팁이나 꿀팁

3. **필수 포함 요소**
   - 가게 이름 자연스럽게 2-3회 언급
   - 실제 방문한 듯한 구체적인 디테일
   - 주소와 영업시간
   - 개인적인 감상과 의견
   - 메뉴 가격대

4. **스타일링**
   - 기존 글의 문단 구성 방식 모방
   - 기존 글에서 자주 쓰는 표현 활용
   - 사진 위치 표시: [사진: 설명]
   - 자연스러운 대화체

5. **해시태그** (글 마지막)
   - 가게명, 지역, 메뉴, 상황 관련 해시태그 8-10개

6. **금지 사항**
   - 지나치게 전문적이거나 마케팅 같은 표현
   - 과도한 칭찬 (균형 있게)
   - 기존 글 내용을 그대로 복사
   - 허위 정보

[추가 지침]
- 현재 계절: ${currentSeason}
- 일상적이고 자연스러운 방문 후기 스타일
- 개인의 주관적 경험과 감상 중심
- 기존 블로그 글의 톤과 표현 습관을 세심하게 반영

이제 위 정보를 바탕으로 방문 후기를 작성해주세요.
마크다운 형식은 사용하지 말고, 일반 텍스트로 작성해주세요.
`;

    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                { role: "system", content: "당신은 일반 손님으로 방문 경험을 자연스럽게 기록하는 블로거입니다. 기존 글의 스타일을 정확히 모방하세요." },
                { role: "user", content: prompt }
            ],
            temperature: 0.8,
            max_tokens: 3000
        });

        return completion.choices[0].message.content;
    } catch (error) {
        console.error('[방문 후기 생성] 오류:', error);
        throw new Error('방문 후기 생성에 실패했습니다: ' + error.message);
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

            case 'generate-review-team':
                {
                    // 체험단 리뷰 생성 (단일 단계)
                    const reviewTeamStartTime = Date.now();
                    result = await generateReviewTeamPost(data.storeInfo, data.existingBlog);
                    const reviewTeamGenerationTime = Date.now() - reviewTeamStartTime;

                    // DB 저장 (간소화 버전)
                    let reviewTeamBlogId = null;
                    let reviewTeamDbStatus = 'not_attempted';
                    let reviewTeamDbError = null;

                    if (supabase) {
                        try {
                            console.log('📦 체험단 리뷰 DB 저장 시작...');
                            
                            let userId = data.userId || null;
                            if (!userId) {
                                const { data: testUser } = await supabase
                                    .from('profiles')
                                    .select('id')
                                    .eq('name', '김사장')
                                    .single();
                                userId = testUser?.id;
                            }

                            if (userId) {
                                const blogData = {
                                    user_id: userId,
                                    store_name: data.storeInfo?.companyName || null,
                                    store_address: data.storeInfo?.companyAddress || null,
                                    store_business_hours: data.storeInfo?.businessHours || null,
                                    store_main_menu: data.storeInfo?.mainMenu || null,
                                    blog_type: 'review_team',
                                    blog_title: `${data.storeInfo?.companyName} 체험단 리뷰`,
                                    blog_content: result,
                                    ai_model: 'gpt-4o',
                                    generation_time_ms: reviewTeamGenerationTime,
                                    status: 'draft',
                                    is_used: false
                                };

                                const { data: blogResult, error: blogError } = await supabase
                                    .from('blog_posts')
                                    .insert(blogData)
                                    .select();

                                if (blogError) {
                                    console.error('❌ blog_posts 저장 실패:', blogError);
                                    reviewTeamDbStatus = 'failed';
                                    reviewTeamDbError = blogError.message;
                                } else {
                                    reviewTeamBlogId = blogResult[0]?.id;
                                    console.log('✅ blog_posts 저장 성공:', reviewTeamBlogId);
                                    reviewTeamDbStatus = 'success';
                                }
                            }
                        } catch (dbErr) {
                            console.error('❌ DB 저장 중 오류:', dbErr);
                            reviewTeamDbStatus = 'failed';
                            reviewTeamDbError = dbErr.message;
                        }
                    }

                    return res.status(200).json({
                        success: true,
                        data: result,
                        metadata: {
                            blogId: reviewTeamBlogId,
                            dbSaveStatus: reviewTeamDbStatus,
                            dbError: reviewTeamDbError,
                            generationTime: reviewTeamGenerationTime
                        }
                    });
                }

            case 'generate-visit-review':
                {
                    // 방문 후기 생성 (단일 단계)
                    const visitReviewStartTime = Date.now();
                    result = await generateVisitReviewPost(data.storeInfo, data.existingBlog);
                    const visitReviewGenerationTime = Date.now() - visitReviewStartTime;

                    // DB 저장 (간소화 버전)
                    let visitReviewBlogId = null;
                    let visitReviewDbStatus = 'not_attempted';
                    let visitReviewDbError = null;

                    if (supabase) {
                        try {
                            console.log('📦 방문 후기 DB 저장 시작...');
                            
                            let userId = data.userId || null;
                            if (!userId) {
                                const { data: testUser } = await supabase
                                    .from('profiles')
                                    .select('id')
                                    .eq('name', '김사장')
                                    .single();
                                userId = testUser?.id;
                            }

                            if (userId) {
                                const blogData = {
                                    user_id: userId,
                                    store_name: data.storeInfo?.companyName || null,
                                    store_address: data.storeInfo?.companyAddress || null,
                                    store_business_hours: data.storeInfo?.businessHours || null,
                                    store_main_menu: data.storeInfo?.mainMenu || null,
                                    blog_type: 'visit_review',
                                    blog_title: `${data.storeInfo?.companyName} 방문 후기`,
                                    blog_content: result,
                                    ai_model: 'gpt-4o',
                                    generation_time_ms: visitReviewGenerationTime,
                                    status: 'draft',
                                    is_used: false
                                };

                                const { data: blogResult, error: blogError } = await supabase
                                    .from('blog_posts')
                                    .insert(blogData)
                                    .select();

                                if (blogError) {
                                    console.error('❌ blog_posts 저장 실패:', blogError);
                                    visitReviewDbStatus = 'failed';
                                    visitReviewDbError = blogError.message;
                                } else {
                                    visitReviewBlogId = blogResult[0]?.id;
                                    console.log('✅ blog_posts 저장 성공:', visitReviewBlogId);
                                    visitReviewDbStatus = 'success';
                                }
                            }
                        } catch (dbErr) {
                            console.error('❌ DB 저장 중 오류:', dbErr);
                            visitReviewDbStatus = 'failed';
                            visitReviewDbError = dbErr.message;
                        }
                    }

                    return res.status(200).json({
                        success: true,
                        data: result,
                        metadata: {
                            blogId: visitReviewBlogId,
                            dbSaveStatus: visitReviewDbStatus,
                            dbError: visitReviewDbError,
                            generationTime: visitReviewGenerationTime
                        }
                    });
                }

            case 'generate':
                {
                    // 4단계: 블로그 글 생성
                    const startTime = Date.now();
                    result = await generateBlogPost(data.placeInfo, data.menuAnalysis, data.selectedTopic);
                    const generationTime = Date.now() - startTime;

                    // ==================== DB 저장 로직 ====================
                    let savedBlogId = null;
                    let dbSaveStatus = 'not_attempted';
                    let dbError = null;

                if (supabase) {
                    try {
                        console.log('📦 블로그 DB 저장 시작...');

                        // 1. places 테이블에 가게 정보 저장 (있으면 재사용)
                        let savedPlaceId = null;
                        if (data.placeInfo && data.placeInfo.name) {
                            // place_id가 있으면 저장, 없으면 스킵
                            if (data.placeInfo.placeId) {
                                const placeData = {
                                    place_id: data.placeInfo.placeId,
                                    place_name: data.placeInfo.name,
                                    category: data.placeInfo.category || null,
                                    road_address: data.placeInfo.address || null,
                                    phone: data.placeInfo.phone || null,
                                    rating: data.placeInfo.rating || null,
                                    visitor_reviews: data.placeInfo.reviewCount || 0,
                                    business_hours: data.placeInfo.hours || null,
                                    last_crawled_at: new Date().toISOString()
                                };

                                const { error: placeError } = await supabase
                                    .from('places')
                                    .upsert(placeData, {
                                        onConflict: 'place_id',
                                        ignoreDuplicates: false
                                    });

                                if (placeError) {
                                    console.error('❌ places 저장 실패:', placeError);
                                } else {
                                    savedPlaceId = data.placeInfo.placeId;
                                    console.log('✅ places 저장 성공:', savedPlaceId);
                                }
                            }
                        }

                        // 2. 사용자 ID 가져오기 (로컬 개발 시 테스트 계정 사용)
                        let userId = data.userId || null;
                        
                        if (!userId) {
                            // 테스트 회원(김사장) 사용
                            const { data: testUser, error: userError } = await supabase
                                .from('profiles')
                                .select('id')
                                .eq('name', '김사장')
                                .single();

                            if (!userError && testUser) {
                                userId = testUser.id;
                            } else {
                                // 첫 번째 회원 사용
                                const { data: firstUser } = await supabase
                                    .from('profiles')
                                    .select('id')
                                    .limit(1)
                                    .single();
                                
                                if (firstUser) {
                                    userId = firstUser.id;
                                }
                            }
                        }

                        if (!userId) {
                            throw new Error('사용자 ID를 찾을 수 없습니다.');
                        }

                        // 3. blog_posts 테이블에 블로그 저장
                        const blogData = {
                            user_id: userId,
                            place_id: savedPlaceId || null,
                            
                            // 가게 정보
                            store_name: data.placeInfo?.name || null,
                            store_address: data.placeInfo?.address || null,
                            store_business_hours: data.placeInfo?.hours || null,
                            store_main_menu: data.placeInfo?.mainMenu?.join(', ') || null,
                            naver_place_url: data.placeUrl || null,
                            
                            // 블로그 내용
                            blog_type: 'our_store',  // 현재는 우리매장만 지원
                            blog_title: data.selectedTopic?.title || null,
                            blog_content: result,  // 생성된 블로그 전문
                            
                            // JSON 데이터
                            selected_topic: data.selectedTopic || null,
                            place_info: data.placeInfo || null,
                            menu_analysis: data.menuAnalysis || null,
                            
                            // AI 정보
                            ai_model: 'gpt-4o',
                            generation_time_ms: generationTime,
                            
                            // 상태
                            status: 'draft',
                            is_used: false
                        };

                        const { data: blogResult, error: blogError } = await supabase
                            .from('blog_posts')
                            .insert(blogData)
                            .select();

                        if (blogError) {
                            console.error('❌ blog_posts 저장 실패:', blogError);
                            dbSaveStatus = 'failed';
                            dbError = blogError.message;
                        } else {
                            savedBlogId = blogResult[0]?.id;
                            console.log('✅ blog_posts 저장 성공:', savedBlogId);
                            dbSaveStatus = 'success';
                        }

                    } catch (dbErr) {
                        console.error('❌ DB 저장 중 오류:', dbErr);
                        dbSaveStatus = 'failed';
                        dbError = dbErr.message;
                    }
                } else {
                    console.log('⚠️ Supabase 클라이언트가 초기화되지 않아 DB 저장을 건너뜁니다.');
                }
                // ==================== DB 저장 로직 끝 ====================

                    // 응답에 DB 저장 정보 포함
                    return res.status(200).json({
                        success: true,
                        data: result,
                        metadata: {
                            blogId: savedBlogId,
                            dbSaveStatus: dbSaveStatus,
                            dbError: dbError,
                            generationTime: generationTime
                        }
                    });
                }

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

