/**
 * ChatGPT 블로그 생성 API (다양성 강화 버전)
 * 
 * 특징:
 * - 랜덤 앵글 시스템 (8가지 글쓰기 시점)
 * - 이전 블로그 분석 및 회피
 * - 사용자 블로그 스타일 설정 반영
 * - 향상된 AI 파라미터 (temperature, frequency_penalty 등)
 * - 시간/계절/날씨 정보 활용
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

// ============================================
// 다양성 시스템 유틸리티
// ============================================

/**
 * 랜덤 글쓰기 앵글 선택
 */
const WRITING_ANGLES = [
    {
        name: '단골 고객 시점',
        description: '여러 번 방문한 후 단골이 된 관점에서 작성. 가게와 사장님에 대한 애정과 신뢰를 표현.',
        tone: '친근하고 애정 어린',
        focus: '재방문 이유, 변함없는 맛, 사장님과의 인연'
    },
    {
        name: '첫 방문 시점',
        description: '처음 방문한 신선한 관점에서 작성. 첫인상과 기대감, 놀라움을 강조.',
        tone: '호기심 가득하고 설레는',
        focus: '첫인상, 발견의 기쁨, 예상 외의 만족감'
    },
    {
        name: '지역 주민 시점',
        description: '동네에 사는 주민 관점에서 작성. 지역 커뮤니티의 일원으로서 자랑스러운 맛집 소개.',
        tone: '자랑스럽고 따뜻한',
        focus: '동네 숨은 맛집, 지역 사랑, 주민들 사이의 입소문'
    },
    {
        name: '미식가 시점',
        description: '음식에 대한 전문적 지식을 가진 미식가 관점. 조리법, 재료, 맛의 깊이를 분석.',
        tone: '전문적이고 세밀한',
        focus: '음식의 질, 조리 기술, 재료의 신선도, 맛의 균형'
    },
    {
        name: '가족 외식 시점',
        description: '가족과 함께 방문한 관점. 가족 모두가 만족할 수 있는 분위기와 메뉴 강조.',
        tone: '따뜻하고 화목한',
        focus: '가족 친화적 분위기, 다양한 연령대 만족, 편안한 식사'
    },
    {
        name: '데이트 추천 시점',
        description: '연인과의 데이트 장소로 추천하는 관점. 분위기와 로맨틱한 요소 강조.',
        tone: '로맨틱하고 분위기 있는',
        focus: '데이트 분위기, 커플석, 특별한 순간, 사진 명소'
    },
    {
        name: '혼밥 시점',
        description: '혼자 방문하여 식사한 관점. 혼자서도 편하게 즐길 수 있는 요소 강조.',
        tone: '편안하고 자유로운',
        focus: '혼밥 친화적, 부담 없는 분위기, 혼자만의 시간'
    },
    {
        name: '재방문 결심 시점',
        description: '방문 후 꼭 다시 오고 싶다는 결심을 한 관점. 재방문 이유와 다음 계획 강조.',
        tone: '확신에 차고 기대되는',
        focus: '재방문 의사, 다음에 먹고 싶은 메뉴, 지인 추천 의향'
    }
];

function getRandomAngle() {
    return WRITING_ANGLES[Math.floor(Math.random() * WRITING_ANGLES.length)];
}

/**
 * 사용자의 이전 블로그 기록 분석
 */
async function analyzePreviousBlogs(userId) {
    if (!supabase || !userId) {
        return {
            recentKeywords: [],
            recentPatterns: [],
            commonExpressions: [],
            usedAngles: []
        };
    }

    try {
        // 최근 10개 블로그 가져오기
        const { data: recentBlogs } = await supabase
            .from('blog_posts')
            .select('blog_content, writing_angle, diversity_keywords, created_at')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(10);

        if (!recentBlogs || recentBlogs.length === 0) {
            return {
                recentKeywords: [],
                recentPatterns: [],
                commonExpressions: [],
                usedAngles: []
            };
        }

        // 키워드 및 패턴 추출
        const keywords = new Set();
        const patterns = [];
        const expressions = new Set();
        const angles = [];

        for (const blog of recentBlogs) {
            // 앵글 수집
            if (blog.writing_angle) {
                angles.push(blog.writing_angle);
            }

            // diversity_keywords에서 키워드 추출
            if (blog.diversity_keywords) {
                for (const kw of blog.diversity_keywords) {
                    keywords.add(kw);
                }
            }

            // 블로그 내용에서 자주 사용되는 표현 추출
            if (blog.blog_content) {
                const commonPhrases = extractCommonPhrases(blog.blog_content);
                for (const phrase of commonPhrases) {
                    expressions.add(phrase);
                }
            }
        }

        return {
            recentKeywords: Array.from(keywords).slice(0, 20),
            recentPatterns: patterns,
            commonExpressions: Array.from(expressions).slice(0, 15),
            usedAngles: angles
        };

    } catch (error) {
        console.error('[이전 블로그 분석] 오류:', error);
        return {
            recentKeywords: [],
            recentPatterns: [],
            commonExpressions: [],
            usedAngles: []
        };
    }
}

/**
 * 텍스트에서 자주 사용되는 표현 추출
 */
function extractCommonPhrases(text) {
    const phrases = [];
    
    // 자주 반복되는 시작 패턴
    const startPatterns = [
        /^.*?막\s+문을\s+열었/m,
        /^.*?리뷰가\s+없/m,
        /^.*?오픈한\s+지/m,
        /^.*?새로\s+생긴/m,
        /^.*?이제\s+막/m
    ];

    for (const pattern of startPatterns) {
        const match = text.match(pattern);
        if (match) {
            phrases.push(match[0].trim().substring(0, 20));
        }
    }

    return phrases;
}

/**
 * 사용자 블로그 스타일 가져오기
 */
async function getUserBlogStyle(userId) {
    if (!supabase || !userId) {
        return getDefaultBlogStyle();
    }

    try {
        const { data } = await supabase
            .from('profiles')
            .select('blog_style')
            .eq('id', userId)
            .single();

        return data?.blog_style || getDefaultBlogStyle();
    } catch (error) {
        console.error('[블로그 스타일 조회] 오류:', error);
        return getDefaultBlogStyle();
    }
}

function getDefaultBlogStyle() {
    return {
        tone: 'friendly',
        formality: 'polite',
        emoji_usage: 'moderate',
        personality: 'warm',
        expertise_level: 'intermediate',
        content_length: 'detailed',
        writing_style: 'storytelling'
    };
}

/**
 * 블로그 스타일을 프롬프트 텍스트로 변환
 */
