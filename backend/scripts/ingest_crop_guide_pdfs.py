"""Ingest Indian Crops PDF guides into the RAG vector store.

Reads Indian_Crops_160_Complete_Guide.pdf and Indian_Crops_120_Complete_Guide.pdf
from backend/data/pdf_guides/, parses per-crop sections, creates PriceChunk objects
with chunk_type="crop_guide", embeds them (with mock fallback), and writes to
backend/data/rag_docs/crop_guide_chunks.json.

Run once locally or as a Cloud Run Job:
    cd backend && uv run python scripts/ingest_crop_guide_pdfs.py
"""

from __future__ import annotations

import hashlib
import json
import logging
import re
import subprocess
import sys
import tempfile
from pathlib import Path

# Ensure UTF-8 output on Windows
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

# Make sure backend root is on the path
SCRIPT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = SCRIPT_DIR.parent
sys.path.insert(0, str(BACKEND_DIR))

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("CropGuideIngestion")

PDF_DIR = BACKEND_DIR / "data" / "pdf_guides"
OUTPUT_FILE = BACKEND_DIR / "data" / "rag_docs" / "crop_guide_chunks.json"
VECTOR_STORE_FILE = BACKEND_DIR / "data" / "rag_docs" / "vector_store.json"

PDF_FILES = [
    ("Indian_Crops_160_Complete_Guide.pdf", "crop_guide_160"),
    ("Indian_Crops_120_Complete_Guide.pdf", "crop_guide_120"),
]

# Pattern: "N. CropName  optional_hindi_name" at start of a line
CROP_HEADER_RE = re.compile(
    r"^(\d{1,3})\.\s+([A-Z][A-Za-z\s\(\)/&\-]+?)(?:\s{3,}|\s*$)",
    re.MULTILINE,
)


def extract_text_from_pdf(pdf_path: Path) -> str:
    """Extract text from PDF using pdftotext (poppler-utils)."""
    with tempfile.NamedTemporaryFile(suffix=".txt", delete=False) as tmp:
        tmp_path = tmp.name

    try:
        result = subprocess.run(
            ["pdftotext", "-layout", str(pdf_path), tmp_path],
            capture_output=True,
            text=True,
            timeout=60,
        )
        if result.returncode != 0:
            raise RuntimeError(f"pdftotext failed: {result.stderr}")
        with open(tmp_path, encoding="utf-8", errors="replace") as f:
            return f.read()
    finally:
        Path(tmp_path).unlink(missing_ok=True)


def clean_block(text: str) -> str:
    """Collapse multi-whitespace, strip page headers/footers, normalise newlines."""
    # Remove page footers like "Indian Crops: ... Page N"
    text = re.sub(r"Indian Crops:.*?Page\s+\d+", "", text, flags=re.IGNORECASE | re.DOTALL)
    # Collapse lines of only spaces/dashes
    text = re.sub(r"\n[ \t\-_=]{10,}\n", "\n", text)
    # Collapse multiple blank lines to one
    text = re.sub(r"\n{3,}", "\n\n", text)
    # Collapse runs of whitespace within a line (preserve single newlines)
    lines = []
    for line in text.splitlines():
        lines.append(re.sub(r"[ \t]{2,}", " ", line).strip())
    return "\n".join(lines).strip()


def split_into_crop_sections(full_text: str) -> list[tuple[int, str, str]]:
    """Split text into (crop_number, crop_name, section_text) tuples."""
    matches = list(CROP_HEADER_RE.finditer(full_text))
    sections = []
    for i, m in enumerate(matches):
        num = int(m.group(1))
        name = m.group(2).strip().title()
        start = m.start()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(full_text)
        section_text = clean_block(full_text[start:end])
        sections.append((num, name, section_text))
    return sections


def make_chunk_id(source_id: str, crop_num: int, section: str) -> str:
    key = f"{source_id}:{crop_num}:{section}"
    return "cg_" + hashlib.md5(key.encode()).hexdigest()[:16]


def crop_key_from_name(name: str) -> str:
    """e.g. 'Red Chilli' → 'red_chilli'"""
    return re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_")


def split_disease_section(section_text: str) -> tuple[str, str]:
    """Split crop section into (overview_text, diseases_text)."""
    # Disease section starts with the disease table header
    disease_header_re = re.compile(
        r"Disease\s*/\s*pest\s+Key signs", re.IGNORECASE
    )
    m = disease_header_re.search(section_text)
    if m:
        return section_text[: m.start()].strip(), section_text[m.start() :].strip()
    return section_text.strip(), ""


def make_overview_chunk(
    crop_num: int,
    crop_name: str,
    overview_text: str,
    source_id: str,
) -> dict:
    """Build a PriceChunk-compatible dict for the crop overview."""
    text = (
        f"Crop Guide — {crop_name} (No. {crop_num}): {overview_text[:1200]}"
    )
    return {
        "chunk_id": make_chunk_id(source_id, crop_num, "overview"),
        "text": text,
        "metadata": {
            "chunk_type": "crop_guide",
            "section": "overview",
            "crop_name": crop_name,
            "crop_key": crop_key_from_name(crop_name),
            "crop_number": crop_num,
            "source_pdf": source_id,
            "is_cibrc_validated": False,
            "data_source": "crop_guide_pdf",
        },
        "embedding": None,
    }


