"""Vertex AI and Gemini Text Embedding generator for RAG chunks."""

import hashlib
import logging
import math

from google import genai
from google.genai import types

from app.ingestion.models import PriceChunk
from app.settings import settings

logger = logging.getLogger(__name__)

EMBEDDING_DIM = 768


class VertexAIEmbedder:
    """Generates 768-dimensional vector embeddings using Vertex AI / Gemini Text Embedding API."""

    def __init__(
        self,
        project_id: str | None = None,
        location: str | None = None,
        api_key: str | None = None,
        model_name: str | None = None,
    ) -> None:
        self.project_id = project_id or settings.gcp_project_id
        self.location = location or settings.gcp_location
        self.api_key = api_key or settings.gemini_api_key
        self.model_name = model_name or settings.embedding_model
        self._client: genai.Client | None = None

    def _get_client(self) -> genai.Client:
        """Initialize google.genai client for Vertex AI or Gemini Developer API."""
        if self._client is not None:
            return self._client

        if self.project_id:
            # Vertex AI mode (enterprise GCP setup with service account / ADC)
            logger.info(
                "Initializing GenAI Client in Vertex AI mode (project=%s, location=%s)",
                self.project_id,
                self.location,
            )
            self._client = genai.Client(
                vertexai=True,
                project=self.project_id,
                location=self.location,
            )
        elif self.api_key:
            # Direct Gemini Developer API mode
            logger.info("Initializing GenAI Client with Gemini API key")
            self._client = genai.Client(api_key=self.api_key)
        else:
            raise ValueError(
                "Neither GCP Project ID (KS_GCP_PROJECT_ID) nor Gemini API Key (KS_GEMINI_API_KEY) "
                "is configured."
            )

        return self._client

    def embed_texts(
        self,
        texts: list[str],
        task_type: str = "RETRIEVAL_DOCUMENT",
        fallback_to_mock: bool = True,
    ) -> list[list[float]]:
        """Generate embeddings for a batch of strings.

        Args:
            texts: List of document strings to embed.
            task_type: Task type hint ('RETRIEVAL_DOCUMENT' or 'RETRIEVAL_QUERY').
            fallback_to_mock: If True, generate pseudo-vectors when credentials are missing.
        """
        if not texts:
            return []

        try:
            client = self._get_client()
            # Batch embedding call using google-genai SDK
            response = client.models.embed_content(
                model=self.model_name,
                contents=texts,
                config=types.EmbedContentConfig(
                    task_type=task_type,
                    output_dimensionality=EMBEDDING_DIM,
                ),
            )

            # Response contains a list of ContentEmbedding objects
            embeddings: list[list[float]] = []
            if hasattr(response, "embeddings") and response.embeddings:
                for item in response.embeddings:
                    values = getattr(item, "values", [])
                    embeddings.append(list(values))
            elif hasattr(response, "embedding") and response.embedding:
                # Single embedding response
                values = getattr(response.embedding, "values", [])
                embeddings.append(list(values))

            logger.info(
                "Successfully generated %d embeddings of dimension %d",
                len(embeddings),
                len(embeddings[0]) if embeddings else 0,
            )
            return embeddings

        except Exception as exc:
            logger.warning("Could not generate Vertex AI embeddings: %s", exc)
            if fallback_to_mock:
                logger.info(
                    "Falling back to deterministic mock embeddings (dimension %d).", EMBEDDING_DIM
                )
                return [self._generate_mock_embedding(t) for t in texts]
            raise

    def embed_chunks(
        self,
        chunks: list[PriceChunk],
        batch_size: int = 16,
        fallback_to_mock: bool = True,
    ) -> list[PriceChunk]:
        """Embed a list of PriceChunk objects and populate their .embedding field."""
        if not chunks:
            return []

        for i in range(0, len(chunks), batch_size):
            batch = chunks[i : i + batch_size]
            texts = [c.text for c in batch]
            batch_embeddings = self.embed_texts(
                texts,
                task_type="RETRIEVAL_DOCUMENT",
                fallback_to_mock=fallback_to_mock,
            )

            for chunk, vec in zip(batch, batch_embeddings, strict=False):
                chunk.embedding = vec

        return chunks

    @staticmethod
    def _generate_mock_embedding(text: str) -> list[float]:
        """Generate a normalized 768-dim pseudo-vector for offline test runs."""
        seed = int(hashlib.md5(text.encode("utf-8")).hexdigest()[:8], 16)
        raw_values: list[float] = []
        for i in range(EMBEDDING_DIM):
            # Deterministic pseudo-random numbers in [-1, 1]
            val = math.sin((seed + i) * 0.12345)
            raw_values.append(val)

        # L2 normalize
        norm = math.sqrt(sum(v * v for v in raw_values))
        return [v / norm for v in raw_values]
