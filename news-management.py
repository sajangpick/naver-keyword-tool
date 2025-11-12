"""
네이버 뉴스 Open API를 호출하여 최신 뉴스를 가져오는 간단한 스크립트입니다.

사용 방법:
  1. 환경 변수에 네이버 API 인증 정보를 설정합니다.
     - NAVER_SEARCH_CLIENT_ID
     - NAVER_SEARCH_CLIENT_SECRET
  2. 필요하다면 requests 라이브러리를 설치합니다.
     > pip install requests
  3. 아래와 같이 실행하여 뉴스를 조회합니다.
     > python news-management.py --query "소상공인 지원" --display 5

이 스크립트는 결과를 표준출력으로 보여주며, --save 옵션을 이용하면 JSON 파일로 저장할 수 있습니다.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime
from typing import Any, Dict, List, Optional

import requests


NAVER_NEWS_ENDPOINT = "https://openapi.naver.com/v1/search/news.json"


class NaverNewsError(RuntimeError):
    """네이버 뉴스 API 관련 예외."""


def build_headers() -> Dict[str, str]:
    """네이버 Open API 요청에 필요한 헤더를 구성합니다."""
    client_id = os.getenv("NAVER_SEARCH_CLIENT_ID")
    client_secret = os.getenv("NAVER_SEARCH_CLIENT_SECRET")

    if not client_id or not client_secret:
        raise NaverNewsError(
            "NAVER_SEARCH_CLIENT_ID 또는 NAVER_SEARCH_CLIENT_SECRET 환경 변수가 설정되지 않았습니다."
        )

    return {
        "X-Naver-Client-Id": client_id,
        "X-Naver-Client-Secret": client_secret,
    }


def fetch_news(
    query: str,
    display: int = 10,
    sort: str = "date",
    start: int = 1,
) -> Dict[str, Any]:
    """
    네이버 뉴스 API를 호출하여 검색 결과를 반환합니다.

    Parameters
    ----------
    query: 검색어
    display: 가져올 뉴스 개수 (최대 100)
    sort: 정렬 방식 ("date" 또는 "sim")
    start: 검색 시작 위치
    """
    if display < 1 or display > 100:
        raise ValueError("display 값은 1 이상 100 이하이어야 합니다.")

    params = {
        "query": query,
        "display": display,
        "sort": sort,
        "start": start,
    }

    response = requests.get(
        NAVER_NEWS_ENDPOINT,
        params=params,
        headers=build_headers(),
        timeout=10,
    )

    if response.status_code != 200:
        raise NaverNewsError(
            f"네이버 뉴스 API 호출 실패 (status={response.status_code}): {response.text}"
        )

    return response.json()


def strip_html(raw_text: Optional[str]) -> str:
    """간단한 HTML 태그 제거."""
    if not raw_text:
        return ""
    return (
        raw_text.replace("&quot;", '"')
        .replace("&apos;", "'")
        .replace("&amp;", "&")
        .replace("<b>", "")
        .replace("</b>", "")
        .replace("<br>", "\n")
        .replace("<br />", "\n")
        .replace("<br/>", "\n")
        .replace("<", "")
        .replace(">", "")
    )


def format_datetime(pub_date: Optional[str]) -> str:
    """네이버가 반환하는 pubDate 값을 사람이 읽기 쉬운 형식으로 변환합니다."""
    if not pub_date:
        return "-"
    try:
        parsed = datetime.strptime(pub_date, "%a, %d %b %Y %H:%M:%S %z")
        return parsed.strftime("%Y-%m-%d %H:%M")
    except ValueError:
        return pub_date


def print_news(items: List[Dict[str, Any]]) -> None:
    """검색 결과를 사람이 읽기 쉬운 형태로 출력합니다."""
    if not items:
        print("검색 결과가 없습니다.")
        return

    for idx, item in enumerate(items, start=1):
        title = strip_html(item.get("title"))
        description = strip_html(item.get("description"))
        originallink = item.get("originallink") or item.get("link")
        pub_date = format_datetime(item.get("pubDate"))

        print(f"{idx}. {title}")
        print(f"   날짜: {pub_date}")
        if originallink:
            print(f"   링크: {originallink}")
        if description:
            print(f"   요약: {description}")
        print("-" * 70)


def save_as_json(items: List[Dict[str, Any]], path: str) -> None:
    """검색 결과를 JSON 파일로 저장합니다."""
    with open(path, "w", encoding="utf-8") as file:
        json.dump(items, file, ensure_ascii=False, indent=2)


def parse_arguments(argv: Optional[List[str]] = None) -> argparse.Namespace:
    """명령줄 인자를 파싱합니다."""
    parser = argparse.ArgumentParser(description="네이버 뉴스 API 조회 스크립트")
    parser.add_argument(
        "--query",
        type=str,
        default="소상공인 지원",
        help="검색할 키워드 (기본값: 소상공인 지원)",
    )
    parser.add_argument(
        "--display",
        type=int,
        default=10,
        help="가져올 뉴스 수 (1~100, 기본값: 10)",
    )
    parser.add_argument(
        "--sort",
        type=str,
        choices=("date", "sim"),
        default="date",
        help='정렬 방식: "date"(최신순) 또는 "sim"(정확도순)',
    )
    parser.add_argument(
        "--start",
        type=int,
        default=1,
        help="검색 시작 위치 (기본값: 1)",
    )
    parser.add_argument(
        "--save",
        type=str,
        default=None,
        help="결과를 저장할 JSON 파일 경로",
    )

    return parser.parse_args(argv)


def main(argv: Optional[List[str]] = None) -> int:
    args = parse_arguments(argv)

    try:
        response = fetch_news(
            query=args.query,
            display=args.display,
            sort=args.sort,
            start=args.start,
        )
    except (NaverNewsError, ValueError) as error:
        print(f"[오류] {error}", file=sys.stderr)
        return 1

    items = response.get("items", [])
    print_news(items)

    if args.save:
        save_as_json(items, args.save)
        print(f"\n총 {len(items)}건의 결과를 '{args.save}' 파일로 저장했습니다.")

    return 0


if __name__ == "__main__":
    sys.exit(main())

