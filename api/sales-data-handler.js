// ============================================
// 매출 데이터 API 핸들러
// ============================================

const { createClient } = require('@supabase/supabase-js');
const cipher = require('../lib/cipher-service');

// Supabase 클라이언트 초기화
let supabase = null;
try {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  
  if (supabaseUrl && supabaseKey) {
    supabase = createClient(supabaseUrl, supabaseKey);
  }
} catch (error) {
  console.error('❌ Supabase 초기화 실패:', error);
}

module.exports = async (req, res) => {
  // CORS 헤더 설정
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (!supabase) {
    return res.status(500).json({
      success: false,
      error: 'Database connection not configured'
    });
  }

  try {
    // 사용자 인증 확인
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: '인증이 필요합니다.'
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({
        success: false,
        error: '인증에 실패했습니다.'
      });
    }

    const userId = user.id;

    // POST: 매출 데이터 저장
    if (req.method === 'POST') {
      const { saleDate, saleAmount, paymentMethod, customerMemo, customerPhone, customerName } = req.body;

      if (!saleDate || !saleAmount || saleAmount <= 0) {
        return res.status(400).json({
          success: false,
          error: '날짜와 매출액은 필수입니다.'
        });
      }

      // 전화번호 암호화
      let encryptedPhone = null;
      if (customerPhone) {
        try {
          encryptedPhone = cipher.encrypt(customerPhone);
        } catch (err) {
          console.error('전화번호 암호화 실패:', err);
        }
      }

      const { data, error } = await supabase
        .from('sales_data')
        .insert({
          user_id: userId,
          sale_date: saleDate,
          sale_amount: saleAmount,
          payment_method: paymentMethod || 'cash',
          customer_phone_encrypted: encryptedPhone,
          customer_name: customerName || null,
          customer_memo: customerMemo || null
        })
        .select()
        .single();

      if (error) {
        console.error('매출 데이터 저장 실패:', error);
        return res.status(500).json({
          success: false,
          error: '매출 데이터 저장에 실패했습니다: ' + error.message
        });
      }

      return res.status(200).json({
        success: true,
        data: data
      });
    }

    // GET: 매출 데이터 조회
    if (req.method === 'GET') {
      const { startDate, endDate, limit = 100, offset = 0 } = req.query;

      let query = supabase
        .from('sales_data')
        .select('*')
        .eq('user_id', userId)
        .order('sale_date', { ascending: false })
        .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

      if (startDate) {
        query = query.gte('sale_date', startDate);
      }
      if (endDate) {
        query = query.lte('sale_date', endDate);
      }

      const { data, error } = await query;

      if (error) {
        console.error('매출 데이터 조회 실패:', error);
        return res.status(500).json({
          success: false,
          error: '매출 데이터 조회에 실패했습니다: ' + error.message
        });
      }

      // 전화번호 복호화 (필요시)
      const decryptedData = data.map(item => {
        const result = { ...item };
        if (item.customer_phone_encrypted) {
          try {
            result.customer_phone = cipher.decrypt(item.customer_phone_encrypted);
          } catch (err) {
            console.error('전화번호 복호화 실패:', err);
            result.customer_phone = null;
          }
        }
        return result;
      });

      return res.status(200).json({
        success: true,
        data: decryptedData
      });
    }

    // PUT: 매출 데이터 수정
    if (req.method === 'PUT') {
      const { id } = req.params;
      const { saleDate, saleAmount, paymentMethod, customerMemo, customerPhone, customerName } = req.body;

      const updateData = {
        updated_at: new Date().toISOString()
      };

      if (saleDate) updateData.sale_date = saleDate;
      if (saleAmount !== undefined) updateData.sale_amount = saleAmount;
      if (paymentMethod) updateData.payment_method = paymentMethod;
      if (customerMemo !== undefined) updateData.customer_memo = customerMemo;
      if (customerName !== undefined) updateData.customer_name = customerName;

      // 전화번호 암호화
      if (customerPhone !== undefined) {
        if (customerPhone) {
          try {
            updateData.customer_phone_encrypted = cipher.encrypt(customerPhone);
          } catch (err) {
            console.error('전화번호 암호화 실패:', err);
          }
        } else {
          updateData.customer_phone_encrypted = null;
        }
      }

      const { data, error } = await supabase
        .from('sales_data')
        .update(updateData)
        .eq('id', id)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        console.error('매출 데이터 수정 실패:', error);
        return res.status(500).json({
          success: false,
          error: '매출 데이터 수정에 실패했습니다: ' + error.message
        });
      }

      return res.status(200).json({
        success: true,
        data: data
      });
    }

    // DELETE: 매출 데이터 삭제
    if (req.method === 'DELETE') {
      const { id } = req.params;

      const { error } = await supabase
        .from('sales_data')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);

      if (error) {
        console.error('매출 데이터 삭제 실패:', error);
        return res.status(500).json({
          success: false,
          error: '매출 데이터 삭제에 실패했습니다: ' + error.message
        });
      }

      return res.status(200).json({
        success: true
      });
    }

    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    });
  } catch (error) {
    console.error('❌ 매출 데이터 API 오류:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
};

