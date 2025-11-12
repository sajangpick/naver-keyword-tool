"""
네이버 뉴스 최신 소식 자동 수집 스크립트

실행 시 카테고리별로 네이버 뉴스를 검색해 Supabase news_board 테이블에 저장합니다.
환경 변수(.env)에 아래 값들이 설정되어 있어야 합니다.
  - SUPABASE_URL
  - SUPABASE_SERVICE_KEY (또는 SUPABASE_ANON_KEY)
  - NAVER_SEARCH_CLIENT_ID
  - NAVER_SEARCH_CLIENT_SECRET
"""

import os
import re
import time
from datetime import datetime
from typing import Dict, List, Optional
from urllib.parse import quote

import requests
from dotenv import load_dotenv
from supabase import Client, create_client

# 프로젝트 루트의 .env 로드
load_dotenv()
project_env = os.path.join(os.path.dirname(__file__), ".env")
if os.path.exists(project_env):
  load_dotenv(project_env)


# -----------------------------
# 환경 변수 및 상수 설정
# -----------------------------
SUPABASE_URL = os.getenv("https://ptuzlubgggbgsophfcna.supabase.co")
SUPABASE_ANON_KEY = os.getenv("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB0dXpsdWJnZ2diZ3NvcGhmY25hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA0MjEzMzQsImV4cCI6MjA3NTk5NzMzNH0.NaMMH7vVpcrFAi9IOQ0o_HF6rQ7dOdiAXAkxu6r84CE")
NAVER_CLIENT_ID = os.getenv("odP6PhMAXkzpFwTOtSj9")
NAVER_CLIENT_SECRET = os.getenv("OEWQdd3p6r")

MAX_PER_CATEGORY = int(os.getenv("NEWS_FETCH_LIMIT_PER_CATEGORY", "2"))
NAVER_RESULTS_PER_KEYWORD = int(os.getenv("NAVER_RESULTS_PER_KEYWORD", "5"))

# 뉴스 원문 추출 API 우선순위 (ENV 값을 먼저 사용, 없으면 기본값)
FETCH_BASE_CANDIDATES = [
  os.getenv("NEWS_FETCH_API_BASE"),
  os.getenv("NEWS_FETCH_FALLBACK_BASE"),
  "http://localhost:3003",
  "http://127.0.0.1:3003",
  "https://naver-keyword-tool.onrender.com",
]
FETCH_BASES = [base.rstrip("/") for base in FETCH_BASE_CANDIDATES if base]

# 카테고리별 기본 검색 키워드
CATEGORY_KEYWORDS: Dict[str, List[str]] = {
  "policy": [
    "외식업 지원금",
    "소상공인 정책",
    "음식점 위생 점검",
  ],
  "trend": [
    "외식 트렌드",
    "맛집 소비 트렌드",
    "MZ세대 식당 인기",
  ],
  "management": [
    "식당 경영 노하우",
    "식당 매출 증가",
    "자영업 마케팅 전략",
  ],
  "ingredients": [
    "식자재 가격 동향",
    "농산물 가격 상승",
    "수산물 가격 변동",
  ],
  "technology": [
    "식당 기술 도구",
    "배달앱 업데이트",
    "POS 시스템 뉴스",
  ],
}