def make_disease_chunks(
    crop_num: int,
    crop_name: str,
    diseases_text: str,
    source_id: str,
) -> list[dict]:
    """Split disease text into one chunk per disease block (max 800 chars each)."""
    if not diseases_text:
        return []

    # Split at disease entries — each starts with a capitalized disease name at line start
    disease_entry_re = re.compile(r"\n(?=[A-Z][a-zA-Z /\(\)]+\s+[A-Z])", re.MULTILINE)
    blocks = disease_entry_re.split(diseases_text)

    chunks = []
    for i, block in enumerate(blocks):
        block = block.strip()
        if len(block) < 30:
            continue
        text = f"Disease advisory — {crop_name}: {block[:900]}"
        chunks.append({
            "chunk_id": make_chunk_id(source_id, crop_num, f"disease_{i}"),
            "text": text,
            "metadata": {
                "chunk_type": "crop_guide",
                "section": "disease",
                "crop_name": crop_name,
                "crop_key": crop_key_from_name(crop_name),
                "crop_number": crop_num,
                "source_pdf": source_id,
                "is_cibrc_validated": False,
                "data_source": "crop_guide_pdf",
            },
            "embedding": None,
        })
    return chunks


def embed_chunks(chunks: list[dict]) -> list[dict]:
    """Embed text for each chunk using VertexAIEmbedder (mock fallback)."""
    try:
        from app.ingestion.embedder import VertexAIEmbedder
        from app.ingestion.models import PriceChunk

        embedder = VertexAIEmbedder()
        price_chunks = [
            PriceChunk(chunk_id=c["chunk_id"], text=c["text"], metadata=c["metadata"])
            for c in chunks
        ]
        embedded = embedder.embed_chunks(price_chunks, batch_size=20, fallback_to_mock=True)
        for orig, emb in zip(chunks, embedded, strict=False):
            orig["embedding"] = emb.embedding
        logger.info("Embedded %d chunks", len(chunks))
    except Exception as exc:
        logger.warning("Embedding failed (%s); chunks saved without embeddings", exc)
    return chunks


def load_existing_vector_store() -> list[dict]:
    """Load existing vector store entries (to merge, not replace)."""
    if VECTOR_STORE_FILE.exists():
        try:
            with open(VECTOR_STORE_FILE, encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, list):
                    return data
        except Exception as exc:
            logger.warning("Could not read existing vector store: %s", exc)
    return []


def save_to_vector_store(new_chunks: list[dict]) -> None:
    """Merge new crop guide chunks into the vector store JSON."""
    existing = load_existing_vector_store()
    # Remove old crop_guide entries so we can replace them cleanly
    non_guide = [c for c in existing if c.get("metadata", {}).get("chunk_type") != "crop_guide"]
    merged = non_guide + [c for c in new_chunks if c.get("embedding")]
    VECTOR_STORE_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(VECTOR_STORE_FILE, "w", encoding="utf-8") as f:
        json.dump(merged, f, ensure_ascii=False, indent=2)
    logger.info(
        "Vector store updated: %d non-guide + %d crop-guide chunks = %d total",
        len(non_guide),
        len([c for c in new_chunks if c.get("embedding")]),
        len(merged),
    )


def run_ingestion() -> list[dict]:
    all_chunks: list[dict] = []
    seen_crop_keys: set[str] = set()  # use 160-crop guide (richer) as primary source

    for pdf_filename, source_id in PDF_FILES:
        pdf_path = PDF_DIR / pdf_filename
        if not pdf_path.exists():
            logger.warning("PDF not found: %s — skipping", pdf_path)
            continue

        logger.info("Extracting text from %s ...", pdf_filename)
        try:
            full_text = extract_text_from_pdf(pdf_path)
        except Exception as exc:
            logger.error("Failed to extract %s: %s", pdf_filename, exc)
            continue

        sections = split_into_crop_sections(full_text)
        logger.info("Found %d crop sections in %s", len(sections), pdf_filename)

        for crop_num, crop_name, section_text in sections:
            key = crop_key_from_name(crop_name)
            # Skip duplicates: 160-crop guide runs first and is authoritative
            if key in seen_crop_keys:
                continue
            seen_crop_keys.add(key)

            overview, diseases = split_disease_section(section_text)
            all_chunks.append(
                make_overview_chunk(crop_num, crop_name, overview, source_id)
            )
            all_chunks.extend(
                make_disease_chunks(crop_num, crop_name, diseases, source_id)
            )

    logger.info("Created %d total chunks from %d crops", len(all_chunks), len(seen_crop_keys))

    # Embed
    all_chunks = embed_chunks(all_chunks)

    # Save chunks file
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(all_chunks, f, ensure_ascii=False, indent=2)
    logger.info("Saved %d chunks to %s", len(all_chunks), OUTPUT_FILE)

    # Merge into vector store
    save_to_vector_store(all_chunks)

    return all_chunks


if __name__ == "__main__":
    chunks = run_ingestion()
    embedded_count = sum(1 for c in chunks if c.get("embedding"))
    logger.info(
        "Done. %d chunks total, %d with embeddings.",
        len(chunks),
        embedded_count,
    )