function blogStyleToPrompt(blogStyle) {
    const toneMap = {
        friendly: '친근하고 다정한',
        formal: '격식 있고 전문적인',
        casual: '편안하고 캐주얼한'
    };

    const formalityMap = {
        polite: '존댓말',
        informal: '반말',
        'semi-formal': '존댓말과 반말을 적절히 섞은'
    };

    const emojiMap = {
        none: '이모티콘을 사용하지 않는',
        minimal: '이모티콘을 최소한으로 사용하는',
        moderate: '이모티콘을 적당히 사용하는',
        frequent: '이모티콘을 자주 사용하는'
    };

    const personalityMap = {
        warm: '따뜻하고 온화한',
        professional: '프로페셔널하고 차분한',
        humorous: '유머러스하고 재치 있는',
        enthusiastic: '열정적이고 활기찬'
    };

    const lengthMap = {
        brief: '간결하고 핵심만 담은',
        moderate: '적당한 길이의',
        detailed: '상세하고 풍부한'
    };

    return `
- 말투: ${toneMap[blogStyle.tone] || '친근한'} ${formalityMap[blogStyle.formality] || '존댓말'} 사용
- 이모티콘: ${emojiMap[blogStyle.emoji_usage] || '적당히 사용'}
- 성격: ${personalityMap[blogStyle.personality] || '따뜻한'} 성격
- 글 길이: ${lengthMap[blogStyle.content_length] || '적당한'} 글
- 글쓰기 스타일: ${blogStyle.writing_style === 'storytelling' ? '스토리텔링 중심' : blogStyle.writing_style === 'informative' ? '정보 전달 중심' : blogStyle.writing_style === 'conversational' ? '대화체 중심' : '분석적 중심'}
    `.trim();
}

/**
 * 현재 시간/계절/날씨 정보
 */
function getCurrentContext() {
    const now = new Date();
    const month = now.getMonth() + 1;
    const day = now.getDay();
    const hour = now.getHours();
    
    let season = '';
    if (month >= 3 && month <= 5) season = '봄';
    else if (month >= 6 && month <= 8) season = '여름';
    else if (month >= 9 && month <= 11) season = '가을';
    else season = '겨울';

    const dayNames = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
    const dayOfWeek = dayNames[day];

    let timeOfDay = '';
    if (hour >= 5 && hour < 12) timeOfDay = '아침';
    else if (hour >= 12 && hour < 17) timeOfDay = '오후';
    else if (hour >= 17 && hour < 21) timeOfDay = '저녁';
    else timeOfDay = '밤';

    return {
        season,
        dayOfWeek,
        timeOfDay,
        date: `${now.getFullYear()}년 ${month}월 ${now.getDate()}일`
    };
}

// ============================================
// 캐시 관련 함수
// ============================================

/**
 * 캐시에서 플레이스 정보 조회
 */
async function getPlaceFromCache(placeUrl) {
    if (!supabase || !placeUrl) return null;

    try {
        const { data, error } = await supabase
            .from('place_crawl_cache')
            .select('*')
            .eq('place_url', placeUrl)
            .single();

        if (error || !data) {
            console.log('[캐시] 캐시 없음:', placeUrl);
            return null;
        }

        // 캐시 만료 확인 (24시간)
        const lastCrawled = new Date(data.last_crawled_at);
        const now = new Date();
        const hoursDiff = (now - lastCrawled) / (1000 * 60 * 60);

        if (hoursDiff > 24) {
            console.log('[캐시] 캐시 만료 (24시간 경과):', hoursDiff.toFixed(1), '시간');
            return null;
        }

        console.log('[캐시] 캐시 적중! (경과:', hoursDiff.toFixed(1), '시간)');
        
        // crawl_data에서 placeInfo 추출
        return data.crawl_data;

    } catch (error) {
        console.error('[캐시 조회] 오류:', error);
        return null;
    }
}

/**
 * 캐시에 플레이스 정보 저장
 */
async function savePlaceToCache(placeUrl, placeInfo) {
    if (!supabase || !placeUrl) return;

    try {
        // 기존 캐시 확인
        const { data: existing } = await supabase
            .from('place_crawl_cache')
            .select('id, crawl_count')
            .eq('place_url', placeUrl)
            .single();

        if (existing) {
            // 업데이트 (crawl_count 증가)
            const { error } = await supabase
                .from('place_crawl_cache')
                .update({
                    place_name: placeInfo.name,
                    place_address: placeInfo.address,
                    business_hours: placeInfo.hours,
                    main_menu: placeInfo.mainMenu.join(', '),
                    phone_number: placeInfo.phone,
                    crawl_data: placeInfo,
                    crawl_count: existing.crawl_count + 1,
                    last_crawled_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })
                .eq('id', existing.id);

            if (error) throw error;
            console.log('[캐시 저장] 업데이트 완료 (count:', existing.crawl_count + 1, ')');
        } else {
            // 새로 삽입
            const { error } = await supabase
                .from('place_crawl_cache')
                .insert({
                    place_url: placeUrl,
                    place_name: placeInfo.name,
                    place_address: placeInfo.address,
                    business_hours: placeInfo.hours,
                    main_menu: placeInfo.mainMenu.join(', '),
                    phone_number: placeInfo.phone,
                    crawl_data: placeInfo,
                    crawl_count: 1,
                    last_crawled_at: new Date().toISOString()
                });

            if (error) throw error;
            console.log('[캐시 저장] 새로 저장 완료');
        }

    } catch (error) {
        console.error('[캐시 저장] 오류:', error);
        // 캐시 저장 실패는 치명적이지 않으므로 계속 진행
    }
}

// ============================================
// 기존 함수들 (다양성 로직 추가)
// ============================================

/**
 * 1단계: 플레이스 정보 크롤링/구조화 (다양성 강화)
 */
