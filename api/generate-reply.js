import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req, res) {
  // CORS 헤더 설정
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { 
      reviewText, 
      placeInfo, 
      ownerTips, 
      action, 
      replyStyle,
      selectedPromoPoints,
      promotionData,
      hasPromotion
    } = req.body;

    if (!reviewText) {
      return res.status(400).json({ 
        success: false, 
        error: '리뷰 텍스트가 필요합니다.' 
      });
    }

    // 액션: 홍보 포인트 추천
    if (action === 'recommend-promo-points') {
      const promoPoints = await recommendPromoPoints(reviewText, placeInfo, ownerTips, promotionData);
      return res.status(200).json({
        success: true,
        data: { promoPoints }
      });
    }

    // 기본: 답글 생성
    const reply = await generateReply(
      reviewText, 
      placeInfo, 
      ownerTips, 
      replyStyle || 'promo',
      selectedPromoPoints,
      promotionData
    );

    return res.status(200).json({
      success: true,
      data: { reply }
    });

  } catch (error) {
    console.error('답글 생성 오류:', error);
    return res.status(500).json({
      success: false,
      error: error.message || '답글 생성 중 오류가 발생했습니다.'
    });
  }
}

/**
 * AI 홍보 포인트 추천
 */
async function recommendPromoPoints(reviewText, placeInfo, ownerTips, promotionData = null) {
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
  }

  const systemPrompt = `당신은 네이버 플레이스 리뷰 답글 작성 전문가입니다.
리뷰 내용을 분석하여, 답글에 추가하면 좋을 홍보 포인트를 추천해주세요.

**목적:** 리뷰 답글은 작성자뿐만 아니라 처음 방문을 고려하는 잠재 고객들이 읽습니다.
따라서 자연스럽게 가게의 장점을 홍보할 수 있는 포인트를 추천해야 합니다.

**추천 기준:**
1. 리뷰에 언급되지 않은 다른 인기 메뉴
2. 주차, 예약 가능 여부 등 편의 정보
3. 가족 모임, 데이트, 회식 등 추천 상황
4. 특별한 서비스 (룸, 단체석, 포장 가능 등)
5. 시그니처 메뉴나 특별한 조리법
6. 재료의 신선도, 원산지 등 품질 정보

**출력 형식:**
각 포인트를 짧고 명확하게 표현 (5-8개 추천)
예: "갈비탕도 추천", "주차 2시간 무료", "가족 모임 추천", "예약 가능", "룸 이용 가능"`;

  const userPrompt = `[고객 리뷰]
${reviewText}

${placeInfo ? `[식당 정보]
- 이름: ${placeInfo.name || ''}
- 업종: ${placeInfo.category || ''}
- 주소: ${placeInfo.address || ''}
- 메뉴: ${placeInfo.menuItems?.map(m => m.name).join(', ') || '정보 없음'}
` : ''}

${ownerTips ? `[사장님 추천 포인트]
${ownerTips}
` : ''}
${promotionPrompt}

위 정보를 바탕으로 답글에 자연스럽게 추가하면 좋을 홍보 포인트를 5-8개 추천해주세요.
각 포인트는 짧고 명확하게 (5-10자 이내).

출력 형식:
포인트1
포인트2
포인트3
...`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    temperature: 0.7,
  });

  const content = response.choices[0]?.message?.content || '';
  const points = content
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('[') && !line.startsWith('#'))
    .slice(0, 8);

  return points;
}

/**
 * 답글 생성 (스타일별)
 */
