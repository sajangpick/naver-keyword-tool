require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const crypto = require('crypto');

const app = express();

// 환경변수에서 설정 읽기
const PORT = process.env.PORT || 5502;
const NAVER_API = {
    baseUrl: 'https://api.searchad.naver.com',
    customerId: process.env.NAVER_CUSTOMER_ID,
    apiKey: process.env.NAVER_API_KEY,
    secretKey: process.env.NAVER_SECRET_KEY
};

// CORS 설정 - 프로덕션과 개발환경 분리
const corsOptions = {
    origin: process.env.NODE_ENV === 'production' 
        ? ['https://your-frontend-domain.com', 'https://your-frontend-domain.netlify.app'] 
        : ['http://localhost:3000', 'http://localhost:8080', 'http://127.0.0.1:5500'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
};

// 미들웨어 설정
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting (선택사항)
const requestCounts = new Map();
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15분
const RATE_LIMIT_MAX = 100; // 최대 100 요청

function rateLimiter(req, res, next) {
    const clientIP = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    
    if (!requestCounts.has(clientIP)) {
        requestCounts.set(clientIP, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
        return next();
    }
    
    const clientData = requestCounts.get(clientIP);
    
    if (now > clientData.resetTime) {
        clientData.count = 1;
        clientData.resetTime = now + RATE_LIMIT_WINDOW;
        return next();
    }
    
    if (clientData.count >= RATE_LIMIT_MAX) {
        return res.status(429).json({ 
            error: '요청 한도를 초과했습니다. 15분 후 다시 시도해주세요.' 
        });
    }
    
    clientData.count++;
    next();
}

// Rate limiter를 API 라우트에만 적용
app.use('/api/', rateLimiter);

// 서명 생성 함수
function generateSignature(timestamp, method, uri, secretKey) {
    const message = `${timestamp}.${method}.${uri}`;
    const hmac = crypto.createHmac('sha256', secretKey);
    hmac.update(message);
    return hmac.digest('base64');
}

// 로깅 미들웨어
app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    const method = req.method;
    const path = req.path;
    const ip = req.ip || req.connection.remoteAddress;
    
    console.log(`${timestamp} - ${method} ${path} - IP: ${ip}`);
    next();
});

// 서버 상태 확인
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: '네이버 검색광고 API 서버가 정상 작동 중입니다.',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        version: '1.1.0'
    });
});

// 루트 경로
app.get('/', (req, res) => {
    res.json({
        message: '네이버 검색광고 API 서버',
        version: '1.1.0',
        environment: process.env.NODE_ENV || 'development',
        endpoints: {
            health: 'GET /health - 서버 상태 확인',
            keywords: 'POST /api/keywords - 키워드 검색 (Body: {DataQ: "키워드"})',
            relatedKeywords: 'GET /api/related-keywords?seed=시드키워드 - 연관 키워드 검색'
        },
        examples: {
            keywordSearch: 'POST /api/keywords (Body: {DataQ: "치킨"})',
            relatedKeywords: 'GET /api/related-keywords?seed=맛집'
        }
    });
});

// 키워드 도구 API
app.post('/api/keywords', async (req, res) => {
    const { DataQ } = req.body;

    if (!DataQ) {
        return res.status(400).json({ 
            error: '키워드(DataQ)는 필수 매개변수입니다.' 
        });
    }

    // API 키 검증
    if (!NAVER_API.customerId || !NAVER_API.apiKey || !NAVER_API.secretKey) {
        return res.status(500).json({
            error: '네이버 API 설정이 올바르지 않습니다. 환경변수를 확인해주세요.'
        });
    }

    try {
        console.log(`키워드 검색 요청: "${DataQ}"`);

        const timestamp = Date.now().toString();
        const method = 'GET';
        const uri = '/keywordstool';
        const signature = generateSignature(timestamp, method, uri, NAVER_API.secretKey);

        // 네이버 검색광고 키워드 도구 API 호출
        const response = await axios.get(`${NAVER_API.baseUrl}${uri}`, {
            params: {
                hintKeywords: DataQ,
                showDetail: 1
            },
            headers: {
                'X-Timestamp': timestamp,
                'X-API-KEY': NAVER_API.apiKey,
                'X-Customer': NAVER_API.customerId,
                'X-Signature': signature,
                'Content-Type': 'application/json'
            },
            timeout: 30000 // 30초로 증가
        });

        console.log(`키워드 검색 성공: ${response.data.keywordList?.length || 0}개 결과`);
        
        res.json({
            ...response.data,
            searchInfo: {
                keyword: DataQ,
                timestamp: new Date().toISOString(),
                server: 'Railway'
            }
        });

    } catch (error) {
        console.error('네이버 검색광고 API 호출 오류:', error.message);
        
        if (error.response) {
            const { status, data } = error.response;
            console.error(`네이버 API 오류 (${status}):`, data);
            
            let errorMessage;
            switch (status) {
                case 400:
                    errorMessage = '잘못된 요청입니다. 키워드나 파라미터를 확인해주세요.';
                    break;
                case 401:
                    errorMessage = 'API 인증에 실패했습니다. API 키와 시그니처를 확인해주세요.';
                    break;
                case 403:
                    errorMessage = 'API 사용 권한이 없습니다.';
                    break;
                case 404:
                    errorMessage = 'API 엔드포인트를 찾을 수 없습니다.';
                    break;
                case 429:
                    errorMessage = 'API 호출 한도를 초과했습니다.';
                    break;
                case 500:
                    errorMessage = '네이버 서버 내부 오류입니다.';
                    break;
                default:
                    errorMessage = `네이버 API 오류 (${status})`;
            }
            
            res.status(status).json({ 
                error: errorMessage,
                details: data,
                timestamp: new Date().toISOString()
            });
        } else if (error.code === 'ECONNABORTED') {
            res.status(408).json({ 
                error: '요청 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.',
                details: error.message,
                timestamp: new Date().toISOString()
            });
        } else {
            res.status(500).json({ 
                error: '서버 내부 오류가 발생했습니다.',
                details: error.message,
                timestamp: new Date().toISOString()
            });
        }
    }
});

