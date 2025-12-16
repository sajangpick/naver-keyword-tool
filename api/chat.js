/**
 * Vercel Serverless Function: ChatGPT 채팅 API
 * Endpoint: /api/chat
 * Method: POST
 * 
 * 메인 화면의 GPT-5 검색창에서 사용
 * 
 * Function Calling 기능 포함:
 * - 뉴스 검색
 * - 레시피 검색
 * - 정책 지원금 검색
 */

const axios = require('axios');
const { trackTokenUsage, checkTokenLimit, extractUserId, isDemoMode } = require('./middleware/token-tracker');

// 입력값 정제 함수
function sanitizeString(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/[<>]/g, '').trim();
}

// API 기본 URL 결정
function getApiBaseUrl(req) {
  // Vercel 환경
  if (process.env.VERCEL) {
    // Vercel에서는 배포된 URL 사용
    const vercelUrl = process.env.VERCEL_URL;
    if (vercelUrl) {
      return `https://${vercelUrl}`;
    }
    // 프로덕션 URL이 설정된 경우
    if (process.env.NEXT_PUBLIC_SITE_URL) {
      return process.env.NEXT_PUBLIC_SITE_URL;
    }
    // 기본값: 상대 경로 (같은 서버)
    return '';
  }
  
  // 로컬 환경
  const host = req.headers.host || 'localhost:3003';
  const protocol = req.headers['x-forwarded-proto'] || 
                   (req.headers.referer?.startsWith('https') ? 'https' : 'http');
  
  // 로컬에서 내부 API 호출 시 localhost 사용
  return `${protocol}://${host}`;
}

// ==================== Function Calling 함수들 ====================

/**
 * 뉴스 검색 함수
 */
async function searchNews(query, apiBaseUrl) {
  try {
    const response = await axios.get(`${apiBaseUrl}/api/news-search`, {
      params: { query, display: 5, sort: 'date' }
    });

    if (!response.data.success) {
      return {
        success: false,
        error: response.data.error || '뉴스 검색 실패',
        items: []
      };
    }

    return {
      success: true,
      items: response.data.items || [],
      total: response.data.total || 0
    };
  } catch (error) {
    console.error('뉴스 검색 오류:', error.message);
    return {
      success: false,
      error: error.response?.data?.error || error.message,
      items: []
    };
  }
}

/**
 * 레시피 검색 함수
 */
async function searchRecipes(keyword, apiBaseUrl) {
  try {
    const response = await axios.get(`${apiBaseUrl}/api/recipes/search`, {
      params: { keyword, source: 'all' }
    });

    return {
      success: true,
      recipes: response.data.data || response.data.recipes || [],
      count: response.data.count || 0
    };
  } catch (error) {
    console.error('레시피 검색 오류:', error.message);
    return {
      success: false,
      error: error.message,
      recipes: []
    };
  }
}

/**
 * 정책 지원금 검색 함수
 */
async function searchPolicies(keyword, category, apiBaseUrl) {
  try {
    const params = { status: 'active', limit: 10, page: 1 };
    if (keyword) params.search = keyword;
    if (category) params.category = category;

    const response = await axios.get(`${apiBaseUrl}/api/policy-support`, {
      params
    });

    if (!response.data.success) {
      return {
        success: false,
        error: response.data.error || '정책 검색 실패',
        policies: []
      };
    }

    return {
      success: true,
      policies: response.data.data || [],
      count: response.data.pagination?.total || response.data.data?.length || 0
    };
  } catch (error) {
    console.error('정책 검색 오류:', error.message);
    return {
      success: false,
      error: error.response?.data?.error || error.message,
      policies: []
    };
  }
}

/**
 * 날씨 검색 함수 (OpenWeatherMap API 사용)
 */