async function generateReply(reviewText, placeInfo, ownerTips, replyStyle, selectedPromoPoints, promotionData = null) {
  // 프로모션 정보 프롬프트 생성
  let promotionPrompt = '';
  if (promotionData) {
    promotionPrompt = '\n[🎯 우리 가게만의 특별함]\n';
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
    promotionPrompt += '\n위 정보를 답글에 자연스럽게 녹여주세요.\n';
  }

  // 스타일별 시스템 프롬프트
  const stylePrompts = {
    promo: `당신은 네이버 플레이스 리뷰 답글 작성 전문가입니다. (홍보형 스타일)

**핵심 원칙:**
리뷰 답글은 작성자뿐만 아니라 **처음 방문을 고려하는 잠재 고객들이 읽습니다.**
따라서 감사 인사와 함께 자연스럽게 가게의 장점을 홍보하는 것이 중요합니다.

**작성 가이드:**
1. 리뷰 작성자에게 감사 인사
2. 리뷰에 언급된 메뉴 외에 다른 인기 메뉴를 자연스럽게 추천
3. 주차, 예약, 편의시설 정보를 적극적으로 언급
4. 가족 모임, 데이트, 회식 등 추천 상황 제안
5. 특별한 서비스나 이벤트가 있다면 안내
6. "다음에 또 방문해주세요" 같은 따뜻한 마무리

**톤앤매너:**
- 정중하면서도 친근한 존댓말
- 구체적이고 유용한 정보 제공
- 읽는 사람이 "나도 가보고 싶다"고 느끼게 작성
- 과도한 칭찬은 피하고, 사실적이고 자연스럽게

**답글 길이:** 200-300자 내외`,

    professional: `당신은 네이버 플레이스 리뷰 답글 작성 전문가입니다. (전문가형 스타일)

**핵심 원칙:**
전문성과 신뢰감을 주는 답글을 작성하여 읽는 사람들이 "이 집은 제대로 하는구나"라고 느끼게 합니다.

**작성 가이드:**
1. 리뷰 작성자에게 정중한 감사 인사
2. 메뉴의 재료, 조리법, 원산지 등 전문적인 정보 제공
3. 가게의 철학, 특별한 노하우, 품질 관리 방법 언급
4. 계절별 메뉴나 추천 조합 등 전문가적 조언
5. 신뢰감을 주는 구체적인 정보 (예: "매일 아침 직접 만드는", "국내산 한우만 사용")

**톤앤매너:**
- 정중하고 격식 있는 존댓말
- 구체적이고 전문적인 표현
- 과장 없이 사실에 기반한 설명
- 전문가로서의 자부심과 책임감 표현

**답글 길이:** 200-300자 내외`,

    friendly: `당신은 네이버 플레이스 리뷰 답글 작성 전문가입니다. (친근형 스타일)

**핵심 원칙:**
따뜻하고 친근한 답글로 단골 고객을 만들고, 읽는 사람들이 편안함을 느끼게 합니다.

**작성 가이드:**
1. 진심 어린 감사 인사
2. 고객의 리뷰 내용에 공감하고 반응
3. 이모지를 적절히 사용 (과하지 않게)
4. "다음에는 ○○도 드셨으면 좋겠어요" 같은 부드러운 추천
5. "언제든 편하게 방문해주세요" 같은 따뜻한 마무리
6. 고객과의 인간적인 연결 강조

**톤앤매너:**
- 친근하지만 예의 바른 존댓말
- 따뜻하고 부드러운 표현
- 이모지 2-3개 정도 자연스럽게 사용
- 고객을 진심으로 환영하는 느낌

**답글 길이:** 150-250자 내외`,
  };

  const systemPrompt = stylePrompts[replyStyle] || stylePrompts.promo;

  let userPrompt = `[고객 리뷰]
${reviewText}

${placeInfo ? `[식당 정보]
- 이름: ${placeInfo.name || ''}
- 업종: ${placeInfo.category || ''}
- 주소: ${placeInfo.address || ''}
- 전화: ${placeInfo.phone || ''}
- 메뉴: ${placeInfo.menuItems?.map(m => `${m.name} (${m.price || ''})`).join(', ') || '정보 없음'}
` : ''}

${ownerTips ? `[사장님 추천 포인트]
${ownerTips}
` : ''}
${promotionPrompt}
${selectedPromoPoints && selectedPromoPoints.length > 0 ? `[선택된 홍보 포인트] (답글에 자연스럽게 포함해주세요)
${selectedPromoPoints.map((p, i) => `${i + 1}. ${p}`).join('\n')}
` : ''}

위 정보를 바탕으로 ${replyStyle === 'promo' ? '홍보형' : replyStyle === 'professional' ? '전문가형' : '친근형'} 스타일의 답글을 작성해주세요.

**중요:**
- 리뷰 작성자뿐만 아니라 이 답글을 읽는 잠재 고객들을 위해 유용한 정보를 담아주세요
- 자연스럽고 진심 어린 답글로 작성해주세요
- 답글만 출력하고, 다른 설명은 하지 마세요`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    temperature: 0.7,
  });

  const reply = response.choices[0]?.message?.content || '';
  return reply.trim();
}

