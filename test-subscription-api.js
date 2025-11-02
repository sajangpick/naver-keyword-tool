/**
 * 구독 API 테스트 스크립트
 * 실행: node test-subscription-api.js
 */

const fetch = require('node-fetch');

const API_BASE_URL = process.env.API_BASE_URL || 'https://sajangpick-kwon-teamjang.onrender.com'; // 프로덕션 API URL

async function testAPIs() {
  console.log('🚀 구독 API 테스트 시작...\n');

  // 1. 가격 설정 API 테스트
  console.log('1️⃣ 가격 설정 API 테스트...');
  try {
    const pricingResponse = await fetch(`${API_BASE_URL}/api/subscription/pricing-config`);
    const pricingData = await pricingResponse.json();
    
    if (pricingData.success) {
      console.log('✅ 가격 설정 API 성공');
      console.log('데이터:', JSON.stringify(pricingData.pricing, null, 2));
    } else {
      console.error('❌ 가격 설정 API 실패:', pricingData.error);
    }
  } catch (error) {
    console.error('❌ 가격 설정 API 에러:', error.message);
    console.error('서버가 실행 중인지 확인하세요 (포트 3003)');
  }
  
  console.log('\n---\n');

  // 2. 토큰 설정 API 테스트
  console.log('2️⃣ 토큰 설정 API 테스트...');
  try {
    const tokenResponse = await fetch(`${API_BASE_URL}/api/subscription/token-config`);
    const tokenData = await tokenResponse.json();
    
    if (tokenData.success) {
      console.log('✅ 토큰 설정 API 성공');
      console.log('데이터:', JSON.stringify(tokenData.tokens, null, 2));
    } else {
      console.error('❌ 토큰 설정 API 실패:', tokenData.error);
    }
  } catch (error) {
    console.error('❌ 토큰 설정 API 에러:', error.message);
  }

  console.log('\n---\n');

  // 3. 서버 상태 확인
  console.log('3️⃣ 서버 상태 확인...');
  try {
    const healthResponse = await fetch(`${API_BASE_URL}/health`);
    if (healthResponse.ok) {
      console.log('✅ 서버가 정상 작동 중입니다');
    } else {
      console.log('⚠️ 서버 헬스체크 실패');
    }
  } catch (error) {
    console.error('❌ 서버 연결 실패:', error.message);
    console.log('\n💡 해결 방법:');
    console.log('1. 서버를 시작하세요: node server.js');
    console.log('2. .env 파일에서 PORT=3003 확인');
    console.log('3. Supabase 환경변수 확인');
  }

  console.log('\n🏁 테스트 완료\n');

  // 4. 문제 해결 가이드
  console.log('📋 체크리스트:');
  console.log('□ 서버가 실행 중인가? (node server.js)');
  console.log('□ 포트가 3003인가? (.env 파일 확인)');
  console.log('□ Supabase URL과 KEY가 설정되어 있는가?');
  console.log('□ Supabase에 테이블이 생성되어 있는가?');
  console.log('  - pricing_config 테이블');
  console.log('  - token_config 테이블');
  console.log('□ subscription-token-system.sql을 실행했는가?');
}

// 실행
testAPIs().catch(console.error);