async function crawlOrStructurePlaceInfo(url, userInput, userId) {
    // 캐시 확인 (URL이 있는 경우만)
    if (url) {
        console.log('[크롤링] URL 제공됨:', url);
        
        const cachedData = await getPlaceFromCache(url);
        if (cachedData) {
            console.log('[캐시] 캐시 데이터 사용 ✅');
            return cachedData;
        }
        
        console.log('[캐시] 캐시 없음, 새로 처리...');
    }

    const placeInfo = {
        name: userInput.companyName || '업체명 미입력',
        address: userInput.companyAddress || '주소 미입력',
        phone: userInput.phone || '',
        rating: 0,
        reviewCount: 0,
        category: userInput.category || '음식점',
        description: userInput.keywords || '',
        hours: userInput.businessHours || '영업시간 미입력',
        mainMenu: userInput.mainMenu ? userInput.mainMenu.split(',').map(m => m.trim()).filter(m => m) : [],
        landmarks: userInput.landmarks ? userInput.landmarks.split(',').map(l => l.trim()).filter(l => l) : [],
        keywords: userInput.keywords ? userInput.keywords.split(',').map(k => k.trim()).filter(k => k) : [],
        strengths: '',
        targetCustomers: '',
        atmosphere: '',
        region: userInput.companyAddress ? userInput.companyAddress.split(' ').slice(0, 2).join(' ') : '지역 미입력'
    };

    // 사용자 스타일 및 이전 블로그 분석
    const [blogStyle, previousAnalysis] = await Promise.all([
        getUserBlogStyle(userId),
        analyzePreviousBlogs(userId)
    ]);

    // ChatGPT를 사용하여 정보 보강 (다양성 강화)
    try {
        const prompt = `
다음은 가게의 기본 정보입니다 (일부 정보가 없을 수 있습니다):

- 가게명: ${placeInfo.name}
- 주소: ${placeInfo.address}
- 영업시간: ${placeInfo.hours}
- 대표메뉴: ${placeInfo.mainMenu.length > 0 ? placeInfo.mainMenu.join(', ') : '미입력'}
- 주변 랜드마크: ${placeInfo.landmarks.length > 0 ? placeInfo.landmarks.join(', ') : '미입력'}
- 키워드: ${placeInfo.keywords.length > 0 ? placeInfo.keywords.join(', ') : '미입력'}

위 정보를 바탕으로 다음을 추론해주세요 (정보가 부족하면 일반적인 내용으로 채워주세요):

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
            temperature: 0.9,  // 다양성 증가
            frequency_penalty: 0.3,  // 반복 표현 감소
            presence_penalty: 0.3,   // 새로운 주제 유도
            response_format: { type: "json_object" }
        });

        const enrichedData = JSON.parse(completion.choices[0].message.content);
        placeInfo.strengths = enrichedData.strengths || '';
        placeInfo.targetCustomers = enrichedData.targetCustomers || '';
        placeInfo.atmosphere = enrichedData.atmosphere || '';

    } catch (error) {
        console.error('[크롤링 단계] ChatGPT 정보 보강 실패:', error);
        placeInfo.strengths = placeInfo.keywords.join(', ');
        placeInfo.targetCustomers = '다양한 연령대의 고객';
        placeInfo.atmosphere = '편안하고 따뜻한 분위기';
    }

    // 캐시에 저장 (URL이 있는 경우만)
    if (url) {
        await savePlaceToCache(url, placeInfo);
    }

    return placeInfo;
}

/**
 * 2단계: 대표 메뉴 분석 (다양성 강화)
 */
async function analyzeMainMenu(placeInfo, userId) {
    const previousAnalysis = await analyzePreviousBlogs(userId);

    const prompt = `
[가게 정보]
- 가게명: ${placeInfo.name}
- 위치: ${placeInfo.address}
- 카테고리: ${placeInfo.category}
- 대표 메뉴: ${placeInfo.mainMenu.length > 0 ? placeInfo.mainMenu.join(', ') : '미입력 (일반적인 메뉴로 추론)'}
- 가게 특징: ${placeInfo.keywords.length > 0 ? placeInfo.keywords.join(', ') : '미입력 (업종 특성 참고)'}

위 정보를 바탕으로 다음을 분석해주세요:

1. 각 메뉴의 특징과 강점
2. 메뉴별 추천 포인트
3. 메뉴와 어울리는 계절/상황
4. 경쟁 업체 대비 차별화 포인트
5. 고객들이 좋아할 만한 이유

${previousAnalysis.recentKeywords.length > 0 ? `
[피해야 할 표현]
최근 사용한 키워드: ${previousAnalysis.recentKeywords.slice(0, 10).join(', ')}
이 키워드들과는 다른 새로운 표현을 사용해주세요.
` : ''}

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
                { role: "system", content: "당신은 음식 메뉴 분석 전문가입니다. 매번 신선하고 다양한 관점으로 분석하세요. JSON 형식으로만 답변하세요." },
                { role: "user", content: prompt }
            ],
            temperature: 0.9,
            frequency_penalty: 0.4,
            presence_penalty: 0.4,
            response_format: { type: "json_object" }
        });

        return JSON.parse(completion.choices[0].message.content);
    } catch (error) {
        console.error('[메뉴 분석 단계] 오류:', error);
        throw new Error('메뉴 분석에 실패했습니다: ' + error.message);
    }
}

/**
 * 3단계: 블로그 주제 추천 (다양성 강화)
 */
async function recommendBlogTopics(placeInfo, menuAnalysis, userId) {
    const context = getCurrentContext();
    const previousAnalysis = await analyzePreviousBlogs(userId);

    const prompt = `
[역할]
당신은 10년 경력의 맛집 마케팅 전문가입니다. 매번 신선하고 독특한 블로그 주제를 추천합니다.

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

[현재 상황]
- 계절: ${context.season}
- 요일: ${context.dayOfWeek}
- 시간대: ${context.timeOfDay}
- 날짜: ${context.date}

${previousAnalysis.usedAngles.length > 0 ? `
[최근 사용한 앵글]
${previousAnalysis.usedAngles.slice(0, 5).join(', ')}
이 앵글들과는 다른 새로운 관점의 주제를 제안해주세요.
` : ''}

${previousAnalysis.commonExpressions.length > 0 ? `
[피해야 할 표현]
${previousAnalysis.commonExpressions.join(', ')}
이런 표현들은 사용하지 말고 새로운 접근을 시도해주세요.
` : ''}

[미션]
위 가게의 사장님 입장에서, 블로그를 통해 손님들에게 가게를 효과적으로 어필할 수 있는 
신선하고 독특한 블로그 주제 5가지를 추천해주세요.

[추천 기준]
1. 이전에 사용하지 않은 새로운 앵글
2. 현재 계절과 시기에 적합한 주제
3. 가게의 실제 강점을 부각시킬 수 있는 주제
4. 잠재 고객의 관심을 끌 수 있는 주제
5. 검색 노출에 유리한 주제

JSON 형식으로 답변해주세요:
{
  "topics": [
    {
      "title": "클릭을 유도하는 매력적인 제목",
      "description": "이 주제가 왜 효과적인지 100자 내외로 설명",
      "keywords": "SEO에 유리한 키워드 3-5개 (쉼표로 구분)",
      "expectedEffect": "이 글이 가져올 마케팅 효과",
      "uniqueAngle": "이 주제의 독특한 관점"
    }
  ]
}

반드시 5개의 주제를 제공해주세요.
`;

    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                { role: "system", content: "당신은 맛집 마케팅 전문가입니다. 매번 다르고 신선한 주제를 추천하세요. JSON 형식으로만 답변하세요." },
                { role: "user", content: prompt }
            ],
            temperature: 1.0,  // 최대 다양성
            frequency_penalty: 0.5,
            presence_penalty: 0.5,
            response_format: { type: "json_object" }
        });

        return JSON.parse(completion.choices[0].message.content);
    } catch (error) {
        console.error('[주제 추천 단계] 오류:', error);
        throw new Error('주제 추천에 실패했습니다: ' + error.message);
    }
}

