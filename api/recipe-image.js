// ========================================
// 🖼️ 레시피 이미지 API (Pexels 연동)
// ========================================
// 생성일: 2025년 11월 17일
// 설명: Pexels API를 사용하여 레시피 이미지 제공
// ========================================

const express = require('express');
const router = express.Router();
const axios = require('axios');

// ========================================
// 한글 레시피명 → 영어 매핑 (개선 버전)
// ========================================
const recipeNameMap = {
  // 밥류 - 더 구체적인 설명 추가
  '나물비빔밥': 'korean bibimbap bowl with seasoned vegetables egg',
  '오곡밥': 'korean multigrain rice bowl healthy grains',
  '잡채밥': 'korean japchae glass noodles with vegetables over rice',
  '콩나물밥': 'korean soybean sprout rice bowl kongnamul bap',
  '약식': 'korean yakshik sweet glutinous rice with jujube chestnut',
  '비빔밥': 'korean bibimbap mixed rice bowl colorful vegetables',
  '김밥': 'korean gimbap seaweed rice roll kimbap',
  '볶음밥': 'korean fried rice bokkeumbap with vegetables',
  '카레라이스': 'japanese curry rice golden sauce',
  
  // 찌개류 - 더 생생한 설명
  '김치찌개': 'korean kimchi jjigae stew red spicy hot pot',
  '된장찌개': 'korean doenjang jjigae soybean paste stew with tofu',
  '부대찌개': 'korean budae jjigae army stew hot pot sausage ramen',
  '순두부찌개': 'korean sundubu jjigae soft tofu stew spicy',
  '청국장찌개': 'korean cheonggukjang fermented soybean paste stew',
  
  // 국/탕류 - 수프 이미지 유도
  '미역국': 'korean miyeokguk seaweed soup dark broth',
  '갈비탕': 'korean galbitang clear beef short rib soup',
  '삼계탕': 'korean samgyetang ginseng chicken soup whole chicken',
  '설렁탕': 'korean seolleongtang milky white ox bone soup',
  '육개장': 'korean yukgaejang spicy shredded beef soup red',
  '감자탕': 'korean gamjatang pork spine potato soup spicy',
  '곰탕': 'korean gomtang clear beef bone soup',
  
  // 고기류 - BBQ 이미지 강조
  '불고기': 'korean bulgogi marinated beef bbq grilled meat',
  '제육볶음': 'korean jeyuk bokkeum spicy stir fried pork',
  '삼겹살': 'korean samgyeopsal grilled pork belly strips',
  '갈비': 'korean galbi grilled beef short ribs bbq',
  '닭갈비': 'korean dakgalbi spicy stir fried chicken',
  '족발': 'korean jokbal braised pigs feet sliced',
  '보쌈': 'korean bossam boiled pork belly with lettuce',
  '수육': 'korean suyuk boiled pork slices',
  
  // 찜류 - 찜 요리 강조
  '갈비찜': 'korean galbijjim braised beef short ribs glossy',
  '닭찜': 'korean dakjjim braised chicken with vegetables',
  '아귀찜': 'korean agujjim spicy braised monkfish',
  '해물찜': 'korean haemul jjim spicy steamed seafood platter',
  
  // 전/부침개 - 팬케이크 형태 강조
  '파전': 'korean pajeon green onion pancake crispy',
  '김치전': 'korean kimchijeon kimchi pancake pan fried',
  '감자전': 'korean gamjajeon potato pancake golden crispy',
  '부추전': 'korean buchujeon chive pancake',
  '해물파전': 'korean haemul pajeon seafood green onion pancake',
  
  // 볶음/튀김류
  '잡채': 'korean japchae stir fried glass noodles colorful vegetables',
  '떡볶이': 'korean tteokbokki spicy rice cakes red sauce street food',
  '닭강정': 'korean dakgangjeong sweet crispy fried chicken glazed',
  '탕수육': 'chinese tangsuyuk sweet and sour pork crispy',
  '깐풍기': 'chinese kanpunggi spicy garlic fried chicken',
  '마파두부': 'chinese mapo tofu spicy ground meat sauce',
  '짜장면': 'korean jajangmyeon black bean noodles chinese style',
  '짬뽕': 'korean jjamppong spicy red seafood noodle soup',
  
  // 면류
  '냉면': 'korean naengmyeon cold buckwheat noodles icy broth',
  '칼국수': 'korean kalguksu knife cut noodles hot soup',
  '잔치국수': 'korean janchi guksu thin wheat noodles anchovy broth',
  '비빔국수': 'korean bibim guksu spicy cold mixed noodles',
  '막국수': 'korean makguksu buckwheat noodles cold',
  
  // 반찬류 - 구체적인 김치 종류
  '김치': 'korean napa cabbage kimchi traditional fermented',
  '부추김치': 'korean garlic chive kimchi buchukimchi green',
  '파김치': 'korean green onion kimchi pakimchi whole scallion',
  '백김치': 'korean white kimchi baekgimchi non spicy',
  '깻잎장아찌': 'korean perilla leaf pickles side dish',
  '무말랭이': 'korean dried radish strips side dish',
  '콩자반': 'korean kongjaban seasoned black beans side dish',
  '멸치볶음': 'korean myeolchi bokkeum stir fried anchovies',
  '계란말이': 'korean gyeran mari rolled omelette tamagoyaki style',
  '깍두기': 'korean kkakdugi radish kimchi cubed',
  '갈비탕': 'korean clear beef rib soup galbitang',
  '오이지장아찌': 'korean cucumber pickles side dish',
  
  // 죽류 - 죽/포리지 강조
  '호박죽': 'korean hobakjuk pumpkin porridge sweet orange',
  '흑임자죽': 'korean heukimjajuk black sesame porridge',
  '잣죽': 'korean jatjuk pine nut porridge creamy',
  '팥죽': 'korean patjuk red bean porridge sweet',
  '전복죽': 'korean jeonbokjuk abalone porridge rice',
  
  // 디저트/음료
  '떡': 'korean tteok rice cake traditional dessert',
  '식혜': 'korean sikhye sweet rice drink cold',
  '수정과': 'korean sujeonggwa cinnamon ginger punch cold',
  '호떡': 'korean hotteok sweet pancake cinnamon sugar',
  '붕어빵': 'korean bungeoppang fish shaped pastry red bean',
  
  // 기타
  '순대': 'korean sundae blood sausage noodles',
  '떡만두국': 'korean tteok mandu guk rice cake dumpling soup',
  '만두': 'korean mandu dumplings steamed fried',
  '튀김': 'korean twigim tempura vegetables seafood fried'
};

