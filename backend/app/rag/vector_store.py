"""Vector store implementations for agricultural RAG retrieval."""

import json
import logging
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Any

from app.ingestion.models import PriceChunk
from app.rag.models import SearchResult
from app.settings import settings

logger = logging.getLogger(__name__)


def cosine_similarity(v1: list[float], v2: list[float]) -> float:
    """Compute cosine similarity between two float vectors."""
    if len(v1) != len(v2) or not v1:
        return 0.0

    dot = sum(a * b for a, b in zip(v1, v2, strict=False))
    norm_a = sum(a * a for a in v1) ** 0.5
    norm_b = sum(b * b for b in v2) ** 0.5

    if norm_a == 0.0 or norm_b == 0.0:
        return 0.0

    raw = dot / (norm_a * norm_b)
    # Clamp to [0.0, 1.0] for normalized distance scores
    val = (raw + 1.0) / 2.0 if raw < 0.0 else raw
    return float(max(0.0, min(1.0, val)))


class BaseVectorStore(ABC):
    """Abstract interface for storing and searching chunk vector embeddings."""

    @abstractmethod
    def add_chunks(self, chunks: list[PriceChunk]) -> int:
        """Add chunks with embeddings to the vector store."""

    @abstractmethod
    def search(
        self,
        query_vector: list[float],
        top_k: int = 5,
        filter_metadata: dict[str, Any] | None = None,
    ) -> list[SearchResult]:
        """Search for the most similar chunks matching query vector and metadata filter."""

    @abstractmethod
    def count(self) -> int:
        """Return total number of indexed vectors."""

    @abstractmethod
    def clear(self) -> None:
        """Clear all stored vectors."""


class LocalVectorStore(BaseVectorStore):
    """Local JSON-persisted vector store supporting metadata filtering and cosine search."""

    def __init__(self, persistence_path: Path | str | None = None) -> None:
        self.persistence_path = Path(persistence_path or settings.vector_store_path)
        self._chunks: dict[str, dict[str, Any]] = {}
        self._load()

    def _load(self) -> None:
        """Load indexed chunks from disk if existing."""
        if self.persistence_path.exists():
            try:
                with open(self.persistence_path, encoding="utf-8") as f:
                    data = json.load(f)
                    if isinstance(data, list):
                        self._chunks = {
                            item["chunk_id"]: item for item in data if "chunk_id" in item
                        }
                logger.info("Loaded %d vectors from %s", len(self._chunks), self.persistence_path)
            except Exception as exc:
                logger.warning("Could not read vector store at %s: %s", self.persistence_path, exc)
                self._chunks = {}

    def _save(self) -> None:
        """Persist indexed chunks to disk."""
        self.persistence_path.parent.mkdir(parents=True, exist_ok=True)
        try:
            with open(self.persistence_path, "w", encoding="utf-8") as f:
                json.dump(list(self._chunks.values()), f, indent=2)
            logger.info("Persisted %d vectors to %s", len(self._chunks), self.persistence_path)
        except Exception as exc:
            logger.error("Failed to persist vector store to %s: %s", self.persistence_path, exc)

    def add_chunks(self, chunks: list[PriceChunk]) -> int:
        """Index a batch of PriceChunk objects that have vector embeddings."""
        added = 0
        for chunk in chunks:
            if not chunk.embedding:
                logger.debug("Skipping chunk %s without embedding", chunk.chunk_id)
                continue
            self._chunks[chunk.chunk_id] = {
                "chunk_id": chunk.chunk_id,
                "text": chunk.text,
                "metadata": chunk.metadata,
                "embedding": chunk.embedding,
            }
            added += 1

        if added > 0:
            self._save()
        return added

    def search(
        self,
        query_vector: list[float],
        top_k: int = 5,
        filter_metadata: dict[str, Any] | None = None,
    ) -> list[SearchResult]:
        """Search top-k chunks with metadata filtering."""
        if not self._chunks:
            return []

        candidates: list[dict[str, Any]] = list(self._chunks.values())

        # Metadata filtering
        if filter_metadata:
            candidates = [
                c
                for c in candidates
                if self._matches_filter(c.get("metadata", {}), filter_metadata)
            ]

        if not candidates:
            return []

        scored_results: list[SearchResult] = []
        for candidate in candidates:
            vec = candidate.get("embedding", [])
            score = cosine_similarity(query_vector, vec)
            scored_results.append(
                SearchResult(
                    chunk_id=candidate["chunk_id"],
                    text=candidate["text"],
                    score=round(score, 4),
                    metadata=candidate.get("metadata", {}),
                )
            )

        # Sort descending by score
        scored_results.sort(key=lambda x: x.score, reverse=True)
        return scored_results[:top_k]

    @staticmethod
    def _matches_filter(doc_meta: dict[str, Any], filter_meta: dict[str, Any]) -> bool:
        """Evaluate whether document metadata satisfies query filter conditions."""
        for key, expected in filter_meta.items():
            if expected is None:
                continue

            if key == "market_names":
                # Check if market matches any of the given nearest market names
                allowed_markets = [str(m).strip().lower() for m in expected]
                doc_market = str(doc_meta.get("market_name", "")).strip().lower()
                compared_markets = [
                    str(m).strip().lower() for m in doc_meta.get("markets_compared", [])
                ]
                matches_market = doc_market in allowed_markets or any(
                    m in allowed_markets for m in compared_markets
                )
                if not matches_market:
                    return False

            elif key == "commodity":
                doc_comm = str(doc_meta.get("commodity", "")).strip().lower()
                if doc_comm != str(expected).strip().lower():
                    return False

            elif key == "state":
                doc_state = str(doc_meta.get("state", "")).strip().lower()
                if doc_state != str(expected).strip().lower():
                    return False

            elif key == "district":
                doc_dist = str(doc_meta.get("district", "")).strip().lower()
                if doc_dist != str(expected).strip().lower():
                    return False

            elif key == "chunk_type":
                if doc_meta.get("chunk_type") != expected:
                    return False

            else:
                if doc_meta.get(key) != expected:
                    return False

        return True

    def count(self) -> int:
        return len(self._chunks)

    def clear(self) -> None:
        self._chunks.clear()
        if self.persistence_path.exists():
            self.persistence_path.unlink()


