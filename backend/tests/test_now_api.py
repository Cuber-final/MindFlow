import importlib

import pytest
from fastapi.testclient import TestClient
from unittest.mock import AsyncMock, patch


class TestNowApiContract:
    """Contract tests for the Now workbench API."""

    @pytest.fixture
    def client(self):
        from main import app
        return TestClient(app)

    @pytest.fixture
    def now_queue_payload(self):
        return {
            "items": [
                {
                    "anchor_id": 101,
                    "priority_score": 0.98,
                    "priority_reason": "高显著性 + 高时效",
                    "ai_summary": "A new orchestration pattern makes context handoff between AI agents practical.",
                    "is_processed": False,
                    "read_at": None,
                    "processed_at": None,
                },
                {
                    "anchor_id": 102,
                    "priority_score": 0.74,
                    "priority_reason": "重要邻近信号，建议尽快处理",
                    "ai_summary": "A smaller release clarifies where lightweight models fit in real production stacks.",
                    "is_processed": False,
                    "read_at": None,
                    "processed_at": None,
                },
            ]
        }

    @pytest.fixture
    def now_detail_payload(self):
        return {
            "anchor_id": 101,
            "priority_score": 0.98,
            "priority_reason": "高显著性 + 高时效",
            "ai_summary": "A new orchestration pattern makes context handoff between AI agents practical.",
            "body_markdown": "## Why it matters\n\nThe article explains how multi-agent context can stay stable across handoffs.",
            "is_processed": False,
            "read_at": None,
            "processed_at": None,
        }

    @pytest.fixture
    def now_state_payload(self):
        return {
            "anchor_id": 101,
            "is_read": True,
            "is_processed": True,
            "read_at": "2026-04-20T09:00:00Z",
            "processed_at": "2026-04-20T09:00:00Z",
        }

    def test_list_now_items_returns_priority_queue(self, client, now_queue_payload):
        now_router = importlib.import_module("routers.now")
        list_now_items_payload = AsyncMock(return_value=now_queue_payload)

        with patch.object(
            now_router,
            "list_now_items_payload",
            new=list_now_items_payload,
        ):
            response = client.get("/api/now?limit=2")

        assert response.status_code == 200
        data = response.json()
        assert data == now_queue_payload
        assert data["items"][0]["anchor_id"] == 101
        assert data["items"][0]["priority_reason"] == "高显著性 + 高时效"
        assert data["items"][0]["priority_score"] >= data["items"][1]["priority_score"]
        assert data["items"][0]["ai_summary"]
        assert data["items"][0]["is_processed"] is False
        assert data["items"][0]["read_at"] is None
        assert data["items"][0]["processed_at"] is None
        list_now_items_payload.assert_awaited_once_with(limit=2)

    def test_get_now_detail_returns_summary_and_body_markdown(self, client, now_detail_payload):
        now_router = importlib.import_module("routers.now")
        get_now_detail_payload = AsyncMock(return_value=now_detail_payload)

        with patch.object(
            now_router,
            "get_now_detail_payload",
            new=get_now_detail_payload,
        ):
            response = client.get("/api/now/101")

        assert response.status_code == 200
        data = response.json()
        assert data == now_detail_payload
        assert data["anchor_id"] == 101
        assert data["ai_summary"]
        assert data["body_markdown"].startswith("## Why it matters")
        assert data["is_processed"] is False
        assert data["read_at"] is None
        assert data["processed_at"] is None
        get_now_detail_payload.assert_awaited_once_with(anchor_id=101)

    def test_patch_now_state_marks_read_and_processed(self, client, now_state_payload):
        now_router = importlib.import_module("routers.now")
        update_now_state_payload = AsyncMock(return_value=now_state_payload)
        request_payload = {"mark_read": True, "mark_processed": True}

        with patch.object(
            now_router,
            "update_now_state_payload",
            new=update_now_state_payload,
        ):
            response = client.patch(
                "/api/now/101/state",
                json=request_payload,
            )

        assert response.status_code == 200
        data = response.json()
        assert data == now_state_payload
        assert data["anchor_id"] == 101
        assert data["is_read"] is True
        assert data["is_processed"] is True
        assert data["read_at"] is not None
        assert data["processed_at"] is not None
        update_now_state_payload.assert_awaited_once_with(
            anchor_id=101,
            mark_read=True,
            mark_processed=True,
        )
