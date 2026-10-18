"""Single LLM gateway interface adhering to repository boundaries.

Key architectural properties:
1. Pure async execution (client.aio.models.generate_content) without blocking the event loop.
2. Consistent credential detection: Vertex AI when KS_GCP_PROJECT_ID is set, else Gemini API Key.
3. Strict timeout (10s) and exactly 1 retry with exponential backoff on transient errors.
4. Typed exception LLMUnavailableError raised on failure or lack of credentials (no fake text).
5. Sanitized telemetry: NEVER logs farmer prompts, queries, or image payloads.
"""

import asyncio
import logging
from typing import Any

from google import genai
from google.genai import types

from app.settings import settings

logger = logging.getLogger("KisanSethuLLMGateway")


class LLMUnavailableError(Exception):
    """Raised when the LLM service (Vertex or Gemini) is unreachable, unconfigured, or failing."""
    pass


class LLMGateway:
    """Central async gateway for all Large Language Model interactions."""

    def __init__(
        self,
        api_key: str | None = None,
        project_id: str | None = None,
        location: str | None = None,
    ) -> None:
        self.api_key = api_key or settings.gemini_api_key
        self.project_id = project_id or settings.gcp_project_id
        self.location = location or settings.gcp_location
        self.model_fast = settings.model_fast or "gemini-3.8-flash"
        self.model_strong = settings.model_strong or "gemini-3.8-flash"
        self._client: genai.Client | None = None

    def is_available(self) -> bool:
        """Check whether valid Vertex AI or Gemini API credentials are configured."""
        if (
            self.project_id
            and not self.project_id.startswith("your_")
            and "placeholder" not in self.project_id.lower()
        ):
            return True
        if (
            self.api_key
            and not self.api_key.startswith("your_")
            and "placeholder" not in self.api_key.lower()
        ):
            return True
        return False

    def _get_client(self) -> genai.Client | None:
        """Lazily initialize genai Client with consistent credential detection."""
        if self._client is not None:
            return self._client

        # Priority 1: Vertex AI when KS_GCP_PROJECT_ID is configured
        if (
            self.project_id
            and not self.project_id.startswith("your_")
            and "placeholder" not in self.project_id.lower()
        ):
            logger.info(
                "Initializing LLM Gateway in Vertex AI mode (%s in %s)",
                self.project_id,
                self.location
            )
            self._client = genai.Client(
                vertexai=True,
                project=self.project_id,
                location=self.location,
            )
        # Priority 2: Standalone Gemini API Key
        elif (
            self.api_key
            and not self.api_key.startswith("your_")
            and "placeholder" not in self.api_key.lower()
        ):
            logger.info("Initializing LLM Gateway in Gemini API Key mode.")
            self._client = genai.Client(api_key=self.api_key)
        else:
            logger.warning("No valid LLM credentials found (project_id or api_key).")
            return None

        return self._client

    async def _execute_with_retry(self, coro_factory: Any) -> Any:
        """Executes an async LLM call with a 10s timeout and 1 retry with exponential backoff.
        
        Never logs prompt contents or farmer queries on failure or retry.
        """
        timeout_seconds = 10.0
        last_exception: Exception | None = None

        for attempt in range(2):
            try:
                # Wrap execution in timeout
                return await asyncio.wait_for(coro_factory(), timeout=timeout_seconds)
            except Exception as exc:
                last_exception = exc
                if attempt == 0:
                    logger.warning(
                        "LLM call attempt 1 failed (%s: %s); retrying in 1s with backoff...",
                        exc.__class__.__name__,
                        str(exc)[:100],
                    )
                    await asyncio.sleep(1.0)
                else:
                    logger.error(
                        "LLM call failed after retry (%s: %s).",
                        exc.__class__.__name__,
                        str(exc)[:100],
                    )

        raise LLMUnavailableError(
            f"LLM generation failed after retry: {last_exception.__class__.__name__}"
        ) from last_exception

    async def generate_response(
        self,
        prompt: str,
        system_instruction: str | None = None,
        use_strong_model: bool = False,
    ) -> str:
        """Generate a grounded response asynchronously via client.aio.models.generate_content.
        
        Raises LLMUnavailableError if unconfigured or if generation fails.
        NEVER logs farmer query or prompt text.
        """
        client = self._get_client()
        if client is None:
            raise LLMUnavailableError("LLM service is not configured (missing credentials)")

        model = self.model_strong if use_strong_model else self.model_fast
        config: dict[str, Any] = {"temperature": 0.2}
        if system_instruction:
            config["system_instruction"] = system_instruction

        # Sanitized logging: log model and prompt length only, NEVER prompt content
        logger.info(
            "Executing async LLM generate_content (model=%s, prompt_len=%d)",
            model,
            len(prompt)
        )

        async def _call() -> str:
            resp = await client.aio.models.generate_content(
                model=model,
                contents=prompt,
                config=types.GenerateContentConfig(**config),
            )
            return str(resp.text or "").strip()

        result = await self._execute_with_retry(_call)
        return str(result)

    async def generate_vision_response(
        self,
        image_bytes: bytes,
        mime_type: str,
        prompt: str,
        system_instruction: str | None = None,
    ) -> str:
        """Generate response analyzing crop/leaf image asynchronously via client.aio.
        
        Raises LLMUnavailableError on failure.
        NEVER logs image payloads or farmer instructions.
        """
        client = self._get_client()
        if client is None:
            raise LLMUnavailableError("LLM vision service is not configured (missing credentials)")

        config: dict[str, Any] = {"temperature": 0.2}
        if system_instruction:
            config["system_instruction"] = system_instruction

        contents = [
            types.Part.from_bytes(data=image_bytes, mime_type=mime_type),
            prompt,
        ]

        logger.info(
            "Executing async LLM vision generate_content (model=%s, image_bytes=%d, mime=%s)",
            self.model_fast,
            len(image_bytes),
            mime_type,
        )

        async def _call() -> str:
            resp = await client.aio.models.generate_content(
                model=self.model_fast,
                contents=contents,
                config=types.GenerateContentConfig(**config),
            )
            return str(resp.text or "").strip()

        result = await self._execute_with_retry(_call)
        return str(result)


_default_gateway: LLMGateway | None = None


def get_llm_gateway() -> LLMGateway:
    """Singleton getter for the repository LLM gateway."""
    global _default_gateway
    if _default_gateway is None:
        _default_gateway = LLMGateway()
    return _default_gateway