/**
 * 4단계: 블로그 글 생성 (다양성 강화)
 */
async function generateBlogPost(placeInfo, menuAnalysis, selectedTopic, userId, promotionData = null) {
    const context = getCurrentContext();
    const blogStyle = await getUserBlogStyle(userId);
    const previousAnalysis = await analyzePreviousBlogs(userId);

    const stylePrompt = blogStyleToPrompt(blogStyle);

    // 프로모션 정보 프롬프트 생성
    let promotionPrompt = '';
    if (promotionData) {
        promotionPrompt = '\n[🎯 내 가게 알리기 - 심도 있는 정보]\n';
        if (promotionData.signature_menu) {
            promotionPrompt += `- 시그니처 메뉴 스토리: ${promotionData.signature_menu}\n`;
        }
        if (promotionData.special_ingredients) {
            promotionPrompt += `- 재료/조리법의 특별함: ${promotionData.special_ingredients}\n`;
        }
        if (promotionData.atmosphere_facilities) {
            promotionPrompt += `- 분위기/편의시설: ${promotionData.atmosphere_facilities}\n`;
        }
        if (promotionData.owner_story) {
            promotionPrompt += `- 사장님/셰프 이야기: ${promotionData.owner_story}\n`;
        }
        if (promotionData.recommended_situations) {
            promotionPrompt += `- 추천 상황/고객층: ${promotionData.recommended_situations}\n`;
        }
        if (promotionData.sns_photo_points) {
            promotionPrompt += `- SNS/인스타 포인트: ${promotionData.sns_photo_points}\n`;
        }
        if (promotionData.special_events) {
            promotionPrompt += `- 이벤트/특별 서비스: ${promotionData.special_events}\n`;
        }
        promotionPrompt += '\n✨ 위 정보를 활용하여 가게의 특별함과 차별성을 구체적으로 표현해주세요.\n';
    }

    const prompt = `
[역할] ⭐⭐⭐ 매우 중요!
당신은 ${placeInfo.name}의 사장입니다. 
처음부터 끝까지 일관되게 "사장님 입장"에서만 작성하세요.
손님에게 우리 가게를 소개하고 초대하는 따뜻한 글을 작성합니다.

[필수 작성 규칙] ⚠️
- "저희 가게", "우리 가게" 같은 사장님 표현 사용
- "손님 여러분", "방문해 주세요" 같은 초대 표현 사용
- 절대 손님/방문객 시점으로 작성하지 마세요
- "다녀왔어요", "먹어봤어요" 같은 손님 표현 금지

[블로그 스타일] ⭐ 사용자 맞춤 설정
${stylePrompt}

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
${promotionPrompt}
[대표 메뉴 분석]
${JSON.stringify(menuAnalysis, null, 2)}

[선택된 주제]
- 제목: ${selectedTopic.title}
- 설명: ${selectedTopic.description}
- 핵심 키워드: ${selectedTopic.keywords}

[현재 상황 반영]
- 계절: ${context.season}
- 요일: ${context.dayOfWeek}
- 시간대: ${context.timeOfDay}
- 날짜: ${context.date}

계절감과 시간대를 자연스럽게 글에 녹여주세요.

${previousAnalysis.commonExpressions.length > 0 ? `
[반드시 피해야 할 표현들] ⚠️ 중요!
${previousAnalysis.commonExpressions.join('\n')}

위 표현들은 최근에 사용한 것이므로 절대 사용하지 마세요.
대신 완전히 다른 새로운 방식으로 시작하고 전개하세요.
` : ''}

[작성 가이드라인]

1. **톤 & 매너** (사장님 입장)
   - 따뜻하고 친근한 사장님의 목소리
   - 과도한 마케팅 느낌 배제
   - 진정성 있는 가게 이야기
   - 손님을 초대하는 겸손하고 환대하는 태도

2. **글 구조** (2000자 내외)

   **서론 (300자)** - 사장님의 인사
   - "안녕하세요, ${placeInfo.name} 사장 ○○입니다" 같은 자연스러운 인사
   - 계절(${context.season})이나 날씨 언급하며 따뜻한 시작
   - 오늘 소개할 내용에 대한 간단한 소개
   
   **본론 (1000자)** - 가게와 메뉴 소개
   - 우리 가게의 특별한 점, 자랑하고 싶은 점
   - 대표 메뉴를 만드는 정성과 노하우
   - 손님들과의 소중한 인연과 에피소드
   - 계절 메뉴나 추천 메뉴 소개
   
   **결론 (700자)** - 초대와 안내
   - 손님 여러분을 기다리는 마음
   - 방문 안내 (입력된 정보만 포함, 없으면 생략)
   - 📍 위치: ${placeInfo.address !== '주소 미입력' ? placeInfo.address : '(미입력)'}
   - ⏰ 영업시간: ${placeInfo.hours !== '영업시간 미입력' ? placeInfo.hours : '(미입력)'}
   - 📞 문의: ${placeInfo.phone || '(미입력)'}
   - 감사 인사와 다음 방문 기대

3. **필수 포함 요소**
   - 가게 이름 최소 3회 자연스럽게 언급
   - 대표 메뉴가 있으면 구체적으로 소개 (없으면 일반적인 메뉴 추론)
   - 글 마지막에 입력된 정보(위치, 영업시간, 전화번호) 포함 (이모티콘 포함, 미입력인 경우 자연스럽게 표시)
   - 평점과 리뷰 수 자연스럽게 언급

4. **스타일링**
   - 문단 나누기로 가독성 확보
   - 중요한 메뉴명이나 특징은 **볼드** 처리
   - 자연스러운 한국어 표현 사용

5. **해시태그** (글 마지막에 추가)
   - 가게 특징 관련 3개
   - 메뉴 관련 3개
   - 지역 관련 2개
   - 분위기/상황 관련 2개
   - 총 10개 내외

6. **금지 사항** ⚠️
   - 과장된 표현이나 허위 정보
   - 다른 가게 비하
   - 지나친 자화자찬
   - 부정확한 정보
   - 너무 상업적인 톤
   - 최근 사용한 표현 반복

[중요한 지침] ⭐⭐⭐
- 처음부터 끝까지 사장님 시점만 유지하세요
- 절대 손님 시점으로 바뀌면 안 됩니다
- 이전 글들과 완전히 다른 느낌으로 작성하세요
- 같은 패턴의 시작을 피하고 독특하게 시작하세요

이제 위 모든 정보를 바탕으로 블로그 글을 작성해주세요. 
마크다운 형식은 사용하지 말고, 일반 텍스트로 작성해주세요.
`;

    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                { role: "system", content: `당신은 ${placeInfo.name}의 사장님입니다. 처음부터 끝까지 일관되게 사장님의 입장에서만 작성하세요. "저희 가게", "우리 가게"처럼 사장님 표현을 사용하고, 손님을 초대하는 따뜻한 글을 쓰세요. 절대 손님/방문객 시점으로 작성하지 마세요.` },
                { role: "user", content: prompt }
            ],
            temperature: 0.95,  // 최대 다양성
            frequency_penalty: 0.6,  // 반복 표현 강력 감소
            presence_penalty: 0.6,   // 새로운 주제 강력 유도
            max_tokens: 3000
        });

        const blogContent = completion.choices[0].message.content;

        // 키워드 추출 (다음 글 작성 시 회피용)
        const diversityKeywords = extractDiversityKeywords(blogContent);

        return {
            content: blogContent,
            writingAngle: '사장님 시점',
            diversityKeywords: diversityKeywords,
            context: context
        };

    } catch (error) {
        console.error('[블로그 생성 단계] 오류:', error);
        throw new Error('블로그 생성에 실패했습니다: ' + error.message);
    }
}