// 연관 키워드 검색 API (RelKwdStat)
app.get('/api/related-keywords', async (req, res) => {
    const { seed } = req.query;

    if (!seed) {
        return res.status(400).json({ 
            error: '시드 키워드(seed)는 필수 매개변수입니다.' 
        });
    }

    // API 키 검증
    if (!NAVER_API.customerId || !NAVER_API.apiKey || !NAVER_API.secretKey) {
        return res.status(500).json({
            error: '네이버 API 설정이 올바르지 않습니다. 환경변수를 확인해주세요.'
        });
    }

    try {
        console.log(`연관 키워드 검색 요청: "${seed}"`);

        const timestamp = Date.now().toString();
        const method = 'GET';
        const uri = '/relkwdstat';
        const signature = generateSignature(timestamp, method, uri, NAVER_API.secretKey);

        const response = await axios.get(`${NAVER_API.baseUrl}${uri}`, {
            params: {
                hintKeywords: seed,
                showDetail: 1
            },
            headers: {
                'X-Timestamp': timestamp,
                'X-API-KEY': NAVER_API.apiKey,
                'X-Customer': NAVER_API.customerId,
                'X-Signature': signature,
                'Content-Type': 'application/json'
            },
            timeout: 30000
        });

        console.log(`연관 키워드 검색 성공`);
        res.json({
            ...response.data,
            searchInfo: {
                seed: seed,
                timestamp: new Date().toISOString(),
                server: 'Railway'
            }
        });

    } catch (error) {
        console.error('연관 키워드 API 호출 오류:', error.message);
        
        if (error.response) {
            res.status(error.response.status).json({ 
                error: `네이버 API 오류 (${error.response.status})`,
                details: error.response.data,
                timestamp: new Date().toISOString()
            });
        } else {
            res.status(500).json({ 
                error: '서버 내부 오류가 발생했습니다.',
                details: error.message,
                timestamp: new Date().toISOString()
            });
        }
    }
});

// 404 에러 핸들러
app.use('*', (req, res) => {
    res.status(404).json({ 
        error: '요청한 경로를 찾을 수 없습니다.',
        path: req.originalUrl,
        availableEndpoints: [
            'GET /',
            'GET /health',
            'POST /api/keywords',
            'GET /api/related-keywords'
        ],
        timestamp: new Date().toISOString()
    });
});

// 전역 에러 핸들러
app.use((error, req, res, next) => {
    console.error('전역 에러:', error);
    res.status(500).json({
        error: '서버 내부 오류가 발생했습니다.',
        details: process.env.NODE_ENV === 'development' ? error.message : '서버 관리자에게 문의하세요.',
        timestamp: new Date().toISOString()
    });
});

// 서버 시작
app.listen(PORT, '0.0.0.0', () => {
    console.log('==========================================');
    console.log('🚀 네이버 검색광고 API 서버가 시작되었습니다!');
    console.log(`🌐 서버 주소: http://localhost:${PORT}`);
    console.log(`🏥 서버 상태: http://localhost:${PORT}/health`);
    console.log(`📊 환경: ${process.env.NODE_ENV || 'development'}`);
    console.log('==========================================');
    console.log('');
    console.log('🔧 API 사용법:');
    console.log('- 키워드 검색: POST /api/keywords (Body: {DataQ: "치킨"})');
    console.log('- 연관 키워드: GET /api/related-keywords?seed=맛집');
    console.log('');
    console.log('⚙️ API 설정 확인:');
    console.log(`- Customer ID: ${NAVER_API.customerId ? '✅ 설정됨' : '❌ 미설정'}`);
    console.log(`- API Key: ${NAVER_API.apiKey ? '✅ 설정됨' : '❌ 미설정'}`);
    console.log(`- Secret Key: ${NAVER_API.secretKey ? '✅ 설정됨' : '❌ 미설정'}`);
    console.log(`- Base URL: ${NAVER_API.baseUrl}`);
    console.log('==========================================');
});

// 종료 처리
process.on('SIGINT', () => {
    console.log('\n🛑 서버를 종료합니다...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 서버를 종료합니다...');
    process.exit(0);
});