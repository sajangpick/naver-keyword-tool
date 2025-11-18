-- ================================================================
-- 정책지원금 샘플 데이터
-- ================================================================

-- 샘플 1: 소상공인 경영개선 자금
INSERT INTO policy_supports (
    title, 
    organization, 
    category, 
    summary, 
    description,
    support_amount, 
    support_type, 
    eligibility_criteria,
    business_type, 
    target_area, 
    application_start_date, 
    application_end_date,
    application_url,
    contact_info,
    phone_number,
    status,
    is_featured
) VALUES (
    '2025년 소상공인 경영개선 자금 지원',
    '중소벤처기업부',
    'operation',
    '코로나19 이후 경영 정상화를 위한 소상공인 대상 운영자금 지원',
    '소상공인의 경영 안정과 성장을 위한 정책자금을 지원합니다. 시설개선, 운영자금, 디지털 전환 등 다양한 용도로 사용 가능하며, 저금리 대출 혜택을 제공합니다.',
    '최대 7,000만원',
    'loan',
    '• 사업자등록 후 6개월 이상 영업 중인 소상공인
• 연매출 10억원 이하
• 신용등급 6등급 이상
• 제조업, 건설업, 운수업, 서비스업 등',
    ARRAY['음식점', '카페', '소매업', '서비스업', '제조업'],
    ARRAY['전국'],
    '2025-01-01',
    '2025-12-31',
    'https://www.sbiz.or.kr',
    '소상공인시장진흥공단',
    '☎1357',
    'active',
    true
);

-- 샘플 2: 착한가격업소 인센티브
INSERT INTO policy_supports (
    title,
    organization,
    category,
    summary,
    description,
    support_amount,
    support_type,
    eligibility_criteria,
    business_type,
    target_area,
    application_start_date,
    application_end_date,
    application_url,
    contact_info,
    phone_number,
    status
) VALUES (
    '착한가격업소 인센티브 지원 사업',
    '행정안전부',
    'operation',
    '물가안정에 기여하는 착한가격업소 대상 다양한 인센티브 제공',
    '착한가격업소로 지정된 업소에 대해 상하수도료 감면, 쓰레기봉투 지원, 시설개선 자금 지원 등 다양한 혜택을 제공합니다. 지자체별로 지원 내용이 상이할 수 있습니다.',
    '연간 최대 200만원 상당',
    'grant',
    '• 착한가격업소로 지정된 업체
• 가격 안정 유지 업소
• 위생등급 양호 이상',
    ARRAY['음식점', '이미용업', '세탁업', '목욕업'],
    ARRAY['전국'],
    '2025-01-01',
    '2025-11-30',
    'https://www.goodprice.go.kr',
    '지자체 경제정책과',
    '☎120',
    'active',
    false
);

-- 샘플 3: 소상공인 디지털 전환 바우처
INSERT INTO policy_supports (
    title,
    organization,
    category,
    summary,
    description,
    support_amount,
    support_type,
    eligibility_criteria,
    business_type,
    target_area,
    application_start_date,
    application_end_date,
    application_url,
    contact_info,
    phone_number,
    status,
    is_featured
) VALUES (
    '소상공인 디지털 전환 바우처 지원',
    '과학기술정보통신부',
    'marketing',
    '온라인 마케팅 및 디지털 전환 비용 지원',
    '키오스크 도입, 온라인 주문시스템 구축, 배달앱 입점, SNS 마케팅, 온라인몰 구축 등 디지털 전환에 필요한 비용을 바우처로 지원합니다.',
    '최대 400만원',
    'voucher',
    '• 소상공인 (상시근로자 10인 미만)
• 연매출 3억원 이하
• 오프라인 매장 운영 업체
• 디지털 전환 계획 보유',
    ARRAY['음식점', '카페', '소매업', '미용업'],
    ARRAY['서울', '경기', '인천', '부산', '대구', '광주', '대전'],
    '2025-02-01',
    '2025-03-31',
    'https://www.digital-voucher.kr',
    '디지털전환지원센터',
    '☎1899-2024',
    'upcoming',
    true
);

-- 샘플 4: 청년 창업 지원금
INSERT INTO policy_supports (
    title,
    organization,
    category,
    summary,
    description,
    support_amount,
    support_type,
    eligibility_criteria,
    business_type,
    target_area,
    application_start_date,
    application_end_date,
    application_url,
    contact_info,
    phone_number,
    status
) VALUES (
    '청년 외식창업 지원사업',
    '농림축산식품부',
    'startup',
    '만 39세 이하 청년의 외식업 창업 지원',
    '청년들의 외식업 창업을 지원하기 위한 창업자금 및 컨설팅을 제공합니다. 창업 교육, 멘토링, 마케팅 지원 등 종합적인 창업 지원 프로그램입니다.',
    '최대 1억원',
    'grant',
    '• 만 19세~39세 청년
• 외식업 창업 예정자 또는 창업 1년 미만
• 창업 교육 이수자
• 사업계획서 평가 통과자',
    ARRAY['음식점', '카페', '베이커리', '주점'],
    ARRAY['전국'],
    '2025-03-01',
    '2025-04-30',
    'https://www.youthstartup.kr',
    '한국농수산식품유통공사',
    '☎1666-0982',
    'upcoming',
    false
);

