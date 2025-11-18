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
const { trackTokenUsage, checkTokenLimit, extractUserId } = require('./middleware/token-tracker');

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
// 토큰 추적 래퍼 함수
// ============================================

/**
 * OpenAI API 호출을 토큰 추적과 함께 실행
 */
async function callOpenAIWithTracking(userId, apiCall, apiType = 'chatgpt-blog') {
    try {
        // 토큰 한도 사전 체크 (예상 토큰: 3000)
        if (userId) {
            const limitCheck = await checkTokenLimit(userId, 3000);
            if (!limitCheck.success) {
                throw new Error(limitCheck.error);
            }
        }

        // OpenAI API 호출
        const completion = await apiCall();

        // 토큰 사용량 추적
        if (userId && completion.usage) {
            const trackingResult = await trackTokenUsage(userId, completion.usage, apiType);
            console.log('토큰 추적 결과:', trackingResult);
            
            if (!trackingResult.success && trackingResult.exceeded) {
                console.warn('⚠️ 토큰 한도 초과됨');
            }
        }

        return completion;
    } catch (error) {
        console.error('OpenAI API 호출 오류:', error);
        throw error;
    }
}

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
 * 
 * 참고: 실제 Puppeteer 크롤링은 /api/place-crawl 엔드포인트에서 처리
 *       여기서는 사용자 입력값을 받아서 구조화만 수행
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
        
        console.log('[캐시] 캐시 없음, 사용자 입력값으로 진행...');
    }

    // ✅ 입력값 정제 함수 (빈 문자열, "미입력" 문자열 제거)
    function cleanInput(value, defaultValue = '') {
        if (!value || typeof value !== 'string') return defaultValue;
        const trimmed = value.trim();
        // "미입력", "업체명 미입력" 등의 문자열 제거
        if (!trimmed || trimmed.includes('미입력')) return defaultValue;
        return trimmed;
    }

    function cleanArrayInput(value) {
        if (!value || typeof value !== 'string') return [];
        return value
            .split(',')
            .map(item => item.trim())
            .filter(item => item && !item.includes('미입력') && item.length > 0);
    }

    const companyName = cleanInput(userInput.companyName);
    const companyAddress = cleanInput(userInput.companyAddress);
    const businessHours = cleanInput(userInput.businessHours);
    const phone = cleanInput(userInput.phone);
    const mainMenuArray = cleanArrayInput(userInput.mainMenu);
    const landmarksArray = cleanArrayInput(userInput.landmarks);
    const keywordsArray = cleanArrayInput(userInput.keywords);

    console.log('[크롤링] 정제된 입력값:', {
        companyName: companyName || '(없음)',
        companyAddress: companyAddress || '(없음)',
        businessHours: businessHours || '(없음)',
        phone: phone || '(없음)',
        mainMenuCount: mainMenuArray.length,
        landmarksCount: landmarksArray.length,
        keywordsCount: keywordsArray.length
    });

    const placeInfo = {
        name: companyName || '정보 없음',
        address: companyAddress || '정보 없음',
        phone: phone || '',
        rating: 0,
        reviewCount: 0,
        category: cleanInput(userInput.category) || '음식점',
        description: keywordsArray.join(', ') || '',
        hours: businessHours || '정보 없음',
        mainMenu: mainMenuArray,
        landmarks: landmarksArray,
        keywords: keywordsArray,
        strengths: '',
        targetCustomers: '',
        atmosphere: '',
        region: companyAddress ? companyAddress.split(' ').slice(0, 2).join(' ') : '정보 없음'
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
            model: "gpt-4o-mini",  // ⚡ 속도 개선: gpt-4o-mini 사용 (약 3-5배 빠름)
            messages: [
                { role: "system", content: "당신은 맛집 마케팅 전문가입니다. 매번 다르고 신선한 주제를 추천하세요. JSON 형식으로만 답변하세요." },
                { role: "user", content: prompt }
            ],
            temperature: 0.9,  // ⚡ 속도 개선: 0.9로 조정 (품질 유지, 속도 향상)
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

6. **AI 티 나는 표현 금지** ⚠️ 매우 중요!
   - ❌ "특별한 점", "공간철학", "고유한 특징", "특별한 경험"
   - ❌ "차별화된", "독특한 매력", "프리미엄 경험"
   - ❌ "감동을 선사하다", "특별한 가치", "최상의 퀄리티"
   - ✅ 대신 사용: "좋은 점", "우리만의 방식", "정성껏 준비한", "맛있게 만든"
   - ✅ 사장님이 실제로 쓰는 자연스럽고 소박한 표현 사용

7. **금지 사항** ⚠️
   - 과장된 표현이나 허위 정보
   - 다른 가게 비하
   - 지나친 자화자찬
   - 부정확한 정보
   - 너무 상업적인 톤
   - 최근 사용한 표현 반복

[중요한 지침] ⭐⭐⭐
- 처음부터 끝까지 사장님 시점만 유지하세요
- 절대 손님 시점으로 바뀌면 안 됩니다
- AI 티 나는 고급스러운 표현 절대 사용하지 마세요
- 평범한 사장님이 쓰는 진솔하고 소박한 표현만 사용하세요
- 이전 글들과 완전히 다른 느낌으로 작성하세요
- 같은 패턴의 시작을 피하고 독특하게 시작하세요

이제 위 모든 정보를 바탕으로 블로그 글을 작성해주세요. 
마크다운 형식은 사용하지 말고, 일반 텍스트로 작성해주세요.
`;

    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                { role: "system", content: `당신은 ${placeInfo.name}의 사장님입니다. 처음부터 끝까지 일관되게 사장님의 입장에서만 작성하세요. "저희 가게", "우리 가게"처럼 사장님 표현을 사용하고, 손님을 초대하는 따뜻한 글을 쓰세요. 절대 손님/방문객 시점으로 작성하지 마세요. AI 티 나는 표현("특별한 점", "공간철학", "프리미엄 경험" 등)은 절대 사용하지 말고, 평범한 사장님이 쓰는 진솔하고 소박한 표현만 사용하세요.` },
                { role: "user", content: prompt }
            ],
            temperature: 0.85,  // 다양성과 자연스러움 균형
            frequency_penalty: 0.7,  // 반복 표현 강력 감소
            presence_penalty: 0.5,   // 새로운 주제 유도
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
당신은 ${storeInfo.companyName}에 체험단으로 초대받아 방문한 일반 손님(블로거)입니다.
실제로 방문해서 음식을 먹어보고 솔직한 후기를 작성합니다.

[필수 작성 규칙] ⚠️
- "다녀왔어요", "먹어봤어요", "체험해봤어요" 같은 손님(방문자) 표현 사용
- "추천해요", "괜찮았어요", "마음에 들었어요" 같은 리뷰 표현 사용
- 절대 "저희 가게", "우리 가게", "저희 매장" 같은 사장님 표현 금지
- 처음부터 끝까지 방문 손님(블로거) 시점 유지

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
${storeInfo.companyName}에 체험단으로 방문한 일반 손님(블로거)의 시점으로,
실제로 먹어보고 체험한 솔직한 후기를 작성해주세요.
정보가 부족한 부분은 가게명과 업종을 참고하여 자연스럽게 추론해주세요.

[작성 가이드라인]

1. **톤 & 매너** (일반 손님 시점)
   - "다녀왔어요", "먹어봤어요", "체험해봤어요" 같은 손님 표현 사용
   - 친구에게 추천하는 듯한 편안하고 솔직한 말투
   - 절대 사장님 시점 금지
   
2. **글 구조** (1500-2000자)
   **서론 (200-300자)**: 방문 계기 (손님 시점)
   - "체험단으로 초대받아 다녀왔어요"
   - "평소에 궁금했던 곳인데 드디어 가봤습니다"
   - "○○ 맛집이라는 소문을 듣고 방문했어요"
   
   **본론 (1000-1200자)**: 방문 후기 및 메뉴 리뷰 (손님 시점)
   - "들어가자마자 분위기가 좋더라고요"
   - "이거 시켜봤는데 진짜 맛있었어요"
   - "○○이 정말 인상적이었어요"
   - 메뉴별로 먹어본 솔직한 느낌 작성
   
   **결론 (300-500자)**: 총평 및 추천 (손님 시점)
   - "재방문 의사 100%입니다"
   - "이런 분들께 추천해요"
   - "다음에는 ○○도 먹어보고 싶어요"

3. **필수 포함 요소**
   - 가게 이름 2-3회 자연스럽게 언급
   - 대표 메뉴를 먹어본 경험 상세히 묘사
   - 글 마지막에 가게 정보 포함 (입력된 정보만)
   - 📍 위치: ${storeInfo.companyAddress || '(미입력)'}
   - ⏰ 영업시간: ${storeInfo.businessHours || '(미입력)'}
   - 📞 문의: ${storeInfo.phoneNumber || '(미입력)'}

4. **해시태그** (10개 내외)
   - 체험단, 맛집추천, 음식점이름 등 포함

5. **AI 티 나는 표현 금지** ⚠️ 매우 중요!
   - ❌ "특별한 점", "공간철학", "고유한 특징", "특별한 경험"
   - ❌ "유명한", "인상적인", "독특한", "차별화된"
   - ✅ 대신 사용: "좋았어요", "마음에 들었어요", "맛있었어요", "괜찮았어요"
   - ✅ 자연스러운 일상 표현 사용

6. **금지 사항** ⚠️
   - "저희 가게", "우리 가게", "저희 매장" 같은 사장님 표현 절대 금지
   - "초대하고 싶습니다", "방문해주세요" 같은 초대 표현 금지
   - 과도하게 칭찬하는 마케팅 느낌 금지

[중요한 지침] ⭐⭐⭐
- 처음부터 끝까지 손님(블로거) 시점만 유지하세요
- 실제로 방문해서 먹어본 것처럼 생생하게 작성하세요
- AI 티 나는 표현 절대 사용하지 마세요
- 평범한 일반인이 쓰는 자연스러운 표현만 사용하세요

이제 체험단 방문 후기를 작성해주세요.
마크다운 형식은 사용하지 말고, 일반 텍스트로 작성해주세요.
`;

    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                { role: "system", content: `당신은 ${storeInfo.companyName}에 체험단으로 방문한 일반 손님(블로거)입니다. 실제로 방문해서 먹어보고 쓴 솔직한 후기를 작성합니다. 절대 사장님 시점("저희 가게", "우리 매장")으로 작성하지 마세요. 손님 시점("다녀왔어요", "먹어봤어요")으로만 작성하세요. AI 티 나는 표현("특별한 점", "공간철학" 등)은 사용하지 말고, 평범한 일반인이 쓰는 자연스러운 표현만 사용하세요.` },
                { role: "user", content: prompt }
            ],
            temperature: 0.85,
            frequency_penalty: 0.7,
            presence_penalty: 0.5,
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
// 레시피 생성 함수
// ============================================

