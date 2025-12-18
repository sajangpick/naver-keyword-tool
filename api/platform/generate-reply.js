/**
 * AI 답글 생성 모듈
 * 모든 플랫폼에서 사용 가능한 통합 AI 답글 생성
 */

const { OpenAI } = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * AI 답글 생성
 * @param {string} reviewText - 리뷰 내용
 * @param {string} replyTone - 답글 톤 ('friendly', 'professional', 'casual')
 * @param {string} storeName - 매장명 (선택사항)
 * @returns {Promise<string>} 생성된 답글
 */
async function generateAIReply(reviewText, replyTone = 'friendly', storeName = '') {
  const tonePrompts = {
    friendly: `당신은 리뷰 답글 작성 전문가입니다. (친근한 톤)

**핵심 원칙:**
- 50자 이내로 간결하게 작성
- 이모지 1-2개 자연스럽게 사용
- 따뜻하고 친근한 존댓말
- 진심 어린 감사 인사

**답글 예시:**
"감사합니다! 😊 다음에도 맛있게 드실 수 있도록 더 노력하겠습니다. 또 뵙겠습니다!"

위 형식에 맞춰 답글만 작성해주세요. 다른 설명은 하지 마세요.`,

    professional: `당신은 리뷰 답글 작성 전문가입니다. (전문적인 톤)

**핵심 원칙:**
- 70자 이내로 정중하게 작성
- 이모지 사용 최소화
- 격식 있고 예의 바른 존댓말
- 전문적이고 신뢰감 있는 표현

**답글 예시:**
"소중한 리뷰 감사드립니다. 고객님의 만족이 저희의 최우선 가치입니다. 더욱 노력하는 ${storeName || '저희'}가 되겠습니다."

위 형식에 맞춰 답글만 작성해주세요. 다른 설명은 하지 마세요.`,

    casual: `당신은 리뷰 답글 작성 전문가입니다. (캐주얼 톤)

**핵심 원칙:**
- 40자 이내로 짧고 간결하게
- 반말 가능 (친근한 느낌)
- 이모지 적절히 사용
- 편안하고 자연스러운 표현

**답글 예시:**
"고마워요! 😄 또 오세요~"

위 형식에 맞춰 답글만 작성해주세요. 다른 설명은 하지 마세요.`
  };

  const systemPrompt = tonePrompts[replyTone] || tonePrompts.friendly;

  const userPrompt = `[고객 리뷰]
${reviewText}

위 리뷰에 대한 ${replyTone === 'friendly' ? '친근한' : replyTone === 'professional' ? '전문적인' : '캐주얼'} 톤의 답글을 작성해주세요.`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 200
    });

    return completion.choices[0].message.content.trim();
  } catch (error) {
    console.error('[AI 답글 생성] 오류:', error);
    throw new Error('AI 답글 생성 실패: ' + error.message);
  }
}

module.exports = {
  generateAIReply
};