-- 샘플 5: 전통시장 상인 지원
INSERT INTO policy_supports (
    title,
    organization,
    category,
    summary,
    description,
    support_amount,
    support_type,
    eligibility_criteria,
    business_type,
    target_area,
    application_start_date,
    application_end_date,
    application_url,
    contact_info,
    phone_number,
    status
) VALUES (
    '전통시장 시설현대화 지원사업',
    '중소벤처기업부',
    'facility',
    '전통시장 내 점포 시설 개선 지원',
    '전통시장 활성화를 위해 노후화된 점포 시설 개선, 간판 교체, 진열대 설치 등을 지원합니다. 시장 전체의 환경 개선과 고객 편의 증진을 목표로 합니다.',
    '점포당 최대 1,000만원',
    'grant',
    '• 전통시장 내 영업 중인 상인
• 영업신고 완료 점포
• 시장상인회 회원',
    ARRAY['음식점', '소매업', '도매업'],
    ARRAY['전국'],
    '2025-01-15',
    '2025-12-15',
    'https://www.sbiz.or.kr/market',
    '소상공인시장진흥공단',
    '☎1357',
    'active',
    false
);

-- 샘플 6: 인건비 지원
INSERT INTO policy_supports (
    title,
    organization,
    category,
    summary,
    description,
    support_amount,
    support_type,
    eligibility_criteria,
    business_type,
    target_area,
    application_start_date,
    application_end_date,
    application_url,
    contact_info,
    phone_number,
    status
) VALUES (
    '일자리 안정자금 지원',
    '고용노동부',
    'employment',
    '최저임금 인상에 따른 소상공인 인건비 부담 완화',
    '30인 미만 사업체의 월 평균보수 230만원 미만 노동자에 대한 인건비를 지원합니다. 사업주의 경영부담을 완화하고 노동자의 고용안정을 도모합니다.',
    '1인당 월 최대 30만원',
    'grant',
    '• 30인 미만 사업체
• 최저임금 120% 미만 노동자 고용
• 고용보험 가입
• 체불임금 없음',
    ARRAY['음식점', '카페', '소매업', '서비스업', '제조업'],
    ARRAY['전국'],
    '2025-01-01',
    '2025-12-31',
    'https://www.jobfunds.or.kr',
    '근로복지공단',
    '☎1588-0075',
    'active',
    true
);

-- 샘플 7: 소상공인 교육 지원
INSERT INTO policy_supports (
    title,
    organization,
    category,
    summary,
    description,
    support_amount,
    support_type,
    eligibility_criteria,
    business_type,
    target_area,
    application_start_date,
    application_end_date,
    application_url,
    contact_info,
    phone_number,
    status
) VALUES (
    '소상공인 역량강화 교육',
    '중소벤처기업부',
    'education',
    '경영 역량 강화를 위한 무료 교육 제공',
    '마케팅, 세무회계, SNS 활용, 고객관리 등 소상공인에게 필요한 실무 교육을 무료로 제공합니다. 온라인과 오프라인 교육을 선택할 수 있습니다.',
    '전액 무료',
    'other',
    '• 소상공인 및 예비창업자
• 사업자등록증 보유자 우선',
    ARRAY['음식점', '카페', '소매업', '서비스업'],
    ARRAY['전국'],
    '2025-01-01',
    '2025-12-31',
    'https://www.semas.or.kr/edu',
    '소상공인시장진흥공단 교육팀',
    '☎1588-5302',
    'active',
    false
);

-- 샘플 8: 코로나 피해 지원
INSERT INTO policy_supports (
    title,
    organization,
    category,
    summary,
    description,
    support_amount,
    support_type,
    eligibility_criteria,
    business_type,
    target_area,
    application_start_date,
    application_end_date,
    application_url,
    contact_info,
    phone_number,
    status
) VALUES (
    '소상공인 손실보전금 지급',
    '중소벤처기업부',
    'operation',
    '집합금지·영업제한 조치로 인한 손실 보전',
    '방역조치로 인해 피해를 입은 소상공인에게 손실보전금을 지급합니다. 매출 감소율과 업종에 따라 차등 지급됩니다.',
    '100만원~500만원',
    'grant',
    '• 집합금지·영업제한 대상 업종
• 2024년 대비 매출 감소 업체
• 사업자등록 유지',
    ARRAY['음식점', '카페', '주점', 'PC방', '노래방'],
    ARRAY['전국'],
    '2025-01-10',
    '2025-02-28',
    'https://www.손실보전금.kr',
    '손실보전금 콜센터',
    '☎1899-1082',
    'active',
    true
);

-- 통계 업데이트를 위한 더미 조회수 추가
UPDATE policy_supports 
SET view_count = FLOOR(RANDOM() * 1000) + 100
WHERE view_count = 0;

-- 일부 정책을 마감 처리 (테스트용)
UPDATE policy_supports 
SET status = 'ended', application_end_date = '2024-12-31'
WHERE title LIKE '%교육%' 
LIMIT 1;
