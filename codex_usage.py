"""Read daily Codex token totals from local session usage events only."""

from __future__ import annotations

import json
import re
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any


SHANGHAI = timezone(timedelta(hours=8))
TOKEN_EVENT_MARKER = re.compile(rb'"type"\s*:\s*"token_count"')
USAGE_FIELDS = {
    "input_tokens": "inputTokens",
    "output_tokens": "outputTokens",
    "cached_input_tokens": "cachedInputTokens",
}


class CodexUsageError(ValueError):
    pass


def _skip_string(raw: bytes, start: int) -> int | None:
    if start >= len(raw) or raw[start] != 0x22:
        return None
    index = start + 1
    while index < len(raw):
        byte = raw[index]
        if byte == 0x5C:
            index += 2
            continue
        if byte == 0x22:
            return index + 1
        index += 1
    return None


def _skip_value(raw: bytes, start: int) -> int | None:
    while start < len(raw) and raw[start] in b" \t\r\n":
        start += 1
    if start >= len(raw):
        return None
    if raw[start] == 0x22:
        return _skip_string(raw, start)
    closing = {0x7B: 0x7D, 0x5B: 0x5D}
    if raw[start] in closing:
        stack = [closing[raw[start]]]
        index = start + 1
        while index < len(raw) and stack:
            byte = raw[index]
            if byte == 0x22:
                string_end = _skip_string(raw, index)
                if string_end is None:
                    return None
                index = string_end
                continue
            if byte in closing:
                stack.append(closing[byte])
            elif byte in (0x7D, 0x5D):
                if not stack or byte != stack[-1]:
                    return None
                stack.pop()
            index += 1
        return index if not stack else None
    index = start
    while index < len(raw) and raw[index] not in b",]} \t\r\n":
        index += 1
    return index if index > start else None


def _object_member_span(raw: bytes, start: int, wanted: str) -> tuple[int, int] | None:
    while start < len(raw) and raw[start] in b" \t\r\n":
        start += 1
    if start >= len(raw) or raw[start] != 0x7B:
        return None
    index = start + 1
    while index < len(raw):
        while index < len(raw) and raw[index] in b" \t\r\n,":
            index += 1
        if index >= len(raw) or raw[index] == 0x7D:
            return None
        key_end = _skip_string(raw, index)
        if key_end is None:
            return None
        try:
            key = json.loads(raw[index:key_end])
        except (json.JSONDecodeError, UnicodeDecodeError):
            return None
        index = key_end
        while index < len(raw) and raw[index] in b" \t\r\n":
            index += 1
        if index >= len(raw) or raw[index] != 0x3A:
            return None
        value_start = index + 1
        value_end = _skip_value(raw, value_start)
        if value_end is None:
            return None
        while value_start < value_end and raw[value_start] in b" \t\r\n":
            value_start += 1
        if key == wanted:
            return value_start, value_end
        index = value_end
    return None


def _decode_span(raw: bytes, span: tuple[int, int] | None) -> Any:
    if span is None:
        return None
    try:
        return json.loads(raw[span[0]:span[1]])
    except (json.JSONDecodeError, UnicodeDecodeError):
        return None


def _token_usage_event(raw: bytes) -> tuple[str | None, datetime | None, dict[str, Any] | None] | None:
    if not TOKEN_EVENT_MARKER.search(raw):
        return None
    event_type = _decode_span(raw, _object_member_span(raw, 0, "type"))
    payload_span = _object_member_span(raw, 0, "payload")
    if event_type != "event_msg" or payload_span is None:
        return None
    payload_start = payload_span[0]
    if _decode_span(raw, _object_member_span(raw, payload_start, "type")) != "token_count":
        return None
    info_span = _object_member_span(raw, payload_start, "info")
    total_span = _object_member_span(raw, info_span[0], "total_token_usage") if info_span else None
    totals: dict[str, Any] | None = None
    if total_span:
        totals = {
            source_key: _decode_span(raw, _object_member_span(raw, total_span[0], source_key))
            for source_key, key in USAGE_FIELDS.items()
        }
    event_id = _decode_span(raw, _object_member_span(raw, 0, "id"))
    timestamp_text = _decode_span(raw, _object_member_span(raw, 0, "timestamp"))
    return event_id if isinstance(event_id, str) else None, _event_timestamp(timestamp_text), totals