/**
 * 블로그 내용에서 다양성 키워드 추출
 */
function extractDiversityKeywords(blogContent) {
    const keywords = [];
    
    // 첫 문장 추출 (시작 패턴 회피용)
    const firstSentence = blogContent.split(/[.!?]/)[0];
    if (firstSentence) {
        keywords.push(firstSentence.trim().substring(0, 30));
    }

    // 자주 사용되는 형용사/부사 추출
    const commonWords = ['맛있', '훌륭', '멋진', '좋은', '최고', '완벽', '신선', '특별'];
    for (const word of commonWords) {
        if (blogContent.includes(word)) {
            keywords.push(word);
        }
    }

    return keywords.slice(0, 10);
}

/**
 * 체험단 리뷰 생성 (다양성 강화)
 */
async function generateReviewTeamPost(storeInfo, existingBlog, userId, promotionData = null) {
    const context = getCurrentContext();
    const blogStyle = await getUserBlogStyle(userId);
    const previousAnalysis = await analyzePreviousBlogs(userId);

    const stylePrompt = blogStyleToPrompt(blogStyle);

    // 프로모션 정보 프롬프트 생성
    let promotionPrompt = '';
    if (promotionData) {
        promotionPrompt = '\n[🎯 가게의 특별한 스토리]\n';
        if (promotionData.signature_menu) {
            promotionPrompt += `- 시그니처 메뉴: ${promotionData.signature_menu}\n`;
        }
        if (promotionData.special_ingredients) {
            promotionPrompt += `- 재료/조리법: ${promotionData.special_ingredients}\n`;
        }
        if (promotionData.atmosphere_facilities) {
            promotionPrompt += `- 분위기/시설: ${promotionData.atmosphere_facilities}\n`;
        }
        if (promotionData.owner_story) {
            promotionPrompt += `- 사장님 이야기: ${promotionData.owner_story}\n`;
        }
        if (promotionData.recommended_situations) {
            promotionPrompt += `- 추천 상황: ${promotionData.recommended_situations}\n`;
        }
        if (promotionData.sns_photo_points) {
            promotionPrompt += `- SNS 포인트: ${promotionData.sns_photo_points}\n`;
        }
        if (promotionData.special_events) {
            promotionPrompt += `- 특별 서비스: ${promotionData.special_events}\n`;
        }
        promotionPrompt += '\n위 정보를 리뷰에 자연스럽게 녹여서 작성해주세요.\n';
    }

    const prompt = `
[역할] ⭐⭐⭐ 매우 중요!
당신은 ${storeInfo.companyName}의 사장입니다.
"체험단 분들을 초대하고 싶어서" 체험단 리뷰 형식으로 글을 작성합니다.
하지만 실제로는 사장님이 직접 쓰는 것이므로, 사장님 입장에서 손님들에게 소개하는 글입니다.

[필수 작성 규칙] ⚠️
- "저희 가게에 체험단 분들을 초대하고 싶어요" 같은 사장님 표현 사용
- "이런 분들에게 추천드립니다" 같은 초대 표현 사용
- 절대 "체험해보고 왔어요", "다녀왔습니다" 같은 손님 표현 금지
- "저희 가게", "우리 가게" 같은 사장님 시점 유지

[블로그 스타일]
${stylePrompt}

[가게 정보] (일부 정보가 없을 수 있으며, 그럴 경우 일반적인 내용으로 자연스럽게 작성)
- 가게명: ${storeInfo.companyName}
- 위치: ${storeInfo.companyAddress || '미입력 (가게명으로 추론)'}
- 영업시간: ${storeInfo.businessHours || '미입력 (일반적인 영업시간으로 추론)'}
- 전화번호: ${storeInfo.phoneNumber || '미입력'}
- 대표메뉴: ${storeInfo.mainMenu || '미입력 (가게 특성으로 추론)'}
- 주변 랜드마크: ${storeInfo.landmarks || '미입력'}
- 키워드: ${storeInfo.keywords || '미입력'}
${promotionPrompt}

[현재 상황]
- 계절: ${context.season}
- 요일: ${context.dayOfWeek}
- 날짜: ${context.date}

[기존 블로그 글 - 스타일 참고용]
${existingBlog || '(없음 - 기본 스타일로 작성)'}

${previousAnalysis.commonExpressions.length > 0 ? `
[피해야 할 표현]
${previousAnalysis.commonExpressions.join(', ')}
이런 표현들은 최근에 사용했으므로 다른 방식으로 작성하세요.
` : ''}

[미션]
체험단 분들을 초대하고 싶은 사장님의 마음으로,
${storeInfo.companyName}를 소개하는 글을 작성해주세요.
정보가 부족한 부분은 가게명과 업종을 참고하여 자연스럽게 채워주세요.

[작성 가이드라인]

1. **톤 & 매너** (사장님 입장)
   - "저희 가게에 체험단 분들을 초대하고 싶습니다" 같은 사장님 표현
   - 따뜻하고 친근한 사장님의 목소리
   - 절대 손님 시점 금지
   
2. **글 구조** (1500-2000자)
   **서론 (200-300자)**: 체험단 초대 인사 (사장님 시점)
   - "안녕하세요, ${storeInfo.companyName} 사장입니다"
   - "체험단 분들을 초대하고 싶어 글을 씁니다"
   
   **본론 (1000-1200자)**: 가게 자랑과 메뉴 소개 (사장님 시점)
   - "저희 가게는 이런 점이 특별합니다"
   - "이런 메뉴를 준비했습니다"
   
   **결론 (300-500자)**: 초대와 기대 (사장님 시점)
   - "많은 분들의 방문을 기다립니다"
   - "체험단 분들의 솔직한 리뷰 부탁드립니다"

3. **필수 포함 요소**
   - 가게 이름 3-5회 언급
   - 대표 메뉴가 있으면 상세 소개 (없으면 추론)
   - 글 마지막에 입력된 정보 포함 (없는 정보는 생략 가능)
   - 📍 위치: ${storeInfo.companyAddress || '(미입력)'}
   - ⏰ 영업시간: ${storeInfo.businessHours || '(미입력)'}
   - 📞 문의: ${storeInfo.phoneNumber || '(미입력)'}

4. **해시태그** (10개 내외)
   - 체험단, 리뷰어모집, 블로거초대 등 포함

5. **금지 사항** ⚠️
   - "체험해보고 왔어요", "다녀왔습니다" 같은 손님 표현 절대 금지
   - "먹어봤어요", "방문했어요" 같은 과거 경험 표현 금지

[중요한 지침] ⭐⭐⭐
- 처음부터 끝까지 사장님 시점만 유지하세요
- 체험단을 초대하는 글이지만, 작성자는 사장님입니다
- 절대 손님이 체험하고 온 것처럼 작성하면 안 됩니다

이제 체험단 초대 글을 작성해주세요.
마크다운 형식은 사용하지 말고, 일반 텍스트로 작성해주세요.
`;

    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                { role: "system", content: `당신은 ${storeInfo.companyName}의 사장님입니다. 체험단을 초대하는 글을 사장님 입장에서 작성합니다. 절대 손님이 체험하고 온 것처럼 작성하지 마세요. "저희 가게", "우리 가게" 같은 사장님 표현을 사용하세요.` },
                { role: "user", content: prompt }
            ],
            temperature: 0.95,
            frequency_penalty: 0.6,
            presence_penalty: 0.6,
            max_tokens: 3000
        });

        const blogContent = completion.choices[0].message.content;
        const diversityKeywords = extractDiversityKeywords(blogContent);

        return {
            content: blogContent,
            writingAngle: '사장님 시점 (체험단 초대)',
            diversityKeywords: diversityKeywords
        };

    } catch (error) {
        console.error('[체험단 리뷰 생성] 오류:', error);
        console.error('[체험단 리뷰 생성] 오류 상세:', error.response?.data || error.message);
        throw new Error('체험단 리뷰 생성에 실패했습니다: ' + error.message);
    }
}

