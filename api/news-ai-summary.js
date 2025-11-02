/**
 * AI 뉴스 요약 API
 * TODO: 나중에 구현 예정
 */

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 임시 구현: 기능 준비 중
  return res.status(501).json({
    success: false,
    error: 'AI 요약 기능은 준비 중입니다.'
  });
};