/**
 * AI를 사용한 레시피 생성
 */
// 재료로 만들 수 있는 요리 5가지 제안
async function suggestDishesWithAI(ingredients, userId) {
    try {
        console.log('[요리 제안] 시작:', {
            ingredients,
            userId
        });

        const systemPrompt = `당신은 창의적인 요리 전문가입니다.
주어진 재료로 만들 수 있는 다양한 요리를 제안해주세요.

중요 지침:
1. 재료를 최대한 활용할 수 있는 요리 추천
2. 다양한 조리법 제시 (볶음, 찜, 구이, 전, 조림 등)
3. 간단한 것부터 복잡한 것까지 다양하게
4. 한국 가정식/식당 메뉴 위주
5. 실제로 만들 수 있는 현실적인 요리만`;

        const userPrompt = `다음 재료로 만들 수 있는 요리 5가지를 추천해주세요:

재료: ${ingredients}

다음 형식으로 정확히 5개만 작성해주세요:

1. [요리명] - [한 줄 설명]
2. [요리명] - [한 줄 설명]
3. [요리명] - [한 줄 설명]
4. [요리명] - [한 줄 설명]
5. [요리명] - [한 줄 설명]

예시:
1. 감자샐러드 - 상큼한 마요네즈 드레싱의 간단한 반찬
2. 감자스프 - 부드럽고 고소한 크림 수프
3. 감자전 - 바삭한 식감의 전통 간식
4. 감자조림 - 달콤짭짤한 밑반찬
5. 감자볶음 - 고소하고 매콤한 볶음 요리`;

        // AI 호출 (토큰 추적 포함)
        const completion = await callOpenAIWithTracking(
            userId,
            async () => {
                return await openai.chat.completions.create({
                    model: "gpt-4o",
                    messages: [
                        { role: "system", content: systemPrompt },
                        { role: "user", content: userPrompt }
                    ],
                    temperature: 0.9,  // 창의성 높게
                    max_tokens: 500
                });
            },
            'dish-suggestion'
        );

        const dishesText = completion.choices[0].message.content;

        // 5가지 요리 파싱
        const dishes = parseDishSuggestions(dishesText);

        console.log('[요리 제안] 완료:', dishes);

        return {
            dishes,
            rawText: dishesText,
            timestamp: new Date().toISOString()
        };

    } catch (error) {
        console.error('[요리 제안] 오류:', error);
        throw new Error('요리 제안에 실패했습니다: ' + error.message);
    }
}

