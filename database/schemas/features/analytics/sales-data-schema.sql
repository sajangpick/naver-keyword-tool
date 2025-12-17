-- ============================================
-- 매출 데이터 테이블 (고객 개인정보 암호화 적용)
-- ============================================

-- sales_data 테이블 생성
CREATE TABLE IF NOT EXISTS sales_data (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- 매출 정보
    sale_date DATE NOT NULL,
    sale_amount DECIMAL(12, 2) NOT NULL,
    payment_method VARCHAR(50), -- 'card', 'cash', 'transfer' 등
    menu_items JSONB, -- 주문 메뉴 정보
    
    -- 고객 정보 (암호화 저장)
    customer_phone_encrypted TEXT, -- 암호화된 전화번호 (예: "gAAAAABk...")
    customer_name VARCHAR(100), -- 고객 이름 (선택사항)
    customer_memo TEXT, -- 고객 메모 (선택사항)
    
    -- 메타데이터
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- 인덱스
    CONSTRAINT valid_sale_amount CHECK (sale_amount >= 0)
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_sales_data_user_id ON sales_data(user_id);
CREATE INDEX IF NOT EXISTS idx_sales_data_sale_date ON sales_data(sale_date DESC);
CREATE INDEX IF NOT EXISTS idx_sales_data_user_date ON sales_data(user_id, sale_date DESC);

-- 코멘트 추가
COMMENT ON TABLE sales_data IS '매출 데이터 (고객 전화번호는 암호화되어 저장됨)';
COMMENT ON COLUMN sales_data.customer_phone_encrypted IS '암호화된 고객 전화번호 (CipherService로 암호화/복호화)';
COMMENT ON COLUMN sales_data.customer_name IS '고객 이름 (선택사항)';
COMMENT ON COLUMN sales_data.menu_items IS '주문 메뉴 정보 (JSON 배열)';

-- RLS (Row Level Security) 정책
ALTER TABLE sales_data ENABLE ROW LEVEL SECURITY;

-- 기존 정책 삭제 (있으면)
DROP POLICY IF EXISTS "Users can view own sales data" ON sales_data;
DROP POLICY IF EXISTS "Users can insert own sales data" ON sales_data;
DROP POLICY IF EXISTS "Users can update own sales data" ON sales_data;
DROP POLICY IF EXISTS "Users can delete own sales data" ON sales_data;

-- 사용자는 자신의 데이터만 조회/수정 가능
CREATE POLICY "Users can view own sales data"
    ON sales_data FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sales data"
    ON sales_data FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sales data"
    ON sales_data FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own sales data"
    ON sales_data FOR DELETE
    USING (auth.uid() = user_id);

