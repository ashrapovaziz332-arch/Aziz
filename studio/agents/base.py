"""Agentlar uchun umumiy asos: Claude bilan tool-use sikli."""

import json
import logging
from dataclasses import dataclass, field
from typing import Any, Awaitable, Callable

import anthropic

from studio.config import settings

log = logging.getLogger(__name__)

# Xavfsizlik klassifikatori so'rovni rad etsa, Anthropic tavsiya qilgan zaxira modelda
# server tomonida qayta bajariladi.
FALLBACK_BETA = "server-side-fallback-2026-07-01"
MAX_TOOL_ROUNDS = 8

REFUSAL_TEXT = "Kechirasiz, bu so'rovga javob bera olmayman. Boshqa savolingiz bo'lsa, yozing!"
ERROR_TEXT = "Hozir texnik nosozlik bor. Iltimos, birozdan keyin qayta yozing."


@dataclass
class Context:
    """Bitta so'rov konteksti: qaysi kanal, qaysi foydalanuvchi."""

    channel: str
    user_id: str
    storage: Any


ToolHandler = Callable[[dict, Context], Awaitable[str]]


@dataclass
class Tool:
    name: str
    description: str
    input_schema: dict
    handler: ToolHandler

    def definition(self) -> dict:
        return {
            "name": self.name,
            "description": self.description,
            "input_schema": self.input_schema,
            "strict": True,
        }


def object_schema(properties: dict, required: list[str] | None = None) -> dict:
    return {
        "type": "object",
        "properties": properties,
        "required": required if required is not None else list(properties),
        "additionalProperties": False,
    }


@dataclass
class Agent:
    name: str
    role: str
    system_prompt: str
    tools: list[Tool] = field(default_factory=list)
    effort: str = "medium"
    max_tokens: int = 16000

    def _system(self) -> str:
        info = f"\n\nStudiya haqida ma'lumot:\n{settings.studio_info}" if settings.studio_info else ""
        return f"Siz {settings.studio_name} jamoasidagi '{self.name}' agentisiz.\n{self.system_prompt}{info}"

    async def run(self, client: anthropic.AsyncAnthropic, messages: list[dict], ctx: Context) -> str:
        """Agentni ishga tushiradi va yakuniy matnli javobni qaytaradi."""
        messages = list(messages)
        tools_by_name = {t.name: t for t in self.tools}
        kwargs: dict[str, Any] = {}
        if self.tools:
            kwargs["tools"] = [t.definition() for t in self.tools]

        for _ in range(MAX_TOOL_ROUNDS):
            try:
                response = await client.beta.messages.create(
                    model=settings.claude_model,
                    max_tokens=self.max_tokens,
                    system=self._system(),
                    messages=messages,
                    output_config={"effort": self.effort},
                    betas=[FALLBACK_BETA],
                    fallbacks="default",
                    **kwargs,
                )
            except anthropic.RateLimitError:
                log.warning("%s: rate limit", self.name)
                return ERROR_TEXT
            except anthropic.APIStatusError as e:
                log.error("%s: API xatosi %s (request_id=%s)", self.name, e.status_code, e.request_id)
                return ERROR_TEXT
            except anthropic.APIConnectionError:
                log.error("%s: tarmoq xatosi", self.name)
                return ERROR_TEXT

            if response.stop_reason == "refusal":
                return REFUSAL_TEXT

            if response.stop_reason == "pause_turn":
                messages.append({"role": "assistant", "content": response.content})
                continue

            tool_uses = [b for b in response.content if b.type == "tool_use"]
            if response.stop_reason != "tool_use" or not tool_uses:
                text = "\n".join(b.text for b in response.content if b.type == "text").strip()
                return text or ERROR_TEXT

            messages.append({"role": "assistant", "content": response.content})
            results = []
            for block in tool_uses:
                tool = tools_by_name.get(block.name)
                try:
                    if tool is None:
                        raise ValueError(f"Noma'lum tool: {block.name}")
                    output = await tool.handler(dict(block.input), ctx)
                    results.append({"type": "tool_result", "tool_use_id": block.id, "content": output})
                except Exception as e:  # tool xatosini Claude'ga qaytaramiz, u o'zi hal qiladi
                    log.exception("%s: tool %s xatosi", self.name, block.name)
                    results.append(
                        {
                            "type": "tool_result",
                            "tool_use_id": block.id,
                            "content": json.dumps({"error": str(e)}),
                            "is_error": True,
                        }
                    )
            messages.append({"role": "user", "content": results})

        log.warning("%s: tool sikllari chegarasiga yetdi", self.name)
        return ERROR_TEXT