# -----------------------------
# 유틸 함수
# -----------------------------
def init_supabase() -> Optional[Client]:
  if not "https://ptuzlubgggbgsophfcna.supabase.co" or not "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB0dXpsdWJnZ2diZ3NvcGhmY25hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA0MjEzMzQsImV4cCI6MjA3NTk5NzMzNH0.NaMMH7vVpcrFAi9IOQ0o_HF6rQ7dOdiAXAkxu6r84CE":
    print("❌ Supabase 환경 변수를 찾을 수 없습니다. .env 파일을 확인해주세요.")
    return None

  try:
    client = create_client( "https://ptuzlubgggbgsophfcna.supabase.co", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB0dXpsdWJnZ2diZ3NvcGhmY25hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA0MjEzMzQsImV4cCI6MjA3NTk5NzMzNH0.NaMMH7vVpcrFAi9IOQ0o_HF6rQ7dOdiAXAkxu6r84CE")
    return client
  except Exception as error:
    print(f"❌ Supabase 연결 실패: {error}")
    return None


def clean_html(text: str) -> str:
  if not text:
    return ""
  cleaned = re.sub(r"<[^>]+>", " ", text)
  cleaned = re.sub(r"\s+", " ", cleaned)
  return cleaned.strip()


def fetch_naver_news(keyword: str) -> List[Dict]:
  if not NAVER_CLIENT_ID or not NAVER_CLIENT_SECRET:
    print("⚠️ 네이버 검색 API 키가 없습니다. NAVER_SEARCH_CLIENT_ID / NAVER_SEARCH_CLIENT_SECRET 값을 확인해주세요.")
    return []

  url = "https://openapi.naver.com/v1/search/news.json"
  headers = {
    "X-Naver-Client-Id": NAVER_CLIENT_ID,
    "X-Naver-Client-Secret": NAVER_CLIENT_SECRET,
  }
  params = {
    "query": keyword,
    "display": NAVER_RESULTS_PER_KEYWORD,
    "sort": "date",
  }

  try:
    response = requests.get(url, headers=headers, params=params, timeout=5)
    response.raise_for_status()
    return response.json().get("items", [])
  except Exception as error:
    print(f"❌ 네이버 뉴스 검색 실패 ({keyword}): {error}")
    return []


def fetch_full_article(source_url: Optional[str]) -> Optional[Dict]:
  if not source_url:
    return None

  encoded = quote(source_url, safe="")
  for base in FETCH_BASES:
    fetch_url = f"{base}/api/news-fetch?url={encoded}"
    try:
      response = requests.get(fetch_url, timeout=12)
      if response.status_code == 200:
        data = response.json()
        if data.get("success") and data.get("data"):
          return data["data"]
      else:
        print(f"⚠️ 원문 추출 실패 ({response.status_code}): {fetch_url}")
    except Exception as error:
      print(f"⚠️ 원문 추출 에러: {error} ({fetch_url})")
      continue

  return None


def build_news_payload(item: Dict, category: str) -> Optional[Dict]:
  title = clean_html(item.get("title", ""))
  summary = clean_html(item.get("description", ""))
  source_url = item.get("originallink") or item.get("link")

  if not title or not source_url:
    return None

  full_article = fetch_full_article(source_url)
  if full_article and full_article.get("content"):
    content_html = full_article["content"]
    final_source = full_article.get("sourceUrl") or source_url
  else:
    final_source = source_url
    if summary:
      content_html = f"<p>{summary}</p><p><br></p><p>출처: <a href=\"{final_source}\" target=\"_blank\" rel=\"noopener\">{final_source}</a></p>"
    else:
      content_html = f"<p>자세한 내용은 아래 원문 링크를 참고해주세요.</p><p><br></p><p>출처: <a href=\"{final_source}\" target=\"_blank\" rel=\"noopener\">{final_source}</a></p>"

  payload = {
    "title": title[:255],
    "content": content_html,
    "category": category,
    "image_url": None,
    "source_url": final_source,
    "author": "NAVER_AUTO",
    "is_featured": False,
  }

  return payload


def already_exists(supabase_client: Client, source_urls: List[str]) -> List[str]:
  if not source_urls:
    return []

  try:
    result = (
      supabase_client
      .table("news_board")
      .select("source_url")
      .in_("source_url", source_urls)
      .execute()
    )
    if not result.data:
      return []

    return [row["source_url"] for row in result.data if row.get("source_url")]
  except Exception as error:
    print(f"⚠️ 기존 뉴스 조회 실패: {error}")
    return []


def insert_news(supabase_client: Client, items: List[Dict]) -> int:
  if not items:
    return 0

  try:
    supabase_client.table("news_board").insert(items).execute()
    return len(items)
  except Exception as error:
    print(f"❌ 뉴스 저장 실패: {error}")
    return 0


# -----------------------------
# 메인 로직
# -----------------------------
def main() -> None:
  supabase_client = init_supabase()
  if not supabase_client:
    return

  collected: List[Dict] = []

  print("🚀 네이버 뉴스 자동 업데이트를 시작합니다.")
  started_at = time.perf_counter()

  for category, keywords in CATEGORY_KEYWORDS.items():
    print(f"\n🗂 카테고리 처리 중: {category}")
    category_items: List[Dict] = []

    for keyword in keywords:
      news_items = fetch_naver_news(keyword)
      for item in news_items:
        payload = build_news_payload(item, category)
        if payload:
          category_items.append(payload)
        if len(category_items) >= MAX_PER_CATEGORY:
          break
      if len(category_items) >= MAX_PER_CATEGORY:
        break
      time.sleep(0.4)  # 호출 간 간단한 딜레이

    print(f"  ↳ 수집된 기사 수: {len(category_items)}")
    collected.extend(category_items)

  dedupe_targets = [item["source_url"] for item in collected if item.get("source_url")]
  existing_sources = set(already_exists(supabase_client, dedupe_targets))

  new_items = [item for item in collected if item.get("source_url") not in existing_sources]

  if not new_items:
    print("\nℹ️ 신규로 추가할 뉴스가 없습니다. (모두 이미 등록됨)")
    return

  inserted_count = insert_news(supabase_client, new_items)

  elapsed = time.perf_counter() - started_at
  now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

  if inserted_count > 0:
    print(f"\n✅ {inserted_count}개의 뉴스를 저장했습니다. ({now}, {elapsed:.1f}s)")
  else:
    print("\n⚠️ 뉴스를 저장하지 못했습니다. 로그를 확인해주세요.")


if __name__ == "__main__":
  main()


