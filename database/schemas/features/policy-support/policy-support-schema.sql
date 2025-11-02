-- ================================================================
-- 정책지원금 시스템 테이블 구조
-- ================================================================
-- 소상공인을 위한 정책지원금 정보 관리 시스템
-- Created: 2025-11-01
-- ================================================================

-- 정책지원금 정보 테이블
CREATE TABLE IF NOT EXISTS policy_supports (
    id BIGSERIAL PRIMARY KEY,
    
    -- 기본 정보
    title VARCHAR(255) NOT NULL,                -- 지원금 제목
    organization VARCHAR(100) NOT NULL,         -- 지원 기관 (예: 중소벤처기업부, 지자체)
    category VARCHAR(50) NOT NULL,              -- 카테고리 (창업지원, 운영지원, 인건비지원 등)
    
    -- 지원 내용
    summary TEXT NOT NULL,                      -- 간단 설명
    description TEXT NOT NULL,                  -- 상세 설명
    support_amount VARCHAR(100),                -- 지원 금액 (예: "최대 5000만원")
    support_type VARCHAR(50),                   -- 지원 유형 (보조금, 대출, 세제혜택 등)
    
    -- 자격 요건
    eligibility_criteria TEXT NOT NULL,         -- 지원 자격
    required_documents TEXT,                    -- 필요 서류
    business_type TEXT[],                       -- 대상 업종 (음식점, 카페, 소매업 등)
    target_area TEXT[],                        -- 지원 지역 (전국, 특정 시도)
    
    -- 신청 정보
    application_start_date DATE,                -- 신청 시작일
    application_end_date DATE,                  -- 신청 마감일
    application_method TEXT,                    -- 신청 방법
    application_url VARCHAR(500),               -- 온라인 신청 링크
    
    -- 연락처
    contact_info TEXT,                          -- 문의처 정보
    phone_number VARCHAR(50),                   -- 전화번호
    website_url VARCHAR(500),                   -- 관련 웹사이트
    
    -- 메타 정보
    status VARCHAR(20) DEFAULT 'active',        -- 상태 (active, upcoming, ended)
    is_featured BOOLEAN DEFAULT false,          -- 중요 공지 여부
    view_count INTEGER DEFAULT 0,               -- 조회수
    tags TEXT[],                                -- 태그 (검색용)
    
    -- 시스템 필드
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    
    -- 인덱스 힌트
    CONSTRAINT policy_supports_category_check 
        CHECK (category IN ('startup', 'operation', 'employment', 'facility', 'marketing', 'education', 'other')),
    CONSTRAINT policy_supports_support_type_check 
        CHECK (support_type IN ('grant', 'loan', 'tax_benefit', 'voucher', 'consulting', 'other')),
    CONSTRAINT policy_supports_status_check 
        CHECK (status IN ('active', 'upcoming', 'ended'))
);

-- 사용자별 정책지원금 저장/관심 표시
CREATE TABLE IF NOT EXISTS user_policy_interests (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    policy_id BIGINT NOT NULL REFERENCES policy_supports(id) ON DELETE CASCADE,
    is_bookmarked BOOLEAN DEFAULT false,        -- 즐겨찾기 여부
    is_applied BOOLEAN DEFAULT false,           -- 신청 완료 여부
    applied_date DATE,                          -- 신청일
    notes TEXT,                                 -- 개인 메모
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(user_id, policy_id)
);

-- 정책지원금 알림 설정
CREATE TABLE IF NOT EXISTS policy_notifications (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    categories TEXT[],                          -- 관심 카테고리
    business_types TEXT[],                      -- 관심 업종
    areas TEXT[],                               -- 관심 지역
    min_amount INTEGER,                         -- 최소 지원 금액
    notification_enabled BOOLEAN DEFAULT true,   -- 알림 활성화
    notification_method VARCHAR(20) DEFAULT 'email', -- 알림 방법
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(user_id)
);