/**
 * AI 키워드 추천 (12개, 다양하고 세부적인 키워드)
 */
async function recommendKeywordsForStore(data) {
    const { companyName, companyAddress, mainMenu, landmarks } = data;

    // 주소에서 지역 정보 추출
    const addressParts = companyAddress.split(' ');
    const city = addressParts[0] || '';
    const district = addressParts[1] || '';
    const neighborhood = addressParts[2] || '';

    const prompt = `
[역할]
당신은 네이버 블로그 SEO 전문가입니다. 음식점의 블로그 포스팅을 위한 최적의 키워드를 추천해주세요.

[가게 정보]
- 가게명: ${companyName}
- 위치: ${companyAddress}
- 지역: ${city} ${district} ${neighborhood}
- 대표메뉴: ${mainMenu}
${landmarks ? `- 주변 랜드마크: ${landmarks}` : ''}

[키워드 추천 가이드라인]
1. **총 12개**의 키워드를 추천해주세요
2. **다양한 카테고리**를 포함해야 합니다:
   - 지역 키워드 (2-3개): 시/구/동 조합, 역 근처, 랜드마크 근처
   - 업종 키워드 (2-3개): 음식 종류, 전문점
   - 특징 키워드 (2-3개): 분위기, 가격대, 서비스
   - 상황 키워드 (2-3개): 데이트, 회식, 혼밥, 가족외식
   - SEO 키워드 (2-3개): 맛집, 추천, 후기, 리뷰

3. **구체적이고 세부적인** 키워드를 만들어주세요
   예: "부산맛집" 보다는 "부산해운대맛집", "해운대역근처맛집"
   예: "맛집" 보다는 "가족외식맛집", "데이트맛집"

4. **검색 의도**를 반영해주세요
   - 사람들이 실제로 검색할 법한 키워드
   - 지역+음식종류 조합
   - 상황+지역 조합

[출력 형식]
키워드만 쉼표로 구분하여 나열해주세요. 설명이나 번호는 붙이지 마세요.
예: 부산맛집, 해운대맛집, 해운대역근처맛집, 가족외식맛집, ...

이제 12개의 키워드를 추천해주세요:
`;

    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                { role: "system", content: "당신은 네이버 블로그 SEO 전문가입니다. 검색 상위 노출에 최적화된 키워드를 추천합니다." },
                { role: "user", content: prompt }
            ],
            temperature: 0.8,
            max_tokens: 500
        });

        const keywordsText = completion.choices[0].message.content.trim();
        
        // 쉼표로 구분된 키워드를 배열로 변환
        let keywords = keywordsText
            .split(',')
            .map(k => k.trim())
            .filter(k => k.length > 0);

        // 12개가 아니면 조정
        if (keywords.length > 12) {
            keywords = keywords.slice(0, 12);
        } else if (keywords.length < 12) {
            // 부족하면 기본 키워드 추가
            const defaultKeywords = [
                `${city}맛집`,
                `${district}맛집`,
                `${companyName}`,
                `${companyName}후기`,
                '추천맛집',
                '가족외식',
                '데이트맛집',
                '맛집추천'
            ];
            
            for (const kw of defaultKeywords) {
                if (keywords.length >= 12) break;
                if (!keywords.includes(kw)) {
                    keywords.push(kw);
                }
            }
        }

        console.log('[키워드 추천] 생성된 키워드:', keywords);

        return {
            keywords: keywords.slice(0, 12)
        };

    } catch (error) {
        console.error('[키워드 추천] 오류:', error);
        throw new Error('키워드 추천에 실패했습니다: ' + error.message);
    }
}

/**
 * 방문 후기 생성 (다양성 강화)
 */
