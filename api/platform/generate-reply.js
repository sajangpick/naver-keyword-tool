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
 * work_plan.md의 규칙에 따라 작성
 * @param {string} reviewText - 리뷰 내용
 * @param {number} rating - 평점 (1-5)
 * @param {string} replyTone - 답글 톤 ('friendly', 'professional', 'casual')
 * @param {string} storeName - 매장명 (선택사항)
 * @returns {Promise<string>} 생성된 답글
 */
async function generateAIReply(reviewText, rating = null, replyTone = 'friendly', storeName = '') {
  const systemPrompt = `당신은 식당 사장님입니다. 리뷰에 대한 답글을 작성해주세요.

**절대 지켜야 할 규칙:**
1. 사장님 말투로 작성할 것 (손님/방문객 시점 절대 금지)
2. 리뷰에 언급된 핵심 포인트 1~2가지를 반드시 언급할 것
3. 과도한 사과 표현은 사용하지 말 것
4. 책임을 인정하거나 보상, 환불을 암시하는 표현은 사용하지 말 것
5. 감정적인 표현, 이모지는 사용하지 말 것
6. 길이는 2~3문장으로 간결하게 작성할 것
7. 마지막 문장은 다시 방문을 유도하는 문장으로 마무리할 것
8. 반드시 "저희 가게를 이용해주셔서 감사합니다" 또는 의미가 동일한 감사 문구를 포함할 것

**답글 예시:**
"저희 가게를 이용해주셔서 감사합니다. 맛있게 드셨다는 말씀에 정말 기쁩니다. 다음에도 좋은 음식으로 찾아뵙겠습니다."

위 형식에 맞춰 답글만 작성해주세요. 다른 설명은 하지 마세요.`;

  // 리뷰에서 핵심 키워드 추출 (간단한 방법)
  const keywords = extractKeywords(reviewText);
  const keywordHint = keywords.length > 0 ? `\n\n리뷰에서 언급된 내용: ${keywords.join(', ')}` : '';

  const userPrompt = `[고객 리뷰]
${reviewText}
${rating ? `평점: ${rating}점` : ''}${keywordHint}

위 리뷰에 대한 사장님 시점의 답글을 작성해주세요. 리뷰에 언급된 핵심 내용을 반드시 포함하고, 감사 인사와 재방문 유도 문구를 포함해주세요.`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      max_completion_tokens: 150
    });

    let reply = completion.choices[0].message.content.trim();
    
    // 이모지 제거 (규칙 5)
    reply = reply.replace(/[\u{1F300}-\u{1F9FF}]/gu, '');
    reply = reply.replace(/[\u{2600}-\u{26FF}]/gu, '');
    reply = reply.replace(/[\u{2700}-\u{27BF}]/gu, '');
    
    return reply;
  } catch (error) {
    console.error('[AI 답글 생성] 오류:', error);
    throw new Error('AI 답글 생성 실패: ' + error.message);
  }
}

/**
 * 리뷰에서 핵심 키워드 추출 (간단한 방법)
 */
function extractKeywords(text) {
  if (!text) return [];
  
  // 간단한 키워드 패턴 (음식, 맛, 서비스, 분위기 등)
  const keywordPatterns = [
    /맛있|맛나|맛|음식/g,
    /서비스|친절|직원/g,
    /분위기|인테리어|깔끔/g,
    /가격|저렴|비싸/g,
    /양|포만|배불/g,
    /재료|신선|신선도/g,
    /대기|줄|혼잡/g
  ];
  
  const foundKeywords = [];
  keywordPatterns.forEach((pattern, index) => {
    if (pattern.test(text)) {
      const keywords = ['맛', '서비스', '분위기', '가격', '양', '재료', '대기'];
      if (keywords[index] && !foundKeywords.includes(keywords[index])) {
        foundKeywords.push(keywords[index]);
      }
    }
  });
  
  return foundKeywords.slice(0, 2); // 최대 2개만
}

module.exports = {
  generateAIReply
};

