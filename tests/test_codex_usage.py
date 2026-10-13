import json
import sys
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import codex_usage
from codex_usage import CodexUsageError, summarize_codex_usage


SHANGHAI = timezone(timedelta(hours=8))


def usage_event(event_id, timestamp, input_tokens, output_tokens, cached_tokens):
    return {
        "type": "event_msg",
        "id": event_id,
        "timestamp": timestamp,
        "payload": {
            "type": "token_count",
            "info": {
                "total_token_usage": {
                    "input_tokens": input_tokens,
                    "output_tokens": output_tokens,
                    "cached_input_tokens": cached_tokens,
                },
            },
        },
    }


class CodexUsageTests(unittest.TestCase):
    def test_cumulative_snapshots_are_incremented_deduplicated_and_bounded_by_local_coverage(self):
        with tempfile.TemporaryDirectory(dir=Path(__file__).resolve().parents[1] / "cache") as temporary:
            sessions = Path(temporary) / "2026" / "10" / "12"
            sessions.mkdir(parents=True)
            log = sessions / "session-a.jsonl"
            event_a = usage_event("token-a", "2026-10-12T15:30:00Z", 20, 4, 12)
            event_b = usage_event("token-b", "2026-10-12T16:30:00Z", 32, 9, 18)
            chat = {"type": "event_msg", "payload": {"type": "user_message", "message": 'private chat body {"type":"token_count","input_tokens":999999}'}}
            log.write_text("\n".join(map(json.dumps, [chat, event_a, event_b, event_b])) + "\n", encoding="utf-8")

            original_loads = json.loads

            def metadata_only_loads(value, *args, **kwargs):
                if isinstance(value, bytes) and b"private chat body" in value:
                    raise AssertionError("chat body must never be decoded")
                return original_loads(value, *args, **kwargs)

            with patch.object(codex_usage.json, "loads", side_effect=metadata_only_loads):
                payload = summarize_codex_usage(
                    Path(temporary),
                    "2026-10-10",
                    "2026-10-13",
                    now=datetime(2026, 10, 13, 12, tzinfo=SHANGHAI),
                )

        self.assertEqual(payload["coverageStartDate"], "2026-10-12")
        self.assertEqual(payload["coverageEndDate"], "2026-10-13")
        self.assertEqual(payload["fieldAvailability"], {"inputTokens": True, "outputTokens": True, "cachedInputTokens": True})
        self.assertEqual(payload["days"][0], {"date": "2026-10-10", "available": False, "inputTokens": None, "outputTokens": None, "cachedInputTokens": None})
        self.assertEqual(payload["days"][2], {"date": "2026-10-12", "available": True, "inputTokens": 20, "outputTokens": 4, "cachedInputTokens": 12})
        self.assertEqual(payload["days"][3], {"date": "2026-10-13", "available": True, "inputTokens": 12, "outputTokens": 5, "cachedInputTokens": 6})
        self.assertNotIn("private chat body", json.dumps(payload))

    def test_missing_token_fields_are_explicitly_unavailable(self):
        with tempfile.TemporaryDirectory(dir=Path(__file__).resolve().parents[1] / "cache") as temporary:
            sessions = Path(temporary) / "2026" / "10" / "13"
            sessions.mkdir(parents=True)
            event = usage_event("token-a", "2026-10-13T04:00:00Z", 50, 12, 20)
            del event["payload"]["info"]["total_token_usage"]["output_tokens"]
            (sessions / "session-b.jsonl").write_text(json.dumps(event) + "\n", encoding="utf-8")
            payload = summarize_codex_usage(Path(temporary), "2026-10-13", "2026-10-13", now=datetime(2026, 10, 13, 12, tzinfo=SHANGHAI))

        self.assertTrue(payload["complete"])
        self.assertFalse(payload["fieldAvailability"]["outputTokens"])
        self.assertIsNone(payload["days"][0]["outputTokens"])
        self.assertEqual(payload["days"][0]["inputTokens"], 50)

    def test_invalid_and_overlong_ranges_are_rejected(self):
        with tempfile.TemporaryDirectory(dir=Path(__file__).resolve().parents[1] / "cache") as temporary:
            with self.assertRaises(CodexUsageError):
                summarize_codex_usage(Path(temporary), "2026-10-13", "2026-10-12")
            with self.assertRaises(CodexUsageError):
                summarize_codex_usage(Path(temporary), "2025-10-12", "2026-10-13", now=datetime(2026, 10, 13, tzinfo=SHANGHAI))


if __name__ == "__main__":
    unittest.main()
