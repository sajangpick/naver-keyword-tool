/**
 * Vercel Serverless Function: ChatGPT 채팅 API
 * Endpoint: /api/chat
 * Method: POST
 * 
 * 메인 화면의 GPT-5 검색창에서 사용
 */

const axios = require('axios');
const { trackTokenUsage, checkTokenLimit, extractUserId } = require('./middleware/token-tracker');

// 입력값 정제 함수
function sanitizeString(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/[<>]/g, '').trim();
}

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

    console.log('ChatGPT 채팅 요청 수신:', { messageLength: message.length, userId });

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

    // 토큰 한도 사전 체크 (예상 토큰: 1500)
    if (userId) {
      const limitCheck = await checkTokenLimit(userId, 1500);
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

    // OpenAI API 호출
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content:
              '당신은 도움이 되는 AI 어시스턴트입니다. 한국어로 친근하고 정확하게 답변해주세요. 사용자의 질문에 성실하게 대답하고, 필요한 경우 추가 설명이나 예시를 제공해주세요.',
          },
          {
            role: 'user',
            content: message,
          },
        ],
        max_tokens: 1500,
        temperature: 0.7,
      },
      {
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );

    console.log('✅ ChatGPT 응답 성공');

    // 토큰 사용량 추적
    let tokenTracking = null;
    if (userId && response.data.usage) {
      tokenTracking = await trackTokenUsage(userId, response.data.usage, 'chat');
      console.log('토큰 추적 결과:', tokenTracking);
    }

    return res.json({
      success: true,
      reply: response.data.choices[0].message.content,
      usage: response.data.usage,
      tokenTracking,
      metadata: {
        model: 'gpt-4o-mini',
        timestamp: new Date().toISOString(),
        server: 'Vercel Serverless',
      },
    });
  } catch (error) {
    console.error('❌ ChatGPT API 오류:', error.response?.data || error.message);

    return res.status(500).json({
      success: false,
      error: 'ChatGPT API 호출 중 오류가 발생했습니다.',
      details: error.response?.data?.error?.message || error.message,
      timestamp: new Date().toISOString(),
    });
  }
};