async function getWeather(city) {
  try {
    const apiKey = process.env.OPENWEATHER_API_KEY;
    
    if (!apiKey) {
      // API 키가 없으면 일반적인 날씨 정보 제공
      return {
        success: false,
        error: '날씨 API 키가 설정되지 않았습니다. 환경변수 OPENWEATHER_API_KEY를 설정해주세요.',
        fallback: true
      };
    }

    // 한국 도시명 매핑
    const cityMap = {
      '서울': 'Seoul',
      '부산': 'Busan',
      '대구': 'Daegu',
      '인천': 'Incheon',
      '광주': 'Gwangju',
      '대전': 'Daejeon',
      '울산': 'Ulsan',
      '수원': 'Suwon',
      '고양': 'Goyang',
      '용인': 'Yongin',
      '성남': 'Seongnam',
      '부천': 'Bucheon',
      '안산': 'Ansan',
      '안양': 'Anyang',
      '평택': 'Pyeongtaek',
      '시흥': 'Siheung',
      '김포': 'Gimpo',
      '의정부': 'Uijeongbu',
      '광명': 'Gwangmyeong',
      '파주': 'Paju',
      '이천': 'Icheon',
      '오산': 'Osan',
      '구리': 'Guri',
      '안성': 'Anseong',
      '포천': 'Pocheon',
      '의왕': 'Uiwang',
      '하남': 'Hanam',
      '여주': 'Yeoju',
      '양주': 'Yangju',
      '과천': 'Gwacheon',
      '가평': 'Gapyeong',
      '연천': 'Yeoncheon',
      '남양주': 'Namyangju',
      '화성': 'Hwaseong'
    };

    const cityName = cityMap[city] || city;

    // 현재 날씨 및 5일 예보 가져오기
    const currentWeatherResponse = await axios.get('https://api.openweathermap.org/data/2.5/weather', {
      params: {
        q: `${cityName},KR`,
        appid: apiKey,
        units: 'metric',
        lang: 'kr'
      }
    });

    const forecastResponse = await axios.get('https://api.openweathermap.org/data/2.5/forecast', {
      params: {
        q: `${cityName},KR`,
        appid: apiKey,
        units: 'metric',
        lang: 'kr'
      }
    });

    const current = currentWeatherResponse.data;
    const forecast = forecastResponse.data;

    // 시간별 예보 처리 (오늘 날짜만)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const hourlyForecast = forecast.list
      .filter(item => {
        const itemDate = new Date(item.dt * 1000);
        itemDate.setHours(0, 0, 0, 0);
        return itemDate.getTime() === today.getTime();
      })
      .slice(0, 8) // 오늘 8개 시간대만
      .map(item => ({
        time: new Date(item.dt * 1000),
        temp: Math.round(item.main.temp),
        description: item.weather[0].description,
        icon: item.weather[0].icon,
        humidity: item.main.humidity,
        windSpeed: item.wind.speed
      }));

    return {
      success: true,
      city: current.name,
      current: {
        temp: Math.round(current.main.temp),
        feelsLike: Math.round(current.main.feels_like),
        description: current.weather[0].description,
        icon: current.weather[0].icon,
        humidity: current.main.humidity,
        windSpeed: current.wind.speed,
        visibility: current.visibility ? (current.visibility / 1000).toFixed(1) : null
      },
      hourly: hourlyForecast,
      location: {
        name: current.name,
        country: current.sys.country,
        lat: current.coord.lat,
        lon: current.coord.lon
      }
    };
  } catch (error) {
    console.error('날씨 검색 오류:', error.response?.data || error.message);
    
    // API 키 오류가 아니면 fallback 정보 제공
    if (error.response?.status === 401) {
      return {
        success: false,
        error: '날씨 API 키가 유효하지 않습니다.',
        fallback: false
      };
    }
    
    return {
      success: false,
      error: error.response?.data?.message || error.message,
      fallback: true
    };
  }
}

/**
 * 함수 실행 함수
 */
async function executeFunction(name, args, apiBaseUrl) {
  switch (name) {
    case 'search_news':
      return await searchNews(args.query || args.keyword, apiBaseUrl);
    case 'search_recipes':
      return await searchRecipes(args.keyword || args.query, apiBaseUrl);
    case 'search_policies':
      return await searchPolicies(args.keyword || args.query, args.category, apiBaseUrl);
    case 'get_weather':
      return await getWeather(args.city || args.location);
    default:
      return { success: false, error: `알 수 없는 함수: ${name}` };
  }
}