// ========================================
// 기본 키워드 (매핑 없을 때)
// ========================================
const defaultKeywords = {
  '밥': 'korean rice bowl',
  '국': 'korean soup',
  '찌개': 'korean stew',
  '전': 'korean pancake',
  '볶음': 'korean stir fry',
  '면': 'korean noodles',
  '떡': 'korean rice cake',
  '김치': 'kimchi',
  '고기': 'korean meat',
  '해물': 'korean seafood',
  '채소': 'korean vegetables',
  '밑반찬': 'korean side dish'
};

// ========================================
// 레시피명을 영어로 변환
// ========================================
function translateRecipeName(recipeName) {
  // 1. 직접 매핑 확인
  if (recipeNameMap[recipeName]) {
    return recipeNameMap[recipeName];
  }
  
  // 2. 부분 매칭 시도
  for (const [korean, english] of Object.entries(recipeNameMap)) {
    if (recipeName.includes(korean)) {
      return english;
    }
  }
  
  // 3. 카테고리 키워드로 폴백
  for (const [keyword, english] of Object.entries(defaultKeywords)) {
    if (recipeName.includes(keyword)) {
      return english;
    }
  }
  
  // 4. 기본값
  return 'korean food';
}

// ========================================
// 이미 사용한 이미지 URL 추적 (중복 방지)
// ========================================
const usedImages = new Set();