class BigQueryVectorStore(BaseVectorStore):
    """Google Cloud BigQuery Vector Search integration."""

    def __init__(
        self,
        project_id: str | None = None,
        dataset_id: str | None = None,
        table_id: str | None = None,
    ) -> None:
        self.project_id = project_id or settings.gcp_project_id
        self.dataset_id = dataset_id or settings.bigquery_dataset
        self.table_id = table_id or settings.bigquery_table
        self._fallback_store = LocalVectorStore()

    def add_chunks(self, chunks: list[PriceChunk]) -> int:
        if not self.project_id or not self.dataset_id or not self.table_id:
            logger.info("BigQuery not fully configured; using local vector store fallback.")
            return self._fallback_store.add_chunks(chunks)

        logger.info(
            "BigQuery insertion configured for %s.%s.%s (using local fallback for dev)",
            self.project_id,
            self.dataset_id,
            self.table_id,
        )
        return self._fallback_store.add_chunks(chunks)

    def search(
        self,
        query_vector: list[float],
        top_k: int = 5,
        filter_metadata: dict[str, Any] | None = None,
    ) -> list[SearchResult]:
        if not self.project_id or not self.dataset_id or not self.table_id:
            return self._fallback_store.search(query_vector, top_k, filter_metadata)

        return self._fallback_store.search(query_vector, top_k, filter_metadata)

    def count(self) -> int:
        return self._fallback_store.count()

    def clear(self) -> None:
        self._fallback_store.clear()