// ==================== OpenAI Tools 정의 ====================
const availableTools = [
  {
    type: 'function',
    function: {
      name: 'search_news',
      description: '최신 뉴스를 검색합니다. 음식점, 레스토랑, 소상공인, 정책 등에 대한 뉴스를 찾을 때 사용합니다.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: '검색할 뉴스 키워드 (예: "소상공인 지원금", "음식점 마케팅", "레스토랑 트렌드")'
          }
        },
        required: ['query']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'search_recipes',
      description: '레시피를 검색합니다. 요리 방법, 음식 레시피, 재료 등에 대한 정보를 찾을 때 사용합니다.',
      parameters: {
        type: 'object',
        properties: {
          keyword: {
            type: 'string',
            description: '검색할 레시피 키워드 (예: "김치찌개", "파스타", "초밥")'
          }
        },
        required: ['keyword']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'search_policies',
      description: '정책 지원금 정보를 검색합니다. 정부 지원금, 창업 지원, 운영 지원금 등에 대한 정보를 찾을 때 사용합니다.',
      parameters: {
        type: 'object',
        properties: {
          keyword: {
            type: 'string',
            description: '검색할 정책 키워드 (예: "창업 지원", "소상공인 지원금", "마케팅 지원")'
          },
          category: {
            type: 'string',
            enum: ['startup', 'operation', 'employment', 'facility', 'marketing', 'education', 'other'],
            description: '정책 카테고리'
          }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_weather',
      description: '특정 도시의 현재 날씨 및 시간별 예보를 가져옵니다. 날씨 관련 질문에 사용합니다.',
      parameters: {
        type: 'object',
        properties: {
          city: {
            type: 'string',
            description: '날씨를 확인할 도시 이름 (예: "서울", "부산", "대구", "인천")'
          }
        },
        required: ['city']
      }
    }
  }
];

module.exports = async (req, res) => {
  // CORS 설정
  res.setHeader('Access-Control-Allow-Credentials', 'true');
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
      error: 'Method not allowed. Use POST.',
    });
  }

  try {
    const rawMsg = req.body?.message || '';
    const message = sanitizeString(rawMsg);
    const userId = await extractUserId(req);
    
    // 데모 모드 확인
    const demoMode = isDemoMode(req);
    if (demoMode) {
      console.log('✅ [chat] 데모 모드 감지: 토큰 체크 우회');
    }

    console.log('ChatGPT 채팅 요청 수신:', { messageLength: message.length, userId, demoMode });

    // 입력 데이터 검증
    if (!message || message.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: '메시지가 필요합니다.',
      });
    }

    if (message.length > 4000) {
      return res.status(400).json({
        success: false,
        error: '메시지가 너무 깁니다. 4000자 이하로 입력해주세요.',
      });
    }

    // 토큰 한도 사전 체크 (예상 토큰: 1500) - 데모 모드일 때는 우회
    if (userId && userId !== 'demo_user_12345') {
      const limitCheck = await checkTokenLimit(userId, 1500, demoMode);
      if (!limitCheck.success) {
        return res.status(403).json({
          success: false,
          error: limitCheck.error,
          tokenInfo: {
            remaining: limitCheck.remaining,
            limit: limitCheck.limit
          }
        });
      }
    }

    // OpenAI API 키 확인
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_API_KEY) {
      console.error('❌ OpenAI API 키가 설정되지 않았습니다.');
      return res.status(500).json({
        success: false,
        error: 'OpenAI API 키가 설정되지 않았습니다. 환경변수를 확인해주세요.',
      });
    }

    // API 기본 URL 결정
    const apiBaseUrl = getApiBaseUrl(req);

    // 현재 날짜 및 계절 정보
    const now = new Date();
    const month = now.getMonth() + 1; // 1-12
    const day = now.getDate();
    const weekdays = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
    const weekday = weekdays[now.getDay()];
    let season = '';
    if (month >= 3 && month <= 5) season = '봄';
    else if (month >= 6 && month <= 8) season = '여름';
    else if (month >= 9 && month <= 11) season = '가을';
    else season = '겨울';

    // 대화 메시지 배열
    const messages = [
      {
        role: 'system',
        content:
          '당신은 ChatGPT입니다. ChatGPT 웹사이트에서 제공하는 것과 정확히 동일한 방식으로 답변해주세요.\n\n' +
          '현재 날짜 정보: ' + `${now.getFullYear()}년 ${month}월 ${day}일 ${weekday}, ${season}` + '\n\n' +
          '⚠️ 매우 중요한 규칙:\n' +
          '- 절대로 "제공할 수 없습니다", "실시간 정보를 제공할 수 없습니다", "확인할 수 없습니다" 같은 부정적인 표현을 사용하지 마세요.\n' +
          '- 모든 질문에 대해 가능한 한 유용하고 구체적인 정보를 제공해주세요.\n' +
          '- ChatGPT 웹사이트처럼 항상 자연스럽고 도움이 되는 답변을 제공해주세요.\n\n' +
          '답변 지침:\n' +
          '1. 날씨 질문: 반드시 ChatGPT 웹사이트처럼 구조화된 형식으로 답변해주세요. get_weather 함수를 사용하여 실제 데이터를 가져올 수 있으면 사용하고, 없어도 학습된 지식과 현재 계절(' + season + ') 정보를 바탕으로 구체적이고 유용한 답변을 제공해주세요.\n' +
          '   - 반드시 현재 날씨 정보를 먼저 표시하세요 (예: "현재 약 15°· 대체로 흐림")\n' +
          '   - 위치 표시 (예: "부산, 대한민국")\n' +
          '   - 시간별 예보를 마크다운 테이블로 제공\n' +
          '   - 요약 테이블 제공\n' +
          '   - 절대로 "제공할 수 없습니다"라고 말하지 마세요. 대신 일반적인 날씨 패턴과 계절 정보를 바탕으로 구체적인 답변을 제공하세요.\n' +
          '   - 예시 형식 (반드시 이 형식을 따르세요):\n' +
          '     현재 약 15°· 대체로 흐림\n' +
          '     부산, 대한민국\n' +
          '     \n' +
          '     시간별 예보:\n' +
          '     | 시간 | 날씨 | 온도 |\n' +
          '     |------|------|------|\n' +
          '     | 오전 10시 | ☁️ | 14° |\n' +
          '     | 오후 12시 | ⛅ | 17° |\n' +
          '     | 오후 2시 | ☀️ | 19° |\n' +
          '     \n' +
          '     부산의 오늘 날씨를 정리해드릴게요:\n' +
          '     | 시간대 | 날씨 | 기온 |\n' +
          '     |--------|------|------|\n' +
          '     | 현재 | 대체로 흐림 | 약 15°C |\n' +
          '     | 오전 (10-11시) | 간헐적 흐림 → 일부 화창 | 14-16°C |\n' +
          '     | 정오~오후 (12-14시) | 대체로 화창 | 18-20°C |\n' +
          '     | 오후 늦게~저녁 (15-18시) | 화창 → 맑음 | 19-18°C |\n' +
          '2. 모든 질문: 학습된 지식을 바탕으로 정확하고 도움이 되는 정보를 제공해주세요. ChatGPT 웹사이트처럼 자연스럽고 친근하게 답변해주세요.\n' +
          '3. 실제 데이터가 필요한 경우: 제공된 함수(search_news, search_recipes, search_policies, get_weather)를 자동으로 사용하여 최신 정보를 검색한 후 답변해주세요.\n' +
          '4. 답변 스타일: ChatGPT 웹사이트와 정확히 동일하게 구조화되고 시각적으로 보기 좋은 형식으로 답변해주세요. 마크다운 테이블, 헤더, 볼드 등을 적극 활용해주세요.\n' +
          '5. 부정적인 표현 금지: "제공할 수 없습니다", "실시간 정보를 제공할 수 없습니다", "확인할 수 없습니다" 같은 표현은 절대 사용하지 마세요. 항상 가능한 정보를 제공하세요.',
      },
      {
        role: 'user',
        content: message,
      },
    ];

    // Function Calling 처리 루프 (최대 3회)
    let finalResponse = null;
    let totalUsage = null;
    const maxIterations = 3;
    
    for (let iteration = 0; iteration < maxIterations; iteration++) {
      // OpenAI API 호출
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-5.2',
          messages: messages,
          tools: availableTools,
          tool_choice: iteration === 0 ? 'auto' : 'auto', // 첫 번째는 자동, 이후에도 자동
          max_tokens: 2000,
          temperature: 0.7,
        },
        {
          headers: {
            Authorization: `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          timeout: 45000, // 함수 호출 시간을 고려하여 증가
        }
      );

      const choice = response.data.choices[0];
      totalUsage = response.data.usage;

          // 함수 호출이 필요한 경우
          if (choice.message.tool_calls && choice.message.tool_calls.length > 0) {
            console.log(`🔄 함수 호출 필요 (반복 ${iteration + 1}/${maxIterations}):`, 
              choice.message.tool_calls.map(tc => tc.function.name).join(', '));

            // 메시지에 AI의 응답 추가
            messages.push({
              role: 'assistant',
              content: choice.message.content || null,
              tool_calls: choice.message.tool_calls,
            });

            // 각 함수 호출 실행
            for (const toolCall of choice.message.tool_calls) {
              const functionName = toolCall.function.name;
              let functionArgs;
              
              try {
                functionArgs = JSON.parse(toolCall.function.arguments);
              } catch (e) {
                console.error('함수 인자 파싱 오류:', e);
                functionArgs = {};
              }

              console.log(`📞 함수 실행: ${functionName}`, functionArgs);

              // 함수 실행
              const functionResult = await executeFunction(functionName, functionArgs, apiBaseUrl);

              // 함수 실행 실패 시에도 계속 진행 (AI가 일반 답변 생성)
              // 날씨 API 키가 없는 경우 fallback 정보와 함께 계속 진행
              if (!functionResult.success && functionResult.fallback) {
                // fallback 정보를 포함하여 AI가 일반 답변 생성 가능하도록
                messages.push({
                  role: 'tool',
                  tool_call_id: toolCall.id,
                  name: functionName,
                  content: JSON.stringify({
                    ...functionResult,
                    note: 'API 키가 없거나 함수 실행에 실패했지만, 학습된 지식과 현재 계절 정보를 바탕으로 유용한 답변을 제공해주세요.'
                  }),
                });
              } else {
                // 함수 실행 결과를 메시지에 추가
                messages.push({
                  role: 'tool',
                  tool_call_id: toolCall.id,
                  name: functionName,
                  content: JSON.stringify(functionResult),
                });
              }
            }

            // 다음 반복으로 계속
            continue;
          } else {
            // 최종 답변이 준비됨
            finalResponse = choice.message.content;
            console.log('✅ ChatGPT 최종 응답 생성 완료');
            break;
          }
    }

    // 최대 반복 횟수 초과 시
    if (!finalResponse) {
      console.warn('⚠️ 최대 반복 횟수 초과, 마지막 응답 사용');
      finalResponse = messages[messages.length - 1]?.content || '응답을 생성하는데 시간이 걸렸습니다. 다시 시도해주세요.';
    }

    // 토큰 사용량 추적 (데모 모드일 때는 우회)
    let tokenTracking = null;
    if (userId && totalUsage && userId !== 'demo_user_12345') {
      tokenTracking = await trackTokenUsage(userId, totalUsage, 'chat', null, demoMode);
      console.log('토큰 추적 결과:', tokenTracking);
    } else if (demoMode || userId === 'demo_user_12345') {
      console.log('✅ [chat] 데모 모드: 토큰 추적 우회');
    }

    return res.json({
      success: true,
      reply: finalResponse,
      usage: totalUsage,
      tokenTracking,
      metadata: {
        model: 'gpt-5.2',
        timestamp: new Date().toISOString(),
        server: 'Vercel Serverless',
        function_calls_used: messages.filter(m => m.role === 'tool').length,
      },
    });
  } catch (error) {
    console.error('❌ ChatGPT API 오류:', error.response?.data || error.message);
    
    // 모델 관련 에러인지 확인
    const errorMessage = error.response?.data?.error?.message || error.message || '';
    const isModelError = errorMessage.includes('model') || errorMessage.includes('gpt-5.2') || errorMessage.includes('not found');
    
    // 상세 에러 정보 로깅
    if (error.response?.data) {
      console.error('OpenAI API 응답:', JSON.stringify(error.response.data, null, 2));
    }

    return res.status(500).json({
      success: false,
      error: isModelError 
        ? `모델 오류: gpt-5.2가 지원되지 않을 수 있습니다. ${errorMessage}`
        : 'ChatGPT API 호출 중 오류가 발생했습니다.',
      details: errorMessage,
      model: 'gpt-5.2',
      timestamp: new Date().toISOString(),
    });
  }
};