// ========================================
// Pexels API로 이미지 검색 (개선 버전)
// ========================================
async function fetchPexelsImage(query, avoidDuplicates = true) {
  try {
    const apiKey = process.env.PEXELS_API_KEY;
    
    if (!apiKey) {
      console.warn('⚠️ Pexels API 키가 설정되지 않았습니다.');
      return null;
    }
    
    console.log(`🔍 Pexels 이미지 검색: "${query}"`);
    
    const response = await axios.get('https://api.pexels.com/v1/search', {
      params: {
        query: query,
        per_page: 15, // 더 많은 옵션 가져오기
        orientation: 'landscape'
      },
      headers: {
        'Authorization': apiKey
      },
      timeout: 5000
    });
    
    const photos = response.data.photos;
    
    if (photos && photos.length > 0) {
      let selectedPhoto = null;
      
      if (avoidDuplicates) {
        // 중복되지 않은 이미지 찾기
        for (const photo of photos) {
          if (!usedImages.has(photo.src.medium)) {
            selectedPhoto = photo;
            usedImages.add(photo.src.medium);
            break;
          }
        }
      }
      
      // 중복 방지 실패 시 랜덤 선택
      if (!selectedPhoto) {
        const randomIndex = Math.floor(Math.random() * Math.min(photos.length, 10));
        selectedPhoto = photos[randomIndex];
        console.log(`🎲 랜덤 이미지 선택 (${randomIndex + 1}/${photos.length})`);
      } else {
        console.log(`✅ 중복 방지 이미지 선택`);
      }
      
      console.log(`📸 이미지 찾음: ${selectedPhoto.src.medium}`);
      
      return {
        url: selectedPhoto.src.medium,
        photographer: selectedPhoto.photographer,
        photographer_url: selectedPhoto.photographer_url,
        pexels_url: selectedPhoto.url
      };
    } else {
      console.log('⚠️ 이미지를 찾을 수 없습니다.');
      return null;
    }
    
  } catch (error) {
    console.error('❌ Pexels API 오류:', error.message);
    return null;
  }
}

// ========================================
// GET /api/recipe-image/:recipeName
// 레시피 이미지 가져오기
// ========================================
router.get('/:recipeName', async (req, res) => {
  try {
    const { recipeName } = req.params;
    
    console.log(`📸 레시피 이미지 요청: ${recipeName}`);
    
    // 1. 한글 → 영어 변환
    const englishQuery = translateRecipeName(recipeName);
    console.log(`📝 영어 검색어: ${englishQuery}`);
    
    // 2. Pexels에서 이미지 검색
    const imageData = await fetchPexelsImage(englishQuery);
    
    if (imageData) {
      res.json({
        success: true,
        data: imageData
      });
    } else {
      // 기본 이미지 반환 (아이콘)
      res.json({
        success: false,
        data: {
          url: null,
          photographer: null,
          photographer_url: null,
          pexels_url: null
        }
      });
    }
    
  } catch (error) {
    console.error('레시피 이미지 조회 오류:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ========================================
// POST /api/recipe-image/batch
// 여러 레시피 이미지 한 번에 가져오기
// ========================================
router.post('/batch', async (req, res) => {
  try {
    const { recipeNames } = req.body;
    
    if (!recipeNames || !Array.isArray(recipeNames)) {
      return res.status(400).json({
        success: false,
        error: '레시피 이름 배열이 필요합니다'
      });
    }
    
    console.log(`📸 일괄 이미지 요청: ${recipeNames.length}개`);
    
    // 병렬 처리 (최대 5개씩)
    const batchSize = 5;
    const results = [];
    
    for (let i = 0; i < recipeNames.length; i += batchSize) {
      const batch = recipeNames.slice(i, i + batchSize);
      
      const batchResults = await Promise.all(
        batch.map(async (recipeName) => {
          const englishQuery = translateRecipeName(recipeName);
          const imageData = await fetchPexelsImage(englishQuery);
          
          return {
            recipeName,
            imageData: imageData || {
              url: null,
              photographer: null,
              photographer_url: null,
              pexels_url: null
            }
          };
        })
      );
      
      results.push(...batchResults);
      
      // API 제한 고려 (200회/월)
      if (i + batchSize < recipeNames.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    res.json({
      success: true,
      data: results
    });
    
  } catch (error) {
    console.error('일괄 이미지 조회 오류:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;

