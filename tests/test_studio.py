import hashlib
import hmac
import json
from types import SimpleNamespace as NS

import pytest

from studio.agents import team as team_mod
from studio.agents.base import REFUSAL_TEXT, Agent, Context, Tool, object_schema
from studio.channels.instagram import extract_messages, valid_signature
from studio.notify import chunks
from studio.storage import Storage


def text_block(t):
    return NS(type="text", text=t)


def tool_block(name, inp, id_="tu_1"):
    return NS(type="tool_use", name=name, input=inp, id=id_)


class FakeClient:
    """Tayyor javoblarni navbat bilan qaytaruvchi soxta Anthropic client."""

    def __init__(self, responses, route="support"):
        self.responses = list(responses)
        self.calls = []
        self._route = route
        self.beta = NS(messages=NS(create=self._create))
        self.messages = NS(parse=self._parse)

    async def _create(self, **kwargs):
        self.calls.append(kwargs)
        return self.responses.pop(0)

    async def _parse(self, **kwargs):
        return NS(stop_reason="end_turn", parsed_output=team_mod.Route(agent=self._route))


@pytest.fixture
def storage():
    return Storage(":memory:")


async def test_agent_runs_tool_then_answers(storage):
    seen = {}

    async def handler(inp, ctx):
        seen.update(inp)
        return json.dumps({"ok": True})

    agent = Agent("t", "t", "test", tools=[Tool("echo", "d", object_schema({"x": {"type": "string"}}), handler)])
    client = FakeClient(
        [
            NS(stop_reason="tool_use", content=[tool_block("echo", {"x": "salom"})]),
            NS(stop_reason="end_turn", content=[text_block("Tayyor!")]),
        ]
    )
    reply = await agent.run(client, [{"role": "user", "content": "hi"}], Context("tg", "1", storage))

    assert reply == "Tayyor!"
    assert seen == {"x": "salom"}
    second = client.calls[1]["messages"]
    assert second[-1]["content"][0]["tool_use_id"] == "tu_1"
    assert client.calls[0]["fallbacks"] == "default"


async def test_agent_tool_error_is_reported_to_model(storage):
    async def boom(inp, ctx):
        raise RuntimeError("API kalit yo'q")

    agent = Agent("t", "t", "test", tools=[Tool("boom", "d", object_schema({}), boom)])
    client = FakeClient(
        [
            NS(stop_reason="tool_use", content=[tool_block("boom", {})]),
            NS(stop_reason="end_turn", content=[text_block("Kalit sozlanmagan")]),
        ]
    )
    reply = await agent.run(client, [{"role": "user", "content": "hi"}], Context("tg", "1", storage))
    result = client.calls[1]["messages"][-1]["content"][0]
    assert result["is_error"] is True
    assert reply == "Kalit sozlanmagan"


async def test_agent_refusal(storage):
    agent = Agent("t", "t", "test")
    client = FakeClient([NS(stop_reason="refusal", content=[])])
    assert await agent.run(client, [{"role": "user", "content": "x"}], Context("tg", "1", storage)) == REFUSAL_TEXT


async def test_team_keeps_history_and_blocks_staff_agents_for_customers(storage):
    client = FakeClient(
        [
            NS(stop_reason="end_turn", content=[text_block("Javob 1")]),
            NS(stop_reason="end_turn", content=[text_block("Javob 2")]),
        ],
        route="analyst",
    )
    team = team_mod.Team(client, storage)

    await team.handle("telegram", "42", "Statistikani ko'rsat")
    # Oddiy mijoz tahlilchi agentga kira olmaydi -> support
    assert "Mijozlar menejeri" in client.calls[0]["system"]

    await team.handle("telegram", "42", "Yana", is_staff=True)
    assert "SMM tahlilchi" in client.calls[1]["system"]
    assert [m["content"] for m in client.calls[1]["messages"]] == ["Statistikani ko'rsat", "Javob 1", "Yana"]


async def test_save_lead_notifies_admin(storage, monkeypatch):
    sent = []

    async def fake_admin(text):
        sent.append(text)

    monkeypatch.setattr("studio.notify.admin", fake_admin)
    out = await team_mod.SAVE_LEAD.handler(
        {"name": "Ali", "contact": "+998901234567", "service": "AI video", "details": "15 soniyalik reklama"},
        Context("instagram", "u1", storage),
    )
    assert json.loads(out)["ok"]
    assert storage.recent_leads()[0]["name"] == "Ali"
    assert "Ali" in sent[0]


def test_history_starts_with_user(storage):
    storage.add_message("tg", "1", "assistant", "orphan")
    storage.add_message("tg", "1", "user", "salom")
    assert storage.history("tg", "1")[0] == {"role": "user", "content": "salom"}


def test_instagram_extract_skips_echo_and_self():
    payload = {
        "entry": [
            {
                "messaging": [
                    {"sender": {"id": "100"}, "message": {"text": "Narxi qancha?"}},
                    {"sender": {"id": "999"}, "message": {"text": "bizning javob", "is_echo": True}},
                    {"sender": {"id": "999"}, "message": {"text": "o'zimiz"}},
                    {"sender": {"id": "101"}, "message": {"attachments": []}},
                ]
            }
        ]
    }
    assert extract_messages(payload, own_id="999") == [("100", "Narxi qancha?")]


def test_instagram_signature():
    body = b'{"a":1}'
    sig = "sha256=" + hmac.new(b"secret", body, hashlib.sha256).hexdigest()
    assert valid_signature(body, sig, "secret")
    assert not valid_signature(body, "sha256=bad", "secret")
    assert not valid_signature(body, None, "secret")


def test_chunks():
    text = ("a" * 30 + "\n") * 10
    parts = chunks(text, size=100)
    assert all(len(p) <= 100 for p in parts)
    assert "".join(p.replace("\n", "") for p in parts) == "a" * 300
