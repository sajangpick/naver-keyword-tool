const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

// Supabase 초기화
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
let supabase = null;

if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
}

/**
 * 실제 정책지원금 데이터 수집 API
 * 
 * 데이터 출처:
 * 1. 기업마당 (bizinfo.go.kr) - 중소기업 지원사업
 * 2. 소상공인마당 (sbiz.or.kr) - 소상공인 정책
 * 3. K-Startup (k-startup.go.kr) - 창업지원
 * 4. 정책브리핑 (korea.kr) - 정부 정책
 */

// 실제 데이터 소스 URL
const DATA_SOURCES = {
  // 중소벤처기업부 - 소상공인 지원사업 공고
  MSS: 'https://www.mss.go.kr/site/smba/ex/bbs/List.do?cbIdx=86',
  
  // 소상공인시장진흥공단
  SEMAS: 'https://www.semas.or.kr/web/board/webBoardList.do?bsCd=notice',
  
  // 정책브리핑 RSS
  KOREA_GOV: 'https://www.korea.kr/rss/policy.xml',
  
  // 기업마당 API (공공데이터포털 인증키 필요)
  BIZINFO_API: 'https://api.odcloud.kr/api/3074462/v1/uddi:f3f4df8b-5b64-4165-8581-973bf5d50c94'
};

/**
 * 실제 정책 데이터 크롤링/수집
 */
async function fetchRealPolicies() {
  const policies = [];
  
  try {
    // 1. 기업마당 API 호출 (공공데이터포털 키 필요)
    if (process.env.PUBLIC_DATA_KEY) {
      const bizInfoResponse = await axios.get(DATA_SOURCES.BIZINFO_API, {
        params: {
          page: 1,
          perPage: 100,
          serviceKey: process.env.PUBLIC_DATA_KEY
        }
      });
      
      if (bizInfoResponse.data && bizInfoResponse.data.data) {
        bizInfoResponse.data.data.forEach(item => {
          policies.push({
            title: item['사업명'] || item.pblancNm,
            organization: item['수행기관'] || item.excInsttNm,
            category: mapCategory(item['지원분야']),
            summary: item['사업개요'] || item.bsnsSumryCn,
            description: item['지원내용'] || item.sportCn,
            support_amount: item['지원규모'] || item.sportScle,
            support_type: mapSupportType(item['지원유형']),
            eligibility_criteria: item['지원자격'] || item.sportQualf,
            application_start_date: item['신청시작일'] || item.rceptBeginDe,
            application_end_date: item['신청마감일'] || item.rceptEndDe,
            application_url: item['신청URL'] || item.reqstUrl,
            contact_info: item['문의처'] || item.rqutProcCn,
            status: getStatus(item['신청마감일']),
            source: 'bizinfo'
          });
        });
      }
    }
    
    // 2. 정부 RSS 피드 파싱
    const rssResponse = await axios.get(DATA_SOURCES.KOREA_GOV);
    const rssData = parseRSS(rssResponse.data);
    
    rssData.forEach(item => {
      if (isRelevantPolicy(item)) {
        policies.push({
          title: item.title,
          organization: '정부',
          category: 'operation',
          summary: item.description,
          description: item.content || item.description,
          application_url: item.link,
          status: 'active',
          source: 'korea.kr'
        });
      }
    });
    
  } catch (error) {
    console.error('실제 데이터 수집 실패:', error);
  }
  
  return policies;
}

/**
 * 카테고리 매핑
 */
function mapCategory(categoryText) {
  const mapping = {
    '창업': 'startup',
    '경영': 'operation',
    '인력': 'employment',
    '시설': 'facility',
    '마케팅': 'marketing',
    '교육': 'education',
    '기술': 'technology'
  };
  
  for (const [key, value] of Object.entries(mapping)) {
    if (categoryText && categoryText.includes(key)) {
      return value;
    }
  }
  return 'other';
}

/**
 * 지원유형 매핑
 */
function mapSupportType(typeText) {
  if (!typeText) return 'other';
  if (typeText.includes('보조') || typeText.includes('지원금')) return 'grant';
  if (typeText.includes('융자') || typeText.includes('대출')) return 'loan';
  if (typeText.includes('세제') || typeText.includes('세금')) return 'tax_benefit';
  if (typeText.includes('바우처')) return 'voucher';
  if (typeText.includes('컨설팅')) return 'consulting';
  return 'other';
}

