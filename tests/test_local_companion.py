import sys
import unittest
from pathlib import Path
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import local_companion


class CompanionOriginTests(unittest.TestCase):
    def test_workspace_origin_is_allowed(self):
        handler = SimpleNamespace(headers={
            "Origin": "https://workspace.danielxu.cn",
            "Host": "127.0.0.1:4174",
        })
        self.assertEqual(local_companion.Handler.allowed_origin(handler), "https://workspace.danielxu.cn")

    def test_unrelated_origin_is_rejected(self):
        handler = SimpleNamespace(headers={
            "Origin": "https://workspace.danielxu.cn.evil.example",
            "Host": "127.0.0.1:4174",
        })
        self.assertIsNone(local_companion.Handler.allowed_origin(handler))


if __name__ == "__main__":
    unittest.main()