async function generateVisitReviewPost(storeInfo, existingBlog, userId, promotionData = null) {
    const context = getCurrentContext();
    const blogStyle = await getUserBlogStyle(userId);
    const previousAnalysis = await analyzePreviousBlogs(userId);
    const writingAngle = getRandomAngle();

    const stylePrompt = blogStyleToPrompt(blogStyle);

    // 프로모션 정보 프롬프트 생성
    let promotionPrompt = '';
    if (promotionData) {
        promotionPrompt = '\n[🎯 가게의 특별한 점]\n';
        if (promotionData.signature_menu) {
            promotionPrompt += `- 시그니처 메뉴: ${promotionData.signature_menu}\n`;
        }
        if (promotionData.special_ingredients) {
            promotionPrompt += `- 재료/조리법: ${promotionData.special_ingredients}\n`;
        }
        if (promotionData.atmosphere_facilities) {
            promotionPrompt += `- 분위기/시설: ${promotionData.atmosphere_facilities}\n`;
        }
        if (promotionData.owner_story) {
            promotionPrompt += `- 사장님 이야기: ${promotionData.owner_story}\n`;
        }
        if (promotionData.recommended_situations) {
            promotionPrompt += `- 추천 상황: ${promotionData.recommended_situations}\n`;
        }
        if (promotionData.sns_photo_points) {
            promotionPrompt += `- SNS 포인트: ${promotionData.sns_photo_points}\n`;
        }
        if (promotionData.special_events) {
            promotionPrompt += `- 특별 서비스: ${promotionData.special_events}\n`;
        }
        promotionPrompt += '\n위 정보를 방문 후기에 자연스럽게 녹여서 작성해주세요.\n';
    }

    const prompt = `
[역할]
당신은 ${storeInfo.companyName}을(를) 방문한 일반 손님입니다. 개인적으로 방문한 경험을 블로그에 기록합니다.

[글쓰기 관점] ⭐
${writingAngle.name}: ${writingAngle.description}

[블로그 스타일]
${stylePrompt}

[가게 정보] (일부 정보가 없을 수 있으며, 그럴 경우 일반적인 내용으로 자연스럽게 작성)
- 가게명: ${storeInfo.companyName}
- 위치: ${storeInfo.companyAddress || '미입력 (가게명으로 추론)'}
- 영업시간: ${storeInfo.businessHours || '미입력 (일반적인 영업시간으로 추론)'}
- 전화번호: ${storeInfo.phoneNumber || '미입력'}
- 대표메뉴: ${storeInfo.mainMenu || '미입력 (가게 특성으로 추론)'}
- 주변 랜드마크: ${storeInfo.landmarks || '미입력'}
- 키워드: ${storeInfo.keywords || '미입력'}
${promotionPrompt}

[현재 상황]
- 계절: ${context.season}
- 요일: ${context.dayOfWeek}
- 날짜: ${context.date}

[기존 블로그 글 - 스타일 참고용]
${existingBlog || '(없음 - 기본 스타일로 작성)'}

${previousAnalysis.commonExpressions.length > 0 ? `
[피해야 할 표현]
${previousAnalysis.commonExpressions.join(', ')}
이런 표현들은 최근에 사용했으므로 다른 방식으로 작성하세요.
` : ''}

[미션]
위 기존 블로그 글의 스타일을 학습하되,
${writingAngle.name} 관점에서 ${storeInfo.companyName}의 방문 후기를 작성해주세요.
정보가 부족한 부분은 가게명과 업종을 참고하여 자연스럽게 채워주세요.

[작성 가이드라인]

1. **톤 & 매너**
   - ${writingAngle.tone} 톤 사용
   - 일반 손님의 솔직한 시각
   
2. **글 구조** (1200-1500자)
   **서론 (150-200자)**: 방문 계기
   **본론 (800-1000자)**: 찾아가는 길, 분위기, 주문, 음식 리뷰
   **결론 (250-300자)**: 만족도, 재방문 의사, 추천 대상

3. **필수 포함 요소**
   - 가게 이름 2-3회 언급
   - 구체적인 디테일
   - 입력된 정보(주소, 영업시간, 전화번호)가 있으면 포함 (없으면 생략 가능)
   - 메뉴 정보가 있으면 가격대 추론

4. **해시태그** (8-10개)

이제 방문 후기를 작성해주세요.
마크다운 형식은 사용하지 말고, 일반 텍스트로 작성해주세요.
`;

    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                { role: "system", content: `당신은 일반 손님으로 방문 경험을 자연스럽게 기록하는 블로거입니다. ${writingAngle.name}의 관점에서 작성하되, 매번 다른 스타일로 시작하세요.` },
                { role: "user", content: prompt }
            ],
            temperature: 0.95,
            frequency_penalty: 0.6,
            presence_penalty: 0.6,
            max_tokens: 3000
        });

        const blogContent = completion.choices[0].message.content;
        const diversityKeywords = extractDiversityKeywords(blogContent);

        return {
            content: blogContent,
            writingAngle: writingAngle.name,
            diversityKeywords: diversityKeywords
        };

    } catch (error) {
        console.error('[방문 후기 생성] 오류:', error);
        throw new Error('방문 후기 생성에 실패했습니다: ' + error.message);
    }
}

// ============================================
// Express 라우트 핸들러
// ============================================

