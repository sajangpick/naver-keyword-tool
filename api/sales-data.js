/**
 * 매출 데이터 API
 * 전화번호 암호화/복호화 기능 포함
 */

require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");
const { encryptPhoneNumber, decryptPhoneNumber } = require("./utils/cipher");

// Supabase 클라이언트 초기화
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("⚠️ Supabase 환경변수가 설정되지 않았습니다.");
}

const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

/**
 * 매출 데이터 저장 (전화번호 자동 암호화)
 */
async function saveSalesData(userId, salesData) {
  try {
    // 전화번호가 있으면 암호화
    let encryptedPhone = null;
    if (salesData.customerPhone) {
      encryptedPhone = await encryptPhoneNumber(salesData.customerPhone);
    }

    // 데이터베이스에 저장
    const { data, error } = await supabase
      .from("sales_data")
      .insert({
        user_id: userId,
        sale_date: salesData.saleDate,
        sale_amount: salesData.saleAmount,
        payment_method: salesData.paymentMethod,
        menu_items: salesData.menuItems || null,
        customer_phone_encrypted: encryptedPhone,
        customer_name: salesData.customerName || null,
        customer_memo: salesData.customerMemo || null,
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return {
      success: true,
      data: {
        ...data,
        // 복호화된 전화번호는 반환하지 않음 (보안)
        customerPhone: undefined,
      },
    };
  } catch (error) {
    console.error("매출 데이터 저장 실패:", error);
    throw error;
  }
}

/**
 * 매출 데이터 조회 (전화번호 자동 복호화)
 */
async function getSalesData(userId, options = {}) {
  try {
    let query = supabase
      .from("sales_data")
      .select("*")
      .eq("user_id", userId)
      .order("sale_date", { ascending: false });

    // 날짜 필터
    if (options.startDate) {
      query = query.gte("sale_date", options.startDate);
    }
    if (options.endDate) {
      query = query.lte("sale_date", options.endDate);
    }

    // 페이지네이션
    if (options.limit) {
      query = query.limit(options.limit);
    }
    if (options.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 100) - 1);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    // 전화번호 복호화
    const decryptedData = await Promise.all(
      data.map(async (item) => {
        let decryptedPhone = null;
        if (item.customer_phone_encrypted) {
          try {
            decryptedPhone = await decryptPhoneNumber(item.customer_phone_encrypted);
          } catch (error) {
            console.error("전화번호 복호화 실패:", error);
            decryptedPhone = "[복호화 실패]";
          }
        }

        return {
          ...item,
          customerPhone: decryptedPhone,
          customerPhoneEncrypted: item.customer_phone_encrypted, // 원본도 유지 (디버깅용)
        };
      })
    );

    return {
      success: true,
      data: decryptedData,
    };
  } catch (error) {
    console.error("매출 데이터 조회 실패:", error);
    throw error;
  }
}

/**
 * 매출 데이터 업데이트 (전화번호 자동 암호화)
 */
async function updateSalesData(userId, salesId, updateData) {
  try {
    // 전화번호가 있으면 암호화
    const updateFields = { ...updateData };
    if (updateFields.customerPhone !== undefined) {
      if (updateFields.customerPhone) {
        updateFields.customer_phone_encrypted = await encryptPhoneNumber(updateFields.customerPhone);
      } else {
        updateFields.customer_phone_encrypted = null;
      }
      delete updateFields.customerPhone; // 원본 전화번호는 제거
    }

    updateFields.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from("sales_data")
      .update(updateFields)
      .eq("id", salesId)
      .eq("user_id", userId) // 본인 데이터만 수정 가능
      .select()
      .single();

    if (error) {
      throw error;
    }

    // 복호화된 전화번호 추가
    let decryptedPhone = null;
    if (data.customer_phone_encrypted) {
      try {
        decryptedPhone = await decryptPhoneNumber(data.customer_phone_encrypted);
      } catch (error) {
        console.error("전화번호 복호화 실패:", error);
      }
    }

    return {
      success: true,
      data: {
        ...data,
        customerPhone: decryptedPhone,
      },
    };
  } catch (error) {
    console.error("매출 데이터 업데이트 실패:", error);
    throw error;
  }
}

/**
 * 매출 데이터 삭제
 */
async function deleteSalesData(userId, salesId) {
  try {
    const { error } = await supabase
      .from("sales_data")
      .delete()
      .eq("id", salesId)
      .eq("user_id", userId); // 본인 데이터만 삭제 가능

    if (error) {
      throw error;
    }

    return {
      success: true,
    };
  } catch (error) {
    console.error("매출 데이터 삭제 실패:", error);
    throw error;
  }
}

module.exports = {
  saveSalesData,
  getSalesData,
  updateSalesData,
  deleteSalesData,
};