-- 인덱스 생성
CREATE INDEX idx_policy_supports_category ON policy_supports(category);
CREATE INDEX idx_policy_supports_status ON policy_supports(status);
CREATE INDEX idx_policy_supports_dates ON policy_supports(application_start_date, application_end_date);
CREATE INDEX idx_policy_supports_target_area ON policy_supports USING GIN(target_area);
CREATE INDEX idx_policy_supports_business_type ON policy_supports USING GIN(business_type);
CREATE INDEX idx_policy_supports_tags ON policy_supports USING GIN(tags);
CREATE INDEX idx_user_policy_interests_user ON user_policy_interests(user_id);
CREATE INDEX idx_user_policy_interests_policy ON user_policy_interests(policy_id);

-- 트리거: updated_at 자동 업데이트
CREATE OR REPLACE FUNCTION update_policy_supports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER policy_supports_updated_at_trigger
    BEFORE UPDATE ON policy_supports
    FOR EACH ROW
    EXECUTE FUNCTION update_policy_supports_updated_at();

CREATE TRIGGER user_policy_interests_updated_at_trigger
    BEFORE UPDATE ON user_policy_interests
    FOR EACH ROW
    EXECUTE FUNCTION update_policy_supports_updated_at();

-- RLS (Row Level Security) 정책
ALTER TABLE policy_supports ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_policy_interests ENABLE ROW LEVEL SECURITY;
ALTER TABLE policy_notifications ENABLE ROW LEVEL SECURITY;

-- 정책지원금 조회는 모든 사용자 가능
CREATE POLICY "Public can view active policy supports"
    ON policy_supports FOR SELECT
    USING (status = 'active' OR status = 'upcoming');

-- 관리자만 정책지원금 생성/수정/삭제 가능
CREATE POLICY "Admins can manage policy supports"
    ON policy_supports FOR ALL
    USING (auth.uid() IN (
        SELECT id FROM auth.users 
        WHERE email IN ('admin@example.com') -- 관리자 이메일 목록
    ));

-- 사용자는 자신의 관심 정책만 관리 가능
CREATE POLICY "Users can manage own interests"
    ON user_policy_interests FOR ALL
    USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own notifications"
    ON policy_notifications FOR ALL
    USING (auth.uid() = user_id);

-- 샘플 데이터 (선택사항)
/*
INSERT INTO policy_supports (
    title, organization, category, summary, description,
    support_amount, support_type, eligibility_criteria,
    business_type, target_area, application_start_date, application_end_date,
    application_url, contact_info, status
) VALUES
(
    '2025년 소상공인 경영개선 자금',
    '중소벤처기업부',
    'operation',
    '코로나19 이후 경영 정상화를 위한 소상공인 지원',
    '소상공인의 경영 안정과 성장을 위한 정책자금 지원. 시설개선, 운영자금, 디지털 전환 등 다양한 용도로 사용 가능합니다.',
    '최대 7,000만원',
    'loan',
    '- 사업자등록 후 6개월 이상 영업 중인 소상공인\n- 연매출 10억원 이하\n- 신용등급 6등급 이상',
    ARRAY['음식점', '카페', '소매업', '서비스업'],
    ARRAY['전국'],
    '2025-01-01',
    '2025-12-31',
    'https://www.sbiz.or.kr',
    '소상공인시장진흥공단 ☎1357',
    'active'
),
(
    '착한가격업소 인센티브 지원',
    '진안군청',
    'operation',
    '착한가격업소로 지정된 업소에 대한 인센티브 지원',
    '물가안정에 기여하는 착한가격업소에 대해 상하수도료 감면, 쓰레기봉투 지원 등 다양한 인센티브를 제공합니다.',
    '연간 최대 100만원 상당',
    'grant',
    '- 진안군 소재 착한가격업소로 지정된 업체\n- 가격 안정 유지 업소',
    ARRAY['음식점', '이미용업', '세탁업'],
    ARRAY['전북 진안군'],
    '2025-01-01',
    '2025-11-30',
    'https://www.jinan.go.kr',
    '진안군청 경제정책과 ☎063-430-2345',
    'active'
);
*/

COMMENT ON TABLE policy_supports IS '정책지원금 정보 테이블';
COMMENT ON TABLE user_policy_interests IS '사용자별 정책지원금 관심/신청 정보';
COMMENT ON TABLE policy_notifications IS '정책지원금 알림 설정';
