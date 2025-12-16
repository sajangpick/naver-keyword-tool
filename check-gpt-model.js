/**
 * GPT 모델 버전 확인 스크립트
 * 
 * 사용법: node check-gpt-model.js
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 GPT 모델 버전 확인 중...\n');

const filesToCheck = [
  'server.js',
  'api/chat.js',
  'api/chatgpt-blog.js',
  'api/generate-reply.js',
  'api/ai-news-recommend.js',
  'api/news-ai-summary.js',
  'api/naver/auto-reply.js'
];

let totalFound = 0;
let gpt52Count = 0;
let otherModels = [];

filesToCheck.forEach(file => {
  const filePath = path.join(__dirname, file);
  
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  파일 없음: ${file}`);
    return;
  }
  
  const content = fs.readFileSync(filePath, 'utf8');
  
  // gpt-5.2 찾기
  const gpt52Matches = content.match(/model\s*:\s*["']gpt-5\.2["']/gi);
  if (gpt52Matches) {
    gpt52Count += gpt52Matches.length;
    console.log(`✅ ${file}: gpt-5.2 발견 (${gpt52Matches.length}곳)`);
    totalFound += gpt52Matches.length;
  }
  
  // 다른 모델 찾기
  const otherMatches = content.match(/model\s*:\s*["']gpt-[^"']+["']/gi);
  if (otherMatches) {
    otherMatches.forEach(match => {
      if (!match.includes('gpt-5.2')) {
        const model = match.match(/gpt-[^"']+/i)?.[0];
        if (model && !otherModels.includes(model)) {
          otherModels.push(model);
        }
      }
    });
  }
});

console.log('\n📊 결과 요약:');
console.log(`- gpt-5.2 발견: ${gpt52Count}곳`);
console.log(`- 총 모델 설정: ${totalFound}곳`);

if (otherModels.length > 0) {
  console.log(`\n⚠️  다른 모델 발견: ${otherModels.join(', ')}`);
} else {
  console.log('\n✅ 모든 모델이 gpt-5.2로 설정되었습니다!');
}

