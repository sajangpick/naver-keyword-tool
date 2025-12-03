/**
 * 카드 등록/조회/삭제 API
 * 사용자가 등록한 카드 정보를 관리합니다
 */

const { createClient } = require('@supabase/supabase-js');

// Supabase 클라이언트 초기화
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

let supabase = null;
if (SUPABASE_URL && SUPABASE_KEY && SUPABASE_URL.trim() !== '' && SUPABASE_KEY.trim() !== '') {
  try {
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  } catch (error) {
    console.error('Supabase 클라이언트 초기화 실패:', error.message);
  }
}

module.exports = async (req, res) => {
  // CORS 설정
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST,DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    // 인증 확인
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: '인증이 필요합니다'
      });
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Supabase 클라이언트로 사용자 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return res.status(401).json({
        success: false,
        error: '유효하지 않은 인증 토큰입니다'
      });
    }

    const userId = user.id;

    // GET: 등록된 카드 목록 조회
    if (req.method === 'GET') {
      const { data: cards, error } = await supabase
        .from('user_billing')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) {
        // 테이블이 없을 수 있음
        if (error.code === '42P01') {
          return res.json({
            success: true,
            cards: [],
            message: '카드 등록 기능을 사용하려면 데이터베이스 테이블을 생성해주세요.'
          });
        }
        throw error;
      }

      return res.json({
        success: true,
        cards: cards || []
      });
    }

    // POST: 카드 등록
    if (req.method === 'POST') {
      const { card_alias, card_number, card_expiry, card_cvc, card_password, is_default } = req.body;

      if (!card_alias || !card_number) {
        return res.status(400).json({
          success: false,
          error: '카드 별칭과 카드번호는 필수입니다'
        });
      }

      // 카드번호 마스킹 (뒤 4자리만 표시)
      const maskedCardNumber = card_number.replace(/\d(?=\d{4})/g, '*');
      const maskedParts = maskedCardNumber.match(/.{1,4}/g);
      const formattedCardNumber = maskedParts ? maskedParts.join('-') : maskedCardNumber;

      // 카드사 추정 (간단한 로직)
      const cardCompany = detectCardCompany(card_number);

      // 기본 카드로 설정하는 경우, 기존 기본 카드 해제
      if (is_default) {
        await supabase
          .from('user_billing')
          .update({ is_default: false })
          .eq('user_id', userId)
          .eq('is_default', true);
      }

      // 카드 정보 저장
      // 실제로는 PG사 API를 통해 빌링키를 발급받아야 하지만, 여기서는 간단히 저장만 함
      const { data: newCard, error: insertError } = await supabase
        .from('user_billing')
        .insert({
          user_id: userId,
          card_number: formattedCardNumber,
          card_company: cardCompany,
          card_alias: card_alias,
          is_default: is_default || false,
          is_active: true,
          // 실제로는 PG사에서 발급받은 billing_key를 저장해야 함
          billing_key: null,
          customer_key: userId
        })
        .select()
        .single();

      if (insertError) {
        // 테이블이 없을 수 있음
        if (insertError.code === '42P01') {
          return res.status(400).json({
            success: false,
            error: '카드 등록 기능을 사용하려면 데이터베이스 테이블을 생성해주세요. database/schemas/features/payment/user-billing.sql 파일을 실행하세요.'
          });
        }
        throw insertError;
      }

      console.log('✅ 카드 등록 완료:', newCard.id);

      return res.json({
        success: true,
        card: newCard,
        message: '카드가 등록되었습니다'
      });
    }

    return res.status(405).json({
      success: false,
      error: '허용되지 않은 메소드입니다'
    });

  } catch (error) {
    console.error('❌ 카드 API 오류:', error);
    return res.status(500).json({
      success: false,
      error: error.message || '카드 처리 중 오류가 발생했습니다'
    });
  }
};

// 카드 삭제 핸들러 (별도 함수로 export)
async function deleteCard(req, res) {
  // CORS 설정
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    // 인증 확인
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: '인증이 필요합니다'
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return res.status(401).json({
        success: false,
        error: '유효하지 않은 인증 토큰입니다'
      });
    }

    const userId = user.id;
    // URL에서 카드 ID 추출 (Express의 req.params 사용)
    const cardId = req.params?.cardId || req.url.split('/').pop();

    if (!cardId) {
      return res.status(400).json({
        success: false,
        error: '카드 ID가 필요합니다'
      });
    }

    // 카드 소유자 확인
    const { data: card, error: fetchError } = await supabase
      .from('user_billing')
      .select('*')
      .eq('id', cardId)
      .eq('user_id', userId)
      .single();

    if (fetchError || !card) {
      return res.status(404).json({
        success: false,
        error: '카드를 찾을 수 없습니다'
      });
    }

    // 카드 삭제 (실제로는 is_active를 false로 변경)
    const { error: deleteError } = await supabase
      .from('user_billing')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', cardId)
      .eq('user_id', userId);

    if (deleteError) {
      throw deleteError;
    }

    console.log('✅ 카드 삭제 완료:', cardId);

    return res.json({
      success: true,
      message: '카드가 삭제되었습니다'
    });

  } catch (error) {
    console.error('❌ 카드 삭제 오류:', error);
    return res.status(500).json({
      success: false,
      error: error.message || '카드 삭제 중 오류가 발생했습니다'
    });
  }
};

// 카드사 감지 함수
function detectCardCompany(cardNumber) {
  const firstDigit = cardNumber.charAt(0);
  const firstTwoDigits = cardNumber.substring(0, 2);
  
  // 간단한 카드사 감지 로직
  if (firstDigit === '4') return 'VISA';
  if (firstTwoDigits === '51' || firstTwoDigits === '52' || firstTwoDigits === '53' || 
      firstTwoDigits === '54' || firstTwoDigits === '55') return '마스터카드';
  if (firstTwoDigits === '35') return 'JCB';
  if (firstTwoDigits === '30' || firstTwoDigits === '36' || firstTwoDigits === '38') return '다이너스클럽';
  if (firstTwoDigits === '34' || firstTwoDigits === '37') return '아메리칸익스프레스';
  
  // 한국 카드사 (간단한 추정)
  if (firstTwoDigits === '94' || firstTwoDigits === '96') return '신한카드';
  if (firstTwoDigits === '95') return 'KB카드';
  if (firstTwoDigits === '92' || firstTwoDigits === '93') return '하나카드';
  if (firstTwoDigits === '88') return '삼성카드';
  if (firstTwoDigits === '90' || firstTwoDigits === '91') return 'NH카드';
  
  return '기타';
}

// 카드 삭제 함수 export
module.exports.delete = deleteCard;
