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
    
    // 2. 공공 API 검색 (농촌진흥청)
    if (source === 'public' || source === 'all') {
      // 샘플 데이터 생성 (실제 API 키가 있으면 실제 API 호출로 대체)
      try {
        if (!process.env.RURAL_DEV_API_KEY) {
          // API 키가 없을 때 테스트용 샘플 데이터 제공
          console.log('농촌진흥청 API 키 없음 - 샘플 데이터 제공');
          
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
          // 실제 API 호출 코드 (API 키가 있을 때)
          const apiResponse = await axios.get('https://api.nongsaro.go.kr/...',{
            params: { 
              apiKey: process.env.RURAL_DEV_API_KEY,
              searchKeyword: keyword 
            }
          });
          results = results.concat(apiResponse.data.items || []);
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

module.exports = router;
