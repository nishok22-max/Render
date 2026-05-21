"""
ThinkSync — Parsers V2 Core
Base interfaces and NormalizedDocument schema for the modular parser system.
"""
from __future__ import annotations

import time
import uuid
import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Dict, Iterator, List, Optional

logger = logging.getLogger("thinksync.parsers_v2.core")


# ─── Normalized Document ──────────────────────────────────────────────────────

@dataclass
class NormalizedDocument:
    """
    Standardized output from all V2 parsers.
    Each parser yields one or more of these, enabling streaming.
    The `content` field is what ultimately gets embedded.
    """
    content: str
    file_type: str
    source: str
    chunk_id: str = ""
    structural_info: Dict[str, Any] = field(default_factory=dict)
    metadata: Dict[str, Any] = field(default_factory=dict)
    timestamps: Dict[str, float] = field(default_factory=dict)

    def __post_init__(self):
        if not self.chunk_id:
            self.chunk_id = str(uuid.uuid4())
        if "ingestion_time" not in self.timestamps:
            self.timestamps["ingestion_time"] = time.time()

    def to_text(self) -> str:
        """Return content as plain text for legacy pipeline compatibility."""
        return self.content


# ─── Base Parser Interface ────────────────────────────────────────────────────

class BaseParser(ABC):
    """
    All V2 parsers inherit from this base class.
    Contract:
      - parse() takes a file_path and returns an Iterator of NormalizedDocuments.
      - Parsers MUST NOT crash; they must catch exceptions and yield error docs.
      - Parsers should support streaming for large files.
    """

    # Human-readable name for logging
    name: str = "base"

    # Maximum file size this parser accepts (bytes). 0 = no limit.
    max_file_size: int = 0

    # Extensions this parser handles
    supported_extensions: List[str] = []

    @abstractmethod
    def parse(self, file_path: str) -> Iterator[NormalizedDocument]:
        """
        Parse a file and yield NormalizedDocuments.
        Each yielded document represents a logical chunk of the file.
        """
        raise NotImplementedError

    def _make_error_doc(self, file_path: str, error: str, ext: str = "") -> NormalizedDocument:
        """Helper to create a standardized error document."""
        return NormalizedDocument(
            content=f"[{self.name} parsing error: {error}]",
            file_type=ext or "unknown",
            source=file_path,
            metadata={"error": True, "error_message": error},
        )

    def _validate_file_size(self, file_path: str) -> Optional[str]:
        """Check file size against limit. Returns error message or None."""
        import os
        if self.max_file_size > 0:
            try:
                size = os.path.getsize(file_path)
                if size > self.max_file_size:
                    limit_mb = self.max_file_size / (1024 * 1024)
                    actual_mb = size / (1024 * 1024)
                    return f"File too large ({actual_mb:.1f} MB). Limit: {limit_mb:.1f} MB"
            except OSError as e:
                return f"Cannot read file: {e}"
        return None
