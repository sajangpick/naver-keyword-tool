/**
 * 블로그 스타일 설정 API
 * 사용자별 블로그 작성 스타일을 저장하고 조회합니다.
 */

const { createClient } = require('@supabase/supabase-js');

// Supabase 클라이언트 초기화
let supabase = null;
if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );
}

/**
 * Express 라우트 핸들러
 */
module.exports = async function handler(req, res) {
    // CORS 헤더 설정
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    // OPTIONS 요청 처리
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (!supabase) {
        return res.status(500).json({
            success: false,
            error: 'Supabase가 초기화되지 않았습니다.'
        });
    }

    try {
        // GET: 블로그 스타일 조회
        if (req.method === 'GET') {
            const userId = req.query.userId;

            if (!userId) {
                return res.status(400).json({
                    success: false,
                    error: 'userId가 필요합니다.'
                });
            }

            const { data, error } = await supabase
                .from('profiles')
                .select('blog_style')
                .eq('id', userId)
                .single();

            if (error) {
                throw error;
            }

            return res.status(200).json({
                success: true,
                data: data?.blog_style || getDefaultBlogStyle()
            });
        }

        // POST: 블로그 스타일 저장
        if (req.method === 'POST') {
            const { userId, blogStyle } = req.body;

            if (!userId || !blogStyle) {
                return res.status(400).json({
                    success: false,
                    error: 'userId와 blogStyle이 필요합니다.'
                });
            }

            // 유효성 검사
            const validatedStyle = validateBlogStyle(blogStyle);

            const { error } = await supabase
                .from('profiles')
                .update({ blog_style: validatedStyle })
                .eq('id', userId);

            if (error) {
                throw error;
            }

            return res.status(200).json({
                success: true,
                message: '블로그 스타일이 저장되었습니다.',
                data: validatedStyle
            });
        }

        return res.status(405).json({
            success: false,
            error: 'Method not allowed'
        });

    } catch (error) {
        console.error('[Blog Style API] 오류:', error);
        return res.status(500).json({
            success: false,
            error: error.message || '서버 오류가 발생했습니다.'
        });
    }
};

/**
 * 기본 블로그 스타일 반환
 */
function getDefaultBlogStyle() {
    return {
        tone: 'friendly',              // friendly, formal, casual
        formality: 'polite',           // polite, informal, semi-formal
        emoji_usage: 'moderate',       // none, minimal, moderate, frequent
        personality: 'warm',           // warm, professional, humorous, enthusiastic
        expertise_level: 'intermediate', // beginner, intermediate, expert
        content_length: 'detailed',    // brief, moderate, detailed
        writing_style: 'storytelling'  // storytelling, informative, conversational, analytical
    };
}

/**
 * 블로그 스타일 유효성 검사
 */
function validateBlogStyle(style) {
    const defaultStyle = getDefaultBlogStyle();
    
    const validOptions = {
        tone: ['friendly', 'formal', 'casual'],
        formality: ['polite', 'informal', 'semi-formal'],
        emoji_usage: ['none', 'minimal', 'moderate', 'frequent'],
        personality: ['warm', 'professional', 'humorous', 'enthusiastic'],
        expertise_level: ['beginner', 'intermediate', 'expert'],
        content_length: ['brief', 'moderate', 'detailed'],
        writing_style: ['storytelling', 'informative', 'conversational', 'analytical']
    };

    const validated = {};

    for (const [key, validValues] of Object.entries(validOptions)) {
        if (style[key] && validValues.includes(style[key])) {
            validated[key] = style[key];
        } else {
            validated[key] = defaultStyle[key];
        }
    }

    return validated;
}

