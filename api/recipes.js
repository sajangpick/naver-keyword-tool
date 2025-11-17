// ========================================
// 🍳 레시피 관리 API
// ========================================
// 생성일: 2025년 11월 2일
// 버전: 1.0.0
// 설명: 레시피 CRUD 및 검색 기능
// ========================================

const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

// Supabase 클라이언트 초기화 (안전하게)
let supabase = null;
if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) {
  supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );
} else {
  console.warn('⚠️ Supabase 키가 설정되지 않았습니다. 일부 기능이 제한됩니다.');
}

// ========================================
// 1. 레시피 검색 (내부 DB + 공공 API)
// ========================================
router.get('/search', async (req, res) => {
  try {
    const { 
      keyword, 
      category, 
      difficulty,
      maxTime,
      source = 'all' // 'internal', 'public', 'all'
    } = req.query;
    
    const userId = req.headers['user-id'];
    let results = [];
    
    // 1. 내부 DB 검색
    if (source === 'internal' || source === 'all') {
      if (supabase) {
        let query = supabase
          .from('recipes')
          .select('*')
          .or(`is_public.eq.true${userId ? `,user_id.eq.${userId}` : ''}`);
        
        if (keyword) {
          query = query.or(`name.ilike.%${keyword}%,description.ilike.%${keyword}%`);
        }
        if (category) {
          query = query.eq('category', category);
        }
        if (difficulty) {
          query = query.eq('difficulty', difficulty);
        }
        if (maxTime) {
          query = query.lte('total_time', maxTime);
        }
        
        query = query.order('rating', { ascending: false }).limit(50);
        
        const { data: internalRecipes, error } = await query;
        if (!error && internalRecipes) {
          results = results.concat(internalRecipes.map(r => ({
            ...r,
            source_type: 'internal'
          })));
        }
      } else {
        console.log('Supabase 연결 없음 - 내부 DB 검색 건너뜀');
      }
    }
    
    // 2. 공공 API 검색 (농림수산식품교육문화정보원)
    if (source === 'public' || source === 'all') {
      try {
        if (!process.env.RECIPE_API_KEY) {
          // API 키가 없을 때 테스트용 샘플 데이터 제공
          console.log('⚠️ 레시피 API 키 없음 - 샘플 데이터 제공');
          
          // 다양한 샘플 레시피 데이터
          const sampleRecipes = [
            {
              id: 'sample-1',
              name: '김치찌개',
              description: '얼큰하고 시원한 한국의 대표 찌개',
              category: '한식',
              sub_category: '찌개',
              difficulty: '초급',
              total_time: 30,
              servings: 4,
              cost_per_serving: 3000,
              rating: 4.5,
              view_count: 150,
              source_type: 'public_api',
              source: 'rural_dev',
              ingredients: [
                {name: '김치', amount: '300g'},
                {name: '돼지고기', amount: '200g'},
                {name: '두부', amount: '1/2모'}
              ]
            },
            {
              id: 'sample-2',
              name: '된장찌개',
              description: '구수한 된장의 깊은 맛',
              category: '한식',
              sub_category: '찌개',
              difficulty: '초급',
              total_time: 25,
              servings: 4,
              cost_per_serving: 2500,
              rating: 4.3,
              view_count: 120,
              source_type: 'public_api',
              source: 'rural_dev',
              ingredients: [
                {name: '된장', amount: '2큰술'},
                {name: '두부', amount: '1/2모'},
                {name: '호박', amount: '1/4개'}
              ]
            },
            {
              id: 'sample-3',
              name: '제육볶음',
              description: '매콤달콤한 돼지고기 볶음',
              category: '한식',
              sub_category: '볶음',
              difficulty: '중급',
              total_time: 40,
              servings: 4,
              cost_per_serving: 4000,
              rating: 4.7,
              view_count: 200,
              source_type: 'public_api',
              source: 'rural_dev',
              ingredients: [
                {name: '돼지고기', amount: '500g'},
                {name: '고추장', amount: '2큰술'},
                {name: '양파', amount: '1개'}
              ]
            },
            {
              id: 'sample-4',
              name: '짜장면',
              description: '중화요리의 대표 메뉴',
              category: '중식',
              sub_category: '면요리',
              difficulty: '중급',
              total_time: 45,
              servings: 2,
              cost_per_serving: 3500,
              rating: 4.4,
              view_count: 180,
              source_type: 'public_api',
              source: 'rural_dev'
            },
            {
              id: 'sample-5',
              name: '카레라이스',
              description: '부드럽고 달콤한 일본식 카레',
              category: '일식',
              sub_category: '덮밥',
              difficulty: '초급',
              total_time: 35,
              servings: 4,
              cost_per_serving: 3000,
              rating: 4.2,
              view_count: 140,
              source_type: 'public_api',
              source: 'rural_dev'
            }
          ];
          
          // 키워드 필터링
          let filteredRecipes = sampleRecipes;
          if (keyword) {
            filteredRecipes = sampleRecipes.filter(r => 
              r.name.includes(keyword) || 
              r.description.includes(keyword) ||
              r.category.includes(keyword)
            );
          }
          
          // 카테고리 필터링
          if (category) {
            filteredRecipes = filteredRecipes.filter(r => r.category === category);
          }
          
          // 난이도 필터링
          if (difficulty) {
            filteredRecipes = filteredRecipes.filter(r => r.difficulty === difficulty);
          }
          
          // 시간 필터링
          if (maxTime) {
            filteredRecipes = filteredRecipes.filter(r => r.total_time <= parseInt(maxTime));
          }
          
          results = results.concat(filteredRecipes);
          
        } else {
          // 실제 공공 API 호출 (농림수산식품교육문화정보원)
          console.log('✅ 레시피 API 키 있음 - 공공 데이터 호출');
          
          // 올바른 URL 형식: /openapi/{API_KEY}/json/{서비스명}/{시작}/{끝}
          // 서비스명만 사용 (전체 URL이 아님!)
          const serviceName = 'Grid_20150827000000000226_1'; // 기본 레시피 서비스
          const apiUrl = `http://211.237.50.150:7080/openapi/${process.env.RECIPE_API_KEY}/json/${serviceName}/1/100`;
          
          console.log('API 호출 URL:', apiUrl);
          
          const apiResponse = await axios.get(apiUrl, {
            timeout: 10000,
            headers: {
              'Accept': 'application/json'
            }
          });
          
          console.log('API 응답 상태:', apiResponse.status);
          
          // API 응답 전체 구조 출력 (디버깅용)
          console.log('API 응답 데이터 구조:', JSON.stringify(apiResponse.data).substring(0, 500));
          console.log('API 응답 키 목록:', Object.keys(apiResponse.data || {}));
          
          // API 응답 데이터 파싱
          const apiData = apiResponse.data?.Grid_20150827000000000226_1?.row || [];
          
          console.log(`공공 API에서 ${apiData.length}개 레시피 조회`);
          
          // 데이터가 없을 경우 전체 응답 출력
          if (apiData.length === 0) {
            console.log('⚠️ API 응답 전체:', JSON.stringify(apiResponse.data, null, 2));
          }
          
          // API 데이터를 내부 형식으로 변환
          const publicRecipes = apiData.map(recipe => ({
            id: `public-${recipe.RECIPE_ID}`,
            name: recipe.RECIPE_NM_KO,
            description: recipe.SUMRY || '',
            category: mapNationType(recipe.NATION_NM), // 유형 매핑
            sub_category: recipe.TY_NM,
            difficulty: mapDifficulty(recipe.LEVEL_NM), // 난이도 매핑
            total_time: parseCookingTime(recipe.COOKING_TIME), // 조리시간 파싱
            servings: parseServings(recipe.QNT), // 분량 파싱
            cost_per_serving: 0, // 공공 API에는 원가 정보 없음
            rating: 0,
            view_count: 0,
            source_type: 'public_api',
            source: 'recipe_gov',
            calories: recipe.CALORIE || 0,
            price_category: recipe.PC_NM,
            ingredient_category: recipe.IRDNT_CODE
          }));
          
          // 필터링 적용
          let filteredPublicRecipes = publicRecipes;
          
          if (keyword) {
            filteredPublicRecipes = filteredPublicRecipes.filter(r => 
              r.name.includes(keyword) || 
              r.description.includes(keyword)
            );
          }
          
          if (category) {
            filteredPublicRecipes = filteredPublicRecipes.filter(r => r.category === category);
          }
          
          if (difficulty) {
            filteredPublicRecipes = filteredPublicRecipes.filter(r => r.difficulty === difficulty);
          }
          
          if (maxTime) {
            filteredPublicRecipes = filteredPublicRecipes.filter(r => r.total_time <= parseInt(maxTime));
          }
          
          results = results.concat(filteredPublicRecipes);
          
          console.log(`필터링 후 ${filteredPublicRecipes.length}개 레시피`);
        }
      } catch (apiError) {
        console.error('공공 API 처리 오류:', apiError);
        // API 실패 시에도 내부 결과는 반환
      }
    }
    
    res.json({
      success: true,
      data: results,
      count: results.length
    });
    
  } catch (error) {
    console.error('레시피 검색 오류:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ========================================
// 2. 레시피 상세 조회
// ========================================
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.headers['user-id'];
    
    // 공공 API 레시피인 경우 (id가 'public-'로 시작)
    if (id.startsWith('public-')) {
      console.log('🔍 공공 API 레시피 상세 조회 시작:', id);
      
      // 레시피 ID 추출 (예: 'public-1' -> '1')
      const recipeId = id.replace('public-', '');
      console.log('📌 추출된 레시피 ID:', recipeId);
      
      // 공공 API에서 해당 레시피 조회
      const apiUrl = `http://211.237.50.150:7080/openapi/${process.env.RECIPE_API_KEY}/json/${process.env.RECIPE_API_URL || 'Grid_20150827000000000226_1'}/1/1000`;
      
      console.log('📡 API 호출:', apiUrl.substring(0, 100) + '...');
      
      const apiResponse = await axios.get(apiUrl, {
        timeout: 10000
      });
      
      console.log('✅ API 응답 성공:', apiResponse.status);
      
      const apiData = apiResponse.data?.Grid_20150827000000000226_1?.row || [];
      console.log(`📊 전체 레시피 개수: ${apiData.length}개`);
      
      // 레시피 ID 목록 출력 (처음 5개)
      if (apiData.length > 0) {
        console.log('🔢 레시피 ID 샘플:', apiData.slice(0, 5).map(r => r.RECIPE_ID).join(', '));
      }
      
      // 해당 ID의 레시피 찾기
      const recipe = apiData.find(r => {
        // 다양한 형식으로 비교 시도
        return r.RECIPE_ID === recipeId || 
               r.RECIPE_ID === parseInt(recipeId) ||
               String(r.RECIPE_ID) === recipeId;
      });
      
      console.log('🎯 찾은 레시피:', recipe ? '있음' : '없음');
      
      if (!recipe) {
        return res.status(404).json({
          success: false,
          error: '레시피를 찾을 수 없습니다'
        });
      }
      
      // 재료정보 API 호출 (상세 재료 목록)
      console.log('🥬 재료정보 API 호출 시작...');
      let detailedIngredients = [];
      
      try {
        const ingredientServiceName = 'Grid_20150827000000000227_1'; // 재료정보 서비스
        const ingredientApiUrl = `http://211.237.50.150:7080/openapi/${process.env.RECIPE_API_KEY}/json/${ingredientServiceName}/1/1000`;
        
        console.log('📡 재료정보 API 호출:', ingredientApiUrl.substring(0, 100) + '...');
        
        const ingredientResponse = await axios.get(ingredientApiUrl, {
          timeout: 10000
        });
        
        const ingredientData = ingredientResponse.data?.Grid_20150827000000000227_1?.row || [];
        console.log(`📊 재료정보 전체 개수: ${ingredientData.length}개`);
        
        // 해당 레시피의 재료 찾기
        const recipeIngredients = ingredientData.filter(i => {
          return i.RECIPE_ID === recipeId || 
                 i.RECIPE_ID === parseInt(recipeId) ||
                 String(i.RECIPE_ID) === recipeId;
        });
        
        console.log(`🎯 해당 레시피의 재료: ${recipeIngredients.length}개`);
        
        // 재료를 순번별로 정렬
        detailedIngredients = recipeIngredients
          .sort((a, b) => parseInt(a.IRDNT_SN) - parseInt(b.IRDNT_SN))
          .map(i => ({
            name: i.IRDNT_NM || '재료명 없음',
            amount: i.IRDNT_CPCTY || '',
            unit: '',
            cost: 0,
            type: i.IRDNT_TY_NM || '기타'
          }));
        
        console.log('✅ 재료 정보 파싱 완료');
        
      } catch (ingredientError) {
        console.error('⚠️ 재료정보 API 호출 실패:', ingredientError.message);
        // 재료정보를 가져오지 못하면 기본 파싱 사용
        detailedIngredients = parseIngredients(recipe);
      }
      
      // 과정정보 API 호출 (상세 조리 단계)
      console.log('🍳 과정정보 API 호출 시작...');
      let processSteps = [];
      
      try {
        const processServiceName = 'Grid_20150827000000000228_1'; // 과정정보 서비스
        const processApiUrl = `http://211.237.50.150:7080/openapi/${process.env.RECIPE_API_KEY}/json/${processServiceName}/1/1000`;
        
        console.log('📡 과정정보 API 호출:', processApiUrl.substring(0, 100) + '...');
        
        const processResponse = await axios.get(processApiUrl, {
          timeout: 10000
        });
        
        const processData = processResponse.data?.Grid_20150827000000000228_1?.row || [];
        console.log(`📊 과정정보 전체 개수: ${processData.length}개`);
        
        // 해당 레시피의 조리 과정 찾기
        const recipeProcesses = processData.filter(p => {
          return p.RECIPE_ID === recipeId || 
                 p.RECIPE_ID === parseInt(recipeId) ||
                 String(p.RECIPE_ID) === recipeId;
        });
        
        console.log(`🎯 해당 레시피의 조리 과정: ${recipeProcesses.length}개`);
        
        // 조리 과정을 단계별로 정렬
        processSteps = recipeProcesses
          .sort((a, b) => parseInt(a.COOKING_NO) - parseInt(b.COOKING_NO))
          .map(p => ({
            order: parseInt(p.COOKING_NO) || 0,
            description: p.COOKING_DC || '',
            tip: p.STEP_TIP || '',
            image_url: p.STRF_STEP_IMAGE_URL || null,
            time: 0
          }));
        
        console.log('✅ 조리 과정 파싱 완료');
        
      } catch (processError) {
        console.error('⚠️ 과정정보 API 호출 실패:', processError.message);
        // 과정정보를 가져오지 못해도 기본정보는 표시
        processSteps = [
          {
            order: 1,
            description: recipe.SUMRY || '조리 방법을 참고하세요.',
            time: 0
          }
        ];
      }
      
      // 데이터 변환
      const detailRecipe = {
        id: `public-${recipe.RECIPE_ID}`,
        name: recipe.RECIPE_NM_KO,
        description: recipe.SUMRY || '설명이 없습니다.',
        category: mapNationType(recipe.NATION_NM),
        sub_category: recipe.TY_NM,
        difficulty: mapDifficulty(recipe.LEVEL_NM),
        total_time: parseCookingTime(recipe.COOKING_TIME),
        servings: parseServings(recipe.QNT),
        calories: recipe.CALORIE || 0,
        cost_per_serving: 0,
        rating: 0,
        source_type: 'public_api',
        source: 'recipe_gov',
        // 재료 정보 (재료정보 API에서 가져온 상세 재료)
        ingredients: detailedIngredients.length > 0 ? detailedIngredients : parseIngredients(recipe),
        // 조리 과정 (과정정보 API에서 가져온 상세 단계)
        steps: processSteps.length > 0 ? processSteps : [
          {
            order: 1,
            description: recipe.SUMRY || '조리 방법을 참고하세요.',
            time: 0
          }
        ],
        isBookmarked: false
      };
      
      console.log('🎉 레시피 상세 정보 통합 완료 (재료 + 과정)');
      
      return res.json({
        success: true,
        data: detailRecipe
      });
    }
    
    // 내부 DB 레시피인 경우 (기존 로직)
    if (!supabase) {
      return res.status(500).json({
        success: false,
        error: 'Supabase 연결이 필요합니다'
      });
    }
    
    // 레시피 조회
    const { data: recipe, error } = await supabase
      .from('recipes')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    if (!recipe) {
      return res.status(404).json({
        success: false,
        error: '레시피를 찾을 수 없습니다'
      });
    }
    
    // 공개 레시피이거나 본인 레시피인지 확인
    if (!recipe.is_public && recipe.user_id !== userId) {
      return res.status(403).json({
        success: false,
        error: '접근 권한이 없습니다'
      });
    }
    
    // 조회수 증가
    await supabase
      .from('recipes')
      .update({ view_count: recipe.view_count + 1 })
      .eq('id', id);
    
    // 북마크 여부 확인
    let isBookmarked = false;
    if (userId) {
      const { data: bookmark } = await supabase
        .from('recipe_bookmarks')
        .select('id')
        .eq('recipe_id', id)
        .eq('user_id', userId)
        .single();
      
      isBookmarked = !!bookmark;
    }
    
    res.json({
      success: true,
      data: {
        ...recipe,
        isBookmarked
      }
    });
    
  } catch (error) {
    console.error('레시피 조회 오류:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ========================================
// 3. 레시피 생성
// ========================================
router.post('/create', async (req, res) => {
  try {
    const userId = req.headers['user-id'];
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: '로그인이 필요합니다'
      });
    }
    
    const recipeData = {
      ...req.body,
      user_id: userId,
      source: 'user'
    };
    
    // 필수 필드 검증
    if (!recipeData.name || !recipeData.ingredients || !recipeData.steps) {
      return res.status(400).json({
        success: false,
        error: '필수 정보가 누락되었습니다'
      });
    }
    
    // 원가 자동 계산
    if (recipeData.ingredients && Array.isArray(recipeData.ingredients)) {
      const totalCost = recipeData.ingredients.reduce((sum, ing) => {
        return sum + (ing.cost || 0);
      }, 0);
      recipeData.total_cost = totalCost;
      recipeData.cost_per_serving = totalCost / (recipeData.servings || 1);
    }
    
    // 레시피 저장
    const { data: newRecipe, error } = await supabase
      .from('recipes')
      .insert(recipeData)
      .select()
      .single();
    
    if (error) throw error;
    
    res.json({
      success: true,
      data: newRecipe,
      message: '레시피가 성공적으로 생성되었습니다'
    });
    
  } catch (error) {
    console.error('레시피 생성 오류:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ========================================
// 4. 레시피 수정
// ========================================
router.put('/update/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.headers['user-id'];
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: '로그인이 필요합니다'
      });
    }
    
    // 권한 확인
    const { data: existing } = await supabase
      .from('recipes')
      .select('user_id, version')
      .eq('id', id)
      .single();
    
    if (!existing || existing.user_id !== userId) {
      return res.status(403).json({
        success: false,
        error: '수정 권한이 없습니다'
      });
    }
    
    // 버전 이력 저장
    const { data: currentRecipe } = await supabase
      .from('recipes')
      .select('*')
      .eq('id', id)
      .single();
    
    if (currentRecipe) {
      await supabase
        .from('recipe_versions')
        .insert({
          recipe_id: id,
          version_number: currentRecipe.version,
          recipe_data: currentRecipe,
          change_note: req.body.changeNote || '수정됨',
          changed_by: userId
        });
    }
    
    // 레시피 업데이트
    const updateData = {
      ...req.body,
      version: existing.version + 1,
      updated_at: new Date().toISOString()
    };
    
    delete updateData.changeNote;
    
    const { data: updatedRecipe, error } = await supabase
      .from('recipes')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    
    res.json({
      success: true,
      data: updatedRecipe,
      message: '레시피가 성공적으로 수정되었습니다'
    });
    
  } catch (error) {
    console.error('레시피 수정 오류:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ========================================
// 5. 레시피 삭제
// ========================================
router.delete('/delete/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.headers['user-id'];
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: '로그인이 필요합니다'
      });
    }
    
    // 권한 확인
    const { data: existing } = await supabase
      .from('recipes')
      .select('user_id')
      .eq('id', id)
      .single();
    
    if (!existing || existing.user_id !== userId) {
      return res.status(403).json({
        success: false,
        error: '삭제 권한이 없습니다'
      });
    }
    
    // 레시피 삭제 (관련 데이터는 CASCADE로 자동 삭제)
    const { error } = await supabase
      .from('recipes')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    
    res.json({
      success: true,
      message: '레시피가 성공적으로 삭제되었습니다'
    });
    
  } catch (error) {
    console.error('레시피 삭제 오류:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ========================================
// 6. 북마크 추가/제거
// ========================================
router.post('/bookmark/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.headers['user-id'];
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: '로그인이 필요합니다'
      });
    }
    
    // 기존 북마크 확인
    const { data: existing } = await supabase
      .from('recipe_bookmarks')
      .select('id')
      .eq('recipe_id', id)
      .eq('user_id', userId)
      .single();
    
    if (existing) {
      // 북마크 제거
      await supabase
        .from('recipe_bookmarks')
        .delete()
        .eq('id', existing.id);
      
      // 북마크 카운트 감소
      await supabase.rpc('decrement', {
        table_name: 'recipes',
        column_name: 'bookmark_count',
        row_id: id
      });
      
      res.json({
        success: true,
        bookmarked: false,
        message: '북마크가 제거되었습니다'
      });
    } else {
      // 북마크 추가
      await supabase
        .from('recipe_bookmarks')
        .insert({
          recipe_id: id,
          user_id: userId,
          folder_name: req.body.folder || '기본'
        });
      
      // 북마크 카운트 증가
      await supabase.rpc('increment', {
        table_name: 'recipes',
        column_name: 'bookmark_count',
        row_id: id
      });
      
      res.json({
        success: true,
        bookmarked: true,
        message: '북마크가 추가되었습니다'
      });
    }
    
  } catch (error) {
    console.error('북마크 처리 오류:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ========================================
// 7. 평점 등록/수정
// ========================================
router.post('/rate/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, review } = req.body;
    const userId = req.headers['user-id'];
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: '로그인이 필요합니다'
      });
    }
    
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        error: '평점은 1-5 사이의 값이어야 합니다'
      });
    }
    
    // 평점 등록/수정 (upsert)
    const { data, error } = await supabase
      .from('recipe_ratings')
      .upsert({
        recipe_id: id,
        user_id: userId,
        rating,
        review: review || null,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,recipe_id'
      })
      .select()
      .single();
    
    if (error) throw error;
    
    res.json({
      success: true,
      data,
      message: '평점이 등록되었습니다'
    });
    
  } catch (error) {
    console.error('평점 등록 오류:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ========================================
// 8. 내 레시피 목록
// ========================================
router.get('/my/list', async (req, res) => {
  try {
    const userId = req.headers['user-id'];
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: '로그인이 필요합니다'
      });
    }
    
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    
    // 전체 개수 조회
    const { count } = await supabase
      .from('recipes')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);
    
    // 레시피 목록 조회
    const { data: recipes, error } = await supabase
      .from('recipes')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    
    if (error) throw error;
    
    res.json({
      success: true,
      data: recipes,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit)
      }
    });
    
  } catch (error) {
    console.error('내 레시피 조회 오류:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ========================================
// 9. 내 북마크 목록
// ========================================
router.get('/my/bookmarks', async (req, res) => {
  try {
    const userId = req.headers['user-id'];
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: '로그인이 필요합니다'
      });
    }
    
    const { data: bookmarks, error } = await supabase
      .from('recipe_bookmarks')
      .select(`
        id,
        folder_name,
        notes,
        created_at,
        recipe:recipes(*)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    // 폴더별로 그룹화
    const grouped = bookmarks.reduce((acc, bookmark) => {
      const folder = bookmark.folder_name || '기본';
      if (!acc[folder]) {
        acc[folder] = [];
      }
      acc[folder].push(bookmark);
      return acc;
    }, {});
    
    res.json({
      success: true,
      data: grouped
    });
    
  } catch (error) {
    console.error('북마크 조회 오류:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ========================================
// 10. 카테고리 목록
// ========================================
router.get('/categories/list', async (req, res) => {
  try {
    // Supabase 연결 확인
    if (!supabase) {
      console.warn('⚠️ Supabase 연결 없음 - 기본 카테고리 반환');
      return res.json({
        success: true,
        data: [
          { id: 1, name: '한식', display_order: 1, is_active: true },
          { id: 2, name: '중식', display_order: 2, is_active: true },
          { id: 3, name: '일식', display_order: 3, is_active: true },
          { id: 4, name: '양식', display_order: 4, is_active: true },
          { id: 5, name: '디저트', display_order: 5, is_active: true }
        ]
      });
    }
    
    const { data: categories, error } = await supabase
      .from('recipe_categories')
      .select('*')
      .eq('is_active', true)
      .order('display_order');
    
    if (error) throw error;
    
    res.json({
      success: true,
      data: categories
    });
    
  } catch (error) {
    console.error('카테고리 조회 오류:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ========================================
// 헬퍼 함수들
// ========================================

// 유형 매핑 (한식, 중식, 일식 등)
function mapNationType(nationNm) {
  if (!nationNm) return '기타';
  
  const mapping = {
    '한식': '한식',
    '중식': '중식',
    '일식': '일식',
    '양식': '양식',
    '이탈리아': '양식',
    '프랑스': '양식',
    '동남아시아': '아시아',
    '퓨전': '퓨전',
    '기타': '기타'
  };
  
  return mapping[nationNm] || '기타';
}

// 난이도 매핑
function mapDifficulty(levelNm) {
  if (!levelNm) return '중급';
  
  const mapping = {
    '초보': '초급',
    '초급': '초급',
    '중급': '중급',
    '고급': '고급',
    '아무나': '초급',
    '어려움': '고급'
  };
  
  return mapping[levelNm] || '중급';
}

// 조리시간 파싱 (예: "30분 이내" → 30)
function parseCookingTime(cookingTime) {
  if (!cookingTime) return 0;
  
  // 숫자만 추출
  const match = cookingTime.match(/(\d+)/);
  if (match) {
    return parseInt(match[1]);
  }
  
  return 0;
}

// 분량 파싱 (예: "4인분" → 4)
function parseServings(qnt) {
  if (!qnt) return 1;
  
  // 숫자만 추출
  const match = qnt.match(/(\d+)/);
  if (match) {
    return parseInt(match[1]);
  }
  
  return 1;
}

// 재료 파싱 (공공 API 데이터에서 재료 추출)
function parseIngredients(recipe) {
  const ingredients = [];
  
  // 재료 분류명 (IRDNT_CODE)이 있으면 추가
  if (recipe.IRDNT_CODE) {
    ingredients.push({
      name: recipe.IRDNT_CODE,
      amount: '',
      unit: '',
      cost: 0
    });
  }
  
  // 가격별 분류명 (PC_NM)도 참고용으로 추가
  if (recipe.PC_NM && recipe.PC_NM !== recipe.IRDNT_CODE) {
    ingredients.push({
      name: `가격대: ${recipe.PC_NM}`,
      amount: '',
      unit: '',
      cost: 0
    });
  }
  
  // 재료가 없으면 기본 메시지
  if (ingredients.length === 0) {
    ingredients.push({
      name: '재료 정보가 제공되지 않습니다',
      amount: '',
      unit: '',
      cost: 0
    });
  }
  
  return ingredients;
}

module.exports = router;