// 요리 제안 텍스트 파싱
function parseDishSuggestions(text) {
    const dishes = [];
    const lines = text.split('\n');

    for (const line of lines) {
        // "1. 감자샐러드 - 상큼한 마요네즈 드레싱의 간단한 반찬" 형식 파싱
        const match = line.match(/^\d+\.\s*(.+?)\s*-\s*(.+)$/);
        if (match) {
            dishes.push({
                name: match[1].trim(),
                description: match[2].trim()
            });
        }
    }

    return dishes;
}

async function generateRecipeWithAI(ingredients, style, maxTime, userId, dishName = null) {
    try {
        console.log('[레시피 생성] 파라미터:', {
            ingredients,
            style,
            maxTime,
            userId,
            dishName
        });

        const systemPrompt = `당신은 전문 요리사이자 레시피 개발 전문가입니다.
주어진 재료로 실용적이고 맛있는 레시피를 만들어주세요.

중요 지침:
1. 재료는 주어진 것만 사용 (기본 양념은 추가 가능)
2. 조리 시간은 ${maxTime || 60}분 이내
3. 한국 식당에서 실제로 판매 가능한 수준
4. 원가와 판매가격 계산 포함
5. 단계별 조리 과정을 명확하게
6. 실용적인 팁과 주의사항 포함`;

        const userPrompt = dishName 
            ? `다음 재료로 "${dishName}" 레시피를 만들어주세요:

재료: ${ingredients}
요리명: ${dishName}
${style ? `원하는 스타일: ${style}` : ''}

다음 형식으로 작성해주세요:`
            : `다음 재료로 레시피를 만들어주세요:

재료: ${ingredients}
${style ? `원하는 스타일: ${style}` : ''}

다음 형식으로 작성해주세요:

## 🍳 레시피명

### 📝 요리 소개
(2-3줄로 이 요리의 특징과 매력을 설명)

### 🥬 필요한 재료
**주재료:**
- 재료명: 수량 (예상 원가)

**양념재료:**
- 재료명: 수량

### 👨‍🍳 조리 과정

**준비 시간:** ○○분
**조리 시간:** ○○분
**난이도:** ★☆☆☆☆ (1-5개)

#### Step 1. [단계명]
(상세한 조리 설명)

#### Step 2. [단계명]
(상세한 조리 설명)

(필요한 만큼 단계 추가)

### 💰 원가 분석
- 재료 원가: ○○○원
- 1인분 원가: ○○○원
- 권장 판매가: ○○○원 (원가율 30% 기준)

### 💡 요리 팁
1. (실용적인 팁)
2. (주의사항)

### 🍴 추천 사이드 메뉴
- (어울리는 밑반찬이나 음료)

### 🏷️ 키워드
#레시피 #재료명 #요리스타일`;

        // AI 호출 (토큰 추적 포함)
        const completion = await callOpenAIWithTracking(
            userId,
            async () => {
                return await openai.chat.completions.create({
                    model: "gpt-4o",
                    messages: [
                        { role: "system", content: systemPrompt },
                        { role: "user", content: userPrompt }
                    ],
                    temperature: 0.8,
                    max_tokens: 2000
                });
            },
            'recipe-generation'
        );

        const recipe = completion.choices[0].message.content;

        // 레시피 파싱 (구조화된 데이터로 변환)
        const parsedRecipe = parseRecipeContent(recipe);

        return {
            recipe,
            parsed: parsedRecipe,
            timestamp: new Date().toISOString()
        };

    } catch (error) {
        console.error('[레시피 생성] 오류:', error);
        throw new Error('레시피 생성에 실패했습니다: ' + error.message);
    }
}