class VertexVectorSearchStore(BaseVectorStore):
    """Google Cloud Vertex AI Vector Search (Matching Engine) store."""

    def __init__(
        self,
        project_id: str | None = None,
        location: str | None = None,
        index_id: str | None = None,
        endpoint_id: str | None = None,
        deployed_index_id: str | None = None,
        gcs_staging_bucket: str | None = None,
    ) -> None:
        self.project_id = project_id or settings.gcp_project_id
        self.location = location or settings.gcp_location
        self.index_id = index_id or settings.vertex_index_id
        self.endpoint_id = endpoint_id or settings.vertex_endpoint_id
        self.deployed_index_id = deployed_index_id or settings.vertex_deployed_index_id
        self.gcs_staging_bucket = gcs_staging_bucket or settings.gcs_staging_bucket
        self._local_store = LocalVectorStore()

    def add_chunks(self, chunks: list[PriceChunk]) -> int:
        """Add chunks to local store and upsert datapoints to Vertex AI Vector Search."""
        local_added = self._local_store.add_chunks(chunks)

        if not self.project_id or not self.index_id:
            logger.info("Vertex Vector Search index not configured; indexed in local store.")
            return local_added

        try:
            from google.cloud import aiplatform
            from google.cloud.aiplatform.matching_engine.matching_engine_index_endpoint import (
                Namespace,
                NumericNamespace,
            )

            aiplatform.init(project=self.project_id, location=self.location)
            index = aiplatform.MatchingEngineIndex(index_name=self.index_id)

            datapoints = []
            for chunk in chunks:
                if not chunk.embedding:
                    continue
                restricts = []
                for r in chunk.metadata.get("restricts", []):
                    restricts.append(
                        Namespace(name=r["namespace"], allow_tokens=r.get("allow", []))
                    )
                numeric_restricts = []
                for nr in chunk.metadata.get("numeric_restricts", []):
                    numeric_restricts.append(
                        NumericNamespace(
                            name=nr["namespace"],
                            value_float=nr.get("value_float", 0.0),
                        )
                    )
                datapoints.append(
                    {
                        "datapoint_id": chunk.chunk_id,
                        "feature_vector": chunk.embedding,
                        "restricts": restricts,
                        "numeric_restricts": numeric_restricts,
                    }
                )

            if datapoints:
                index.upsert_datapoints(datapoints=datapoints)
                logger.info(
                    "Successfully streamed %d datapoints to Vertex AI Vector Search index %s",
                    len(datapoints),
                    self.index_id,
                )
        except Exception as exc:
            logger.warning(
                "Could not upsert datapoints directly to Vertex Vector Search (%s). "
                "Indexed locally as fallback.",
                exc,
            )

        return local_added

    def search(
        self,
        query_vector: list[float],
        top_k: int = 5,
        filter_metadata: dict[str, Any] | None = None,
    ) -> list[SearchResult]:
        """Search nearest neighbors via Vertex AI Vector Search Endpoint, fallback to local."""
        if not self.project_id or not self.endpoint_id or not self.deployed_index_id:
            return self._local_store.search(query_vector, top_k, filter_metadata)

        try:
            from google.cloud import aiplatform
            from google.cloud.aiplatform.matching_engine.matching_engine_index_endpoint import (
                Namespace,
            )

            aiplatform.init(project=self.project_id, location=self.location)
            endpoint = aiplatform.MatchingEngineIndexEndpoint(index_endpoint_name=self.endpoint_id)

            restricts = []
            if filter_metadata:
                if "commodity" in filter_metadata:
                    restricts.append(
                        Namespace(
                            name="commodity",
                            allow_tokens=[str(filter_metadata["commodity"]).strip().lower()],
                        )
                    )
                if "state" in filter_metadata:
                    restricts.append(
                        Namespace(
                            name="state",
                            allow_tokens=[str(filter_metadata["state"]).strip().lower()],
                        )
                    )

            response = endpoint.find_neighbors(
                deployed_index_id=self.deployed_index_id,
                queries=[query_vector],
                num_neighbors=top_k,
                filter=restricts if restricts else None,
            )

            results: list[SearchResult] = []
            if response and response[0]:
                for match in response[0]:
                    dp_id = match.id
                    local_chunk = self._local_store._chunks.get(dp_id)
                    text = local_chunk["text"] if local_chunk else f"Mandi datapoint {dp_id}"
                    meta = local_chunk["metadata"] if local_chunk else {}
                    results.append(
                        SearchResult(
                            chunk_id=dp_id,
                            text=text,
                            score=round(float(match.distance), 4),
                            metadata=meta,
                        )
                    )
                return results
        except Exception as exc:
            logger.warning(
                "Vertex Vector Search endpoint query failed (%s); using local search.", exc
            )

        return self._local_store.search(query_vector, top_k, filter_metadata)

    def count(self) -> int:
        return self._local_store.count()

    def clear(self) -> None:
        self._local_store.clear()


def get_vector_store() -> BaseVectorStore:
    """Factory to retrieve configured Vector Store instance."""
    v_type = settings.vector_store_type.lower()
    if v_type in ("vertex", "vertex_ai", "matching_engine"):
        return VertexVectorSearchStore()
    if v_type == "bigquery":
        return BigQueryVectorStore()
    return LocalVectorStore()
