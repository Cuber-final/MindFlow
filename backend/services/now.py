from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timezone
from typing import Any, Optional

from database import (
    get_all_interest_tags,
    get_now_detail_row,
    get_recent_now_candidates,
    touch_article_last_opened_by_anchor,
    update_article_workbench_state_by_anchor,
)
from services.learning import get_content_zone

MAX_INTEREST_WEIGHT = 2.5


def _safe_float(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _clamp(value: float, minimum: float = 0.0, maximum: float = 1.0) -> float:
    return max(minimum, min(maximum, value))


def _coerce_datetime(value: Any) -> Optional[datetime]:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value
    if isinstance(value, str):
        candidate = value.replace("Z", "+00:00")
        try:
            return datetime.fromisoformat(candidate)
        except ValueError:
            return None
    return None


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _normalize_datetime(value: Any) -> Optional[datetime]:
    dt = _coerce_datetime(value)
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _to_iso(value: Any) -> Optional[str]:
    dt = _coerce_datetime(value)
    if dt is None:
        return None
    if dt.tzinfo is not None:
        return dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
    return dt.isoformat()


def _normalize_tags(raw_tags: Any) -> list[str]:
    if not isinstance(raw_tags, list):
        return []
    return [str(tag) for tag in raw_tags if tag]


def _normalize_related_weights(raw_weights: Any) -> dict[str, float]:
    if not isinstance(raw_weights, dict):
        return {}
    normalized: dict[str, float] = {}
    for key, value in raw_weights.items():
        normalized[str(key)] = _safe_float(value, 0.0)
    return normalized


def _build_interest_weight_map(user_tags: list[dict[str, Any]]) -> dict[str, float]:
    interest_map: dict[str, float] = {}
    for tag in user_tags:
        if tag.get("status") == "frozen":
            continue
        tag_name = tag.get("tag")
        if not tag_name:
            continue
        interest_map[str(tag_name)] = _safe_float(tag.get("weight"), 1.0)
    return interest_map


def _score_freshness(row: dict[str, Any]) -> float:
    published_at = _normalize_datetime(row.get("published_at"))
    fetched_at = _normalize_datetime(row.get("fetched_at"))
    anchor_created_at = _normalize_datetime(row.get("anchor_created_at"))
    reference_time = published_at or fetched_at or anchor_created_at
    if reference_time is None:
        return 0.3

    age_hours = max(0.0, (_utc_now() - reference_time).total_seconds() / 3600)
    return round(_clamp(1 - (min(age_hours, 72.0) / 72.0)), 3)


def _score_interest_match(row: dict[str, Any], interest_map: dict[str, float]) -> float:
    tags = _normalize_tags(row.get("tags"))
    if not tags or not interest_map:
        return 0.0

    related_weights = _normalize_related_weights(row.get("related_tag_weights"))
    weighted_matches: list[float] = []

    for tag in tags:
        base_weight = interest_map.get(tag)
        if base_weight is None:
            continue
        relevance = related_weights.get(tag, 1.0)
        normalized_weight = _clamp(base_weight / MAX_INTEREST_WEIGHT)
        normalized_relevance = _clamp(relevance, 0.35, 1.0)
        weighted_matches.append(_clamp(normalized_weight * normalized_relevance))

    if not weighted_matches:
        return 0.0

    strongest_match = max(weighted_matches)
    average_match = sum(weighted_matches) / len(weighted_matches)
    return round(_clamp((strongest_match * 0.6) + (average_match * 0.4)), 3)


def _build_source_affinity_map(
    rows: list[dict[str, Any]],
    interest_scores: dict[int, float],
) -> dict[str, float]:
    grouped_scores: dict[str, list[float]] = defaultdict(list)

    for row in rows:
        source_key = str(row.get("source_id") or row.get("source_name") or "unknown")
        grouped_scores[source_key].append(interest_scores.get(int(row["anchor_id"]), 0.0))

    affinity_map: dict[str, float] = {}
    for source_key, scores in grouped_scores.items():
        if not scores:
            affinity_map[source_key] = 0.2
            continue
        top_scores = sorted(scores, reverse=True)[:3]
        affinity_map[source_key] = round(max(0.2, sum(top_scores) / len(top_scores)), 3)

    return affinity_map


def _get_zone(row: dict[str, Any], interest_map: dict[str, float]) -> str:
    tags = _normalize_tags(row.get("tags"))
    if not tags:
        return get_content_zone(0.1)

    matched_weights = [interest_map[tag] for tag in tags if tag in interest_map]
    if not matched_weights:
        return get_content_zone(0.1)

    return get_content_zone(max(matched_weights))


def _priority_reason(
    row: dict[str, Any],
    *,
    freshness_score: float,
    interest_score: float,
    source_affinity: float,
) -> str:
    significance = _safe_float(row.get("significance"), 0.0)
    is_read = row.get("read_at") is not None

    if significance >= 0.85 and freshness_score >= 0.72:
        return "高显著性 + 高时效"
    if interest_score >= 0.65 and source_affinity >= 0.55:
        return "高度匹配当前兴趣"
    if freshness_score >= 0.8:
        return "高时效，建议优先查看"
    if significance >= 0.65 or (interest_score >= 0.45 and freshness_score >= 0.45):
        return "重要邻近信号，建议尽快处理"
    if is_read:
        return "已读内容，建议按需回看"
    return "值得快速扫读的新增信号"


def _score_priority(
    row: dict[str, Any],
    *,
    freshness_score: float,
    interest_score: float,
    source_affinity: float,
) -> float:
    significance = _safe_float(row.get("significance"), 0.0)
    read_penalty = 0.18 if row.get("read_at") is not None else 0.0

    score = (
        significance * 0.42
        + interest_score * 0.26
        + freshness_score * 0.22
        + source_affinity * 0.10
        - read_penalty
    )
    return round(_clamp(score), 3)


def _choose_summary(row: dict[str, Any]) -> str:
    summary = (row.get("article_summary") or "").strip()
    if summary:
        return summary

    anchor_content = (row.get("anchor_content") or "").strip()
    if anchor_content:
        return anchor_content[:240]

    article_content = (row.get("article_content") or "").strip()
    if article_content:
        return article_content[:240]

    return (row.get("anchor_title") or row.get("article_title") or "").strip()


def _build_body_markdown(row: dict[str, Any], summary: str) -> str:
    parts = [
        "## Why it matters",
        "",
        summary or "暂无摘要。",
        "",
        "## Core insight",
        "",
        (row.get("anchor_content") or row.get("article_content") or "暂无正文内容。").strip(),
    ]

    dialectical_analysis = (row.get("dialectical_analysis") or "").strip()
    if dialectical_analysis:
        parts.extend(["", "## Dialectical analysis", "", dialectical_analysis])

    article_content = (row.get("article_content") or "").strip()
    anchor_content = (row.get("anchor_content") or "").strip()
    if article_content and article_content != anchor_content:
        parts.extend(["", "## Source notes", "", article_content[:4000]])

    return "\n".join(parts).strip()


def _serialize_list_item(
    row: dict[str, Any],
    *,
    interest_map: dict[str, float],
    interest_score: float,
    source_affinity: float,
) -> dict[str, Any]:
    freshness_score = _score_freshness(row)
    summary = _choose_summary(row)
    tags = _normalize_tags(row.get("tags"))
    return {
        "anchor_id": int(row["anchor_id"]),
        "article_id": int(row["article_id"]),
        "title": row.get("anchor_title") or row.get("article_title"),
        "excerpt": (row.get("anchor_content") or row.get("article_summary") or summary)[:280],
        "source_name": row.get("source_name") or row.get("anchor_source_name"),
        "source_article_link": row.get("source_article_link") or row.get("article_link"),
        "tags": tags,
        "published_at": _to_iso(row.get("published_at")),
        "significance": round(_safe_float(row.get("significance"), 0.0), 3),
        "zone": _get_zone(row, interest_map),
        "priority_score": _score_priority(
            row,
            freshness_score=freshness_score,
            interest_score=interest_score,
            source_affinity=source_affinity,
        ),
        "priority_reason": _priority_reason(
            row,
            freshness_score=freshness_score,
            interest_score=interest_score,
            source_affinity=source_affinity,
        ),
        "ai_summary": summary,
        "is_read": row.get("read_at") is not None,
        "is_processed": row.get("processed_at") is not None,
        "read_at": _to_iso(row.get("read_at")),
        "processed_at": _to_iso(row.get("processed_at")),
    }


async def list_now_items_payload(limit: int = 20) -> dict[str, Any]:
    query_limit = max(limit * 3, 60)
    rows = await get_recent_now_candidates(limit=query_limit)
    if not rows:
        return {
            "items": [],
            "generated_at": _utc_now().isoformat().replace("+00:00", "Z"),
        }

    interest_tags = await get_all_interest_tags()
    interest_map = _build_interest_weight_map(interest_tags)
    interest_scores = {
        int(row["anchor_id"]): _score_interest_match(row, interest_map)
        for row in rows
    }
    source_affinity_map = _build_source_affinity_map(rows, interest_scores)

    items: list[dict[str, Any]] = []
    for row in rows:
        if row.get("processed_at") is not None:
            continue
        source_key = str(row.get("source_id") or row.get("source_name") or "unknown")
        item = _serialize_list_item(
            row,
            interest_map=interest_map,
            interest_score=interest_scores.get(int(row["anchor_id"]), 0.0),
            source_affinity=source_affinity_map.get(source_key, 0.2),
        )
        items.append(item)

    items.sort(key=lambda item: item["priority_score"], reverse=True)
    return {
        "items": items[:limit],
        "generated_at": _utc_now().isoformat().replace("+00:00", "Z"),
    }


async def get_now_detail_payload(anchor_id: int) -> Optional[dict[str, Any]]:
    row = await get_now_detail_row(anchor_id)
    if not row:
        return None

    await touch_article_last_opened_by_anchor(anchor_id)

    interest_tags = await get_all_interest_tags()
    interest_map = _build_interest_weight_map(interest_tags)
    interest_score = _score_interest_match(row, interest_map)
    source_affinity_map = _build_source_affinity_map([row], {int(row["anchor_id"]): interest_score})
    source_key = str(row.get("source_id") or row.get("source_name") or "unknown")
    source_affinity = source_affinity_map.get(source_key, 0.2)
    summary = _choose_summary(row)
    freshness_score = _score_freshness(row)

    return {
        "anchor_id": int(row["anchor_id"]),
        "article_id": int(row["article_id"]),
        "title": row.get("anchor_title") or row.get("article_title"),
        "source_name": row.get("source_name") or row.get("anchor_source_name"),
        "source_article_link": row.get("source_article_link") or row.get("article_link"),
        "zone": _get_zone(row, interest_map),
        "priority_score": _score_priority(
            row,
            freshness_score=freshness_score,
            interest_score=interest_score,
            source_affinity=source_affinity,
        ),
        "priority_reason": _priority_reason(
            row,
            freshness_score=freshness_score,
            interest_score=interest_score,
            source_affinity=source_affinity,
        ),
        "ai_summary": summary,
        "dialectical_analysis": (row.get("dialectical_analysis") or "").strip() or None,
        "body_markdown": _build_body_markdown(row, summary),
        "article_title": row.get("article_title"),
        "article_link": row.get("article_link"),
        "published_at": _to_iso(row.get("published_at")),
        "tags": _normalize_tags(row.get("tags")),
        "is_read": row.get("read_at") is not None,
        "is_processed": row.get("processed_at") is not None,
        "read_at": _to_iso(row.get("read_at")),
        "processed_at": _to_iso(row.get("processed_at")),
    }


async def update_now_state_payload(
    anchor_id: int,
    *,
    mark_read: bool,
    mark_processed: bool,
) -> Optional[dict[str, Any]]:
    state = await update_article_workbench_state_by_anchor(
        anchor_id,
        mark_read=mark_read,
        mark_processed=mark_processed,
    )
    if not state:
        return None

    return {
        "anchor_id": int(anchor_id),
        "article_id": int(state["article_id"]),
        "is_read": state.get("read_at") is not None,
        "is_processed": state.get("processed_at") is not None,
        "read_at": _to_iso(state.get("read_at")),
        "processed_at": _to_iso(state.get("processed_at")),
    }