def _valid_date(value: str) -> date | None:
    if not isinstance(value, str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
        return None
    try:
        return date.fromisoformat(value)
    except ValueError:
        return None


def _session_folder_date(path: Path, root: Path) -> date | None:
    try:
        parts = path.parent.relative_to(root).parts
        if len(parts) < 3:
            return None
        return date(int(parts[-3]), int(parts[-2]), int(parts[-1]))
    except (ValueError, OSError):
        return None


def _event_timestamp(value: Any) -> datetime | None:
    if not isinstance(value, str):
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            return None
        return parsed.astimezone(timezone.utc)
    except ValueError:
        return None


def _empty_totals() -> dict[str, int]:
    return {key: 0 for key in USAGE_FIELDS}


def summarize_codex_usage(
    sessions_dir: Path,
    start_date: str,
    end_date: str,
    *,
    now: datetime | None = None,
) -> dict[str, Any]:
    """Return only aggregated token metadata. Conversation events are never parsed."""
    start = _valid_date(start_date)
    end = _valid_date(end_date)
    if not start or not end or start > end:
        raise CodexUsageError("日期范围无效。")
    if (end - start).days + 1 > 366:
        raise CodexUsageError("自定义日期范围最多 366 天。")

    current = now or datetime.now(SHANGHAI)
    today = current.astimezone(SHANGHAI).date()
    if end > today:
        raise CodexUsageError("结束日期不能晚于今天。")

    complete = True
    field_available = {key: True for key in USAGE_FIELDS}
    counters_by_session: dict[str, dict[str, int | None]] = {}
    seen_event_ids: set[str] = set()
    totals_by_date: dict[str, dict[str, int]] = {}
    coverage_dates: list[date] = []
    latest_event: datetime | None = None

    try:
        paths = sorted(sessions_dir.rglob("*.jsonl"))
    except OSError:
        paths = []
        complete = False

    if not sessions_dir.is_dir():
        complete = False

    for path in paths:
        folder_date = _session_folder_date(path, sessions_dir)
        if folder_date and folder_date <= today:
            coverage_dates.append(folder_date)
        session_key = path.stem
        previous = counters_by_session.setdefault(session_key, {key: None for key in USAGE_FIELDS})
        try:
            stream = path.open("rb")
        except OSError:
            complete = False
            continue

        with stream:
            for raw_line in stream:
                event_data = _token_usage_event(raw_line)
                if event_data is None:
                    continue
                event_id, stamp, cumulative = event_data
                if event_id and event_id in seen_event_ids:
                    continue
                if event_id:
                    seen_event_ids.add(event_id)
                if stamp is None or not isinstance(cumulative, dict):
                    complete = False
                    continue
                local_stamp = stamp.astimezone(SHANGHAI)
                event_date = local_stamp.date()
                if event_date > today:
                    complete = False
                    continue
                coverage_dates.append(event_date)
                if latest_event is None or stamp > latest_event:
                    latest_event = stamp

                day_key = event_date.isoformat()
                day_totals = totals_by_date.setdefault(day_key, _empty_totals())
                for source_key in USAGE_FIELDS:
                    value = cumulative.get(source_key)
                    if type(value) is not int or value < 0:
                        field_available[source_key] = False
                        previous[source_key] = None
                        continue
                    prior = previous[source_key]
                    if prior is not None and value < prior:
                        complete = False
                        previous[source_key] = value
                        continue
                    delta = value if prior is None else value - prior
                    previous[source_key] = value
                    if start <= event_date <= end and field_available[source_key]:
                        day_totals[source_key] += delta

    coverage_start = min(coverage_dates).isoformat() if coverage_dates else None
    coverage_end = max(coverage_dates).isoformat() if coverage_dates else None
    days = []
    for offset in range((end - start).days + 1):
        day = start + timedelta(days=offset)
        key = day.isoformat()
        covered = bool(coverage_start and coverage_end and coverage_start <= key <= coverage_end and complete)
        totals = totals_by_date.get(key, _empty_totals())
        days.append({
            "date": key,
            "available": covered,
            "inputTokens": totals["input_tokens"] if covered and field_available["input_tokens"] else None,
            "outputTokens": totals["output_tokens"] if covered and field_available["output_tokens"] else None,
            "cachedInputTokens": totals["cached_input_tokens"] if covered and field_available["cached_input_tokens"] else None,
        })

    return {
        "version": 1,
        "source": "本机 Codex 会话日志",
        "timezone": "Asia/Shanghai",
        "startDate": start.isoformat(),
        "endDate": end.isoformat(),
        "coverageStartDate": coverage_start,
        "coverageEndDate": coverage_end,
        "generatedAt": current.astimezone(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z"),
        "latestEventAt": latest_event.isoformat(timespec="seconds").replace("+00:00", "Z") if latest_event else None,
        "complete": complete,
        "fieldAvailability": {USAGE_FIELDS[key]: available for key, available in field_available.items()},
        "days": days,
    }