/**
 * 레시피 내용 파싱
 */
function parseRecipeContent(content) {
    try {
        // 레시피명 추출
        const nameMatch = content.match(/##\s*🍳?\s*(.+)/);
        const name = nameMatch ? nameMatch[1].trim() : '새로운 레시피';

        // 조리 시간 추출
        const prepTimeMatch = content.match(/준비 시간[:\s]*(\d+)분/);
        const cookTimeMatch = content.match(/조리 시간[:\s]*(\d+)분/);
        const prepTime = prepTimeMatch ? parseInt(prepTimeMatch[1]) : 0;
        const cookTime = cookTimeMatch ? parseInt(cookTimeMatch[1]) : 0;

        // 난이도 추출
        const difficultyMatch = content.match(/난이도[:\s]*(★+)/);
        const difficultyStars = difficultyMatch ? difficultyMatch[1].length : 3;
        const difficulties = ['', '초급', '초급', '중급', '고급', '전문가'];
        const difficulty = difficulties[difficultyStars] || '중급';

        // 원가 추출
        const costMatch = content.match(/1인분 원가[:\s]*(\d+[,\d]*)/);
        const costPerServing = costMatch ? 
            parseInt(costMatch[1].replace(/,/g, '')) : 0;

        return {
            name,
            prepTime,
            cookTime,
            totalTime: prepTime + cookTime,
            difficulty,
            costPerServing
        };
    } catch (error) {
        console.error('레시피 파싱 오류:', error);
        return null;
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
                {
                    const rawResult = await recommendBlogTopics(data.placeInfo, data.menuAnalysis, data.userId);
                    
                    // ✅ 주제 검증 및 필터링 (undefined 오류 방지)
                    if (rawResult.topics && Array.isArray(rawResult.topics)) {
                        rawResult.topics = rawResult.topics
                            .filter(topic => {
                                // 필수 필드가 모두 있는지 확인
                                const isValid = topic && 
                                    typeof topic.title === 'string' && topic.title.trim() !== '' &&
                                    typeof topic.description === 'string' && topic.description.trim() !== '' &&
                                    typeof topic.keywords === 'string' && topic.keywords.trim() !== '';
                                
                                if (!isValid) {
                                    console.warn('[주제 검증] 불완전한 주제 제거:', topic);
                                }
                                
                                return isValid;
                            })
                            .slice(0, 5); // 최대 5개만
                        
                        console.log(`[주제 검증] 유효한 주제 ${rawResult.topics.length}개 반환`);
                    }
                    
                    result = rawResult;
                }
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

            case 'suggest-dishes':
                {
                    try {
                        console.log('[요리 제안] 시작:', {
                            userId: data.userId || 'anonymous',
                            ingredients: data.ingredients
                        });

                        const suggestResult = await suggestDishesWithAI(
                            data.ingredients,
                            data.userId || null  // userId 없으면 null 전달
                        );

                        return res.status(200).json({
                            success: true,
                            data: suggestResult
                        });
                    } catch (error) {
                        console.error('[요리 제안] 오류:', error);
                        return res.status(500).json({
                            success: false,
                            error: `요리 제안 실패: ${error.message}`
                        });
                    }
                }

            case 'generate-recipe':
                {
                    try {
                        console.log('[레시피 생성] 시작:', {
                            userId: data.userId || 'anonymous',
                            ingredients: data.ingredients,
                            style: data.style,
                            maxTime: data.maxTime,
                            dishName: data.dishName
                        });

                        const recipeResult = await generateRecipeWithAI(
                            data.ingredients, 
                            data.style, 
                            data.maxTime,
                            data.userId || null,  // userId 없으면 null 전달
                            data.dishName  // 선택한 요리명 추가
                        );

                        return res.status(200).json({
                            success: true,
                            data: recipeResult
                        });
                    } catch (error) {
                        console.error('[레시피 생성] 오류:', error);
                        return res.status(500).json({
                            success: false,
                            error: `레시피 생성 실패: ${error.message}`
                        });
                    }
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