module.exports = async function handler(req, res) {
    // CORS 헤더 설정
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ 
            success: false, 
            error: 'Method not allowed' 
        });
    }

    try {
        const { step, data } = req.body;

        if (!process.env.OPENAI_API_KEY) {
            throw new Error('OPENAI_API_KEY가 설정되지 않았습니다.');
        }

        let result;

        switch (step) {
            case 'crawl':
                result = await crawlOrStructurePlaceInfo(data.placeUrl, data, data.userId);
                break;

            case 'analyze':
                result = await analyzeMainMenu(data.placeInfo, data.userId);
                break;

            case 'recommend':
                result = await recommendBlogTopics(data.placeInfo, data.menuAnalysis, data.userId);
                break;

            case 'recommend-keywords':
                result = await recommendKeywordsForStore(data);
                break;

            case 'generate-review-team':
                {
                    try {
                        const startTime = Date.now();
                        console.log('[체험단 리뷰] 생성 시작:', {
                            userId: data.userId,
                            companyName: data.storeInfo?.companyName,
                            hasExistingBlog: !!data.existingBlog,
                            hasPromotion: !!data.promotionData
                        });

                        const reviewResult = await generateReviewTeamPost(data.storeInfo, data.existingBlog, data.userId, data.promotionData);
                        const generationTime = Date.now() - startTime;

                        console.log('[체험단 리뷰] 생성 완료:', {
                            generationTime,
                            contentLength: reviewResult.content.length,
                            writingAngle: reviewResult.writingAngle
                        });

                        // DB 저장
                        let blogId = null;
                        let dbStatus = 'not_attempted';
                        let dbError = null;

                        if (supabase && data.userId) {
                            try {
                                const blogData = {
                                    user_id: data.userId,
                                    store_name: data.storeInfo?.companyName || null,
                                    store_address: data.storeInfo?.companyAddress || null,
                                    store_business_hours: data.storeInfo?.businessHours || null,
                                    store_main_menu: data.storeInfo?.mainMenu || null,
                                    blog_type: 'review_team',
                                    blog_title: `${data.storeInfo?.companyName} 체험단 초대`,
                                    blog_content: reviewResult.content,
                                    writing_angle: reviewResult.writingAngle,
                                    diversity_keywords: reviewResult.diversityKeywords,
                                    ai_model: 'gpt-4o',
                                    generation_time_ms: generationTime,
                                    status: 'draft',
                                    is_used: false
                                };

                                const { data: blogResult, error: blogError } = await supabase
                                    .from('blog_posts')
                                    .insert(blogData)
                                    .select();

                                if (blogError) {
                                    dbStatus = 'failed';
                                    dbError = blogError.message;
                                    console.error('[체험단 리뷰] DB 저장 실패:', blogError);
                                } else {
                                    blogId = blogResult[0]?.id;
                                    dbStatus = 'success';
                                    console.log('[체험단 리뷰] DB 저장 성공:', blogId);
                                }
                            } catch (dbErr) {
                                dbStatus = 'failed';
                                dbError = dbErr.message;
                                console.error('[체험단 리뷰] DB 저장 오류:', dbErr);
                            }
                        }

                        return res.status(200).json({
                            success: true,
                            data: reviewResult.content,
                            metadata: {
                                blogId,
                                dbSaveStatus: dbStatus,
                                dbError,
                                generationTime,
                                writingAngle: reviewResult.writingAngle
                            }
                        });
                    } catch (error) {
                        console.error('[체험단 리뷰] 전체 오류:', error);
                        return res.status(500).json({
                            success: false,
                            error: `체험단 리뷰 생성 실패: ${error.message}`
                        });
                    }
                }

            case 'generate-visit-review':
                {
                    try {
                        const startTime = Date.now();
                        console.log('[방문 후기] 생성 시작:', {
                            userId: data.userId,
                            companyName: data.storeInfo?.companyName,
                            hasExistingBlog: !!data.existingBlog,
                            hasPromotion: !!data.promotionData
                        });

                        const reviewResult = await generateVisitReviewPost(data.storeInfo, data.existingBlog, data.userId, data.promotionData);
                        const generationTime = Date.now() - startTime;

                        console.log('[방문 후기] 생성 완료:', {
                            generationTime,
                            contentLength: reviewResult.content.length,
                            writingAngle: reviewResult.writingAngle
                        });

                        // DB 저장
                        let blogId = null;
                        let dbStatus = 'not_attempted';
                        let dbError = null;

                        if (supabase && data.userId) {
                            try {
                                const blogData = {
                                    user_id: data.userId,
                                    store_name: data.storeInfo?.companyName || null,
                                    store_address: data.storeInfo?.companyAddress || null,
                                    store_business_hours: data.storeInfo?.businessHours || null,
                                    store_main_menu: data.storeInfo?.mainMenu || null,
                                    blog_type: 'visit_review',
                                    blog_title: `${data.storeInfo?.companyName} 방문 후기`,
                                    blog_content: reviewResult.content,
                                    writing_angle: reviewResult.writingAngle,
                                    diversity_keywords: reviewResult.diversityKeywords,
                                    ai_model: 'gpt-4o',
                                    generation_time_ms: generationTime,
                                    status: 'draft',
                                    is_used: false
                                };

                                const { data: blogResult, error: blogError } = await supabase
                                    .from('blog_posts')
                                    .insert(blogData)
                                    .select();

                                if (blogError) {
                                    dbStatus = 'failed';
                                    dbError = blogError.message;
                                    console.error('[방문 후기] DB 저장 실패:', blogError);
                                } else {
                                    blogId = blogResult[0]?.id;
                                    dbStatus = 'success';
                                    console.log('[방문 후기] DB 저장 성공:', blogId);
                                }
                            } catch (dbErr) {
                                dbStatus = 'failed';
                                dbError = dbErr.message;
                                console.error('[방문 후기] DB 저장 오류:', dbErr);
                            }
                        }

                        return res.status(200).json({
                            success: true,
                            data: reviewResult.content,
                            metadata: {
                                blogId,
                                dbSaveStatus: dbStatus,
                                dbError,
                                generationTime,
                                writingAngle: reviewResult.writingAngle
                            }
                        });
                    } catch (error) {
                        console.error('[방문 후기] 전체 오류:', error);
                        return res.status(500).json({
                            success: false,
                            error: `방문 후기 생성 실패: ${error.message}`
                        });
                    }
                }

            case 'generate':
                {
                    const startTime = Date.now();
                    const blogResult = await generateBlogPost(data.placeInfo, data.menuAnalysis, data.selectedTopic, data.userId, data.promotionData);
                    const generationTime = Date.now() - startTime;

                    // DB 저장
                    let blogId = null;
                    let dbStatus = 'not_attempted';
                    let dbError = null;

                    if (supabase && data.userId) {
                        try {
                            const blogData = {
                                user_id: data.userId,
                                place_id: null,
                                store_name: data.placeInfo?.name || null,
                                store_address: data.placeInfo?.address || null,
                                store_business_hours: data.placeInfo?.hours || null,
                                store_main_menu: data.placeInfo?.mainMenu?.join(', ') || null,
                                naver_place_url: data.placeUrl || null,
                                blog_type: 'our_store',
                                blog_title: data.selectedTopic?.title || null,
                                blog_content: blogResult.content,
                                selected_topic: data.selectedTopic || null,
                                place_info: data.placeInfo || null,
                                menu_analysis: data.menuAnalysis || null,
                                writing_angle: blogResult.writingAngle,
                                diversity_keywords: blogResult.diversityKeywords,
                                ai_model: 'gpt-4o',
                                generation_time_ms: generationTime,
                                status: 'draft',
                                is_used: false
                            };

                            const { data: blogResultData, error: blogError } = await supabase
                                .from('blog_posts')
                                .insert(blogData)
                                .select();

                            if (blogError) {
                                dbStatus = 'failed';
                                dbError = blogError.message;
                            } else {
                                blogId = blogResultData[0]?.id;
                                dbStatus = 'success';
                            }
                        } catch (dbErr) {
                            dbStatus = 'failed';
                            dbError = dbErr.message;
                        }
                    }

                    return res.status(200).json({
                        success: true,
                        data: blogResult.content,
                        metadata: {
                            blogId,
                            dbSaveStatus: dbStatus,
                            dbError,
                            generationTime,
                            writingAngle: blogResult.writingAngle
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