/**
 * 상태 확인
 */
function getStatus(endDate) {
  if (!endDate) return 'active';
  const today = new Date();
  const end = new Date(endDate);
  if (end < today) return 'ended';
  if (end > today) return 'active';
  return 'active';
}

/**
 * RSS 파싱 (간단한 구현)
 */
function parseRSS(xmlData) {
  const items = [];
  const itemMatches = xmlData.match(/<item>[\s\S]*?<\/item>/g) || [];
  
  itemMatches.forEach(itemXml => {
    const title = (itemXml.match(/<title>(.*?)<\/title>/) || [])[1];
    const link = (itemXml.match(/<link>(.*?)<\/link>/) || [])[1];
    const description = (itemXml.match(/<description>(.*?)<\/description>/) || [])[1];
    
    if (title) {
      items.push({
        title: title.replace(/<!\[CDATA\[|\]\]>/g, ''),
        link: link?.replace(/<!\[CDATA\[|\]\]>/g, ''),
        description: description?.replace(/<!\[CDATA\[|\]\]>/g, '')
      });
    }
  });
  
  return items;
}

/**
 * 관련 정책 필터링
 */
function isRelevantPolicy(item) {
  const keywords = ['소상공인', '중소기업', '자영업', '창업', '지원금', '보조금', '융자', '바우처'];
  const text = (item.title + ' ' + item.description).toLowerCase();
  return keywords.some(keyword => text.includes(keyword));
}

/**
 * 실시간 크롤링 API
 */
module.exports = async (req, res) => {
  // CORS 설정
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // 1. 실제 정책 데이터 수집
    const policies = await fetchRealPolicies();
    
    // 2. Supabase에 저장 (옵션)
    if (supabase && req.method === 'POST' && req.body.save) {
      for (const policy of policies) {
        // 중복 체크
        const { data: existing } = await supabase
          .from('policy_supports')
          .select('id')
          .eq('title', policy.title)
          .single();
        
        if (!existing) {
          await supabase
            .from('policy_supports')
            .insert({
              ...policy,
              business_type: ['음식점', '카페', '소매업'],
              target_area: ['전국'],
              created_at: new Date()
            });
        }
      }
      
      return res.json({
        success: true,
        message: `${policies.length}개의 실제 정책이 저장되었습니다.`,
        data: policies
      });
    }
    
    // 3. 조회만 하는 경우
    return res.json({
      success: true,
      count: policies.length,
      data: policies
    });
    
  } catch (error) {
    console.error('Fetch real policies error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * 웹 스크래핑으로 실제 데이터 수집
 * puppeteer 사용 예제
 */
async function scrapeRealPolicies() {
  const puppeteer = require('puppeteer');
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  
  const policies = [];
  
  try {
    // 소상공인마당 접속
    await page.goto('https://www.sbiz.or.kr/sup/cmm/board/viewBoardList.do?board_id=ANNOUNCE');
    await page.waitForSelector('.board_list');
    
    // 공지사항 목록 스크래핑
    const items = await page.evaluate(() => {
      const results = [];
      document.querySelectorAll('.board_list tbody tr').forEach(row => {
        const title = row.querySelector('.subject a')?.textContent.trim();
        const date = row.querySelector('.date')?.textContent.trim();
        const link = row.querySelector('.subject a')?.href;
        
        if (title) {
          results.push({ title, date, link });
        }
      });
      return results;
    });
    
    // 각 항목 상세 정보 수집
    for (const item of items.slice(0, 10)) { // 최근 10개만
      if (item.link) {
        await page.goto(item.link);
        await page.waitForSelector('.board_view');
        
        const detail = await page.evaluate(() => {
          return {
            content: document.querySelector('.board_view .content')?.textContent.trim(),
            files: Array.from(document.querySelectorAll('.file_list a')).map(a => ({
              name: a.textContent.trim(),
              url: a.href
            }))
          };
        });
        
        policies.push({
          title: item.title,
          organization: '소상공인시장진흥공단',
          category: 'operation',
          summary: detail.content?.substring(0, 200),
          description: detail.content,
          application_url: item.link,
          status: 'active',
          source: 'sbiz.or.kr'
        });
      }
    }
    
  } catch (error) {
    console.error('Scraping error:', error);
  } finally {
    await browser.close();
  }
  
  return policies;
}
