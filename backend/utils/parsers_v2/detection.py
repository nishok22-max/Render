"""
ThinkSync — Parsers V2 File-Type Detection
MIME type + extension-based identification with security validation.
"""
from __future__ import annotations

import os
import logging
from typing import Optional, Tuple

logger = logging.getLogger("thinksync.parsers_v2.detection")

# ─── Extension → expected MIME prefix mapping ─────────────────────────────────
# Used for cross-validation: if the magic bytes disagree, we reject.

_EXT_MIME_MAP = {
    # Tabular
    "csv": "text/", "tsv": "text/", "psv": "text/", "dat": "text/",
    # Spreadsheets
    "xls": "application/", "xlsx": "application/", "xlsm": "application/", "xlsb": "application/",
    # Structured
    "json": "text/", "jsonl": "text/", "ndjson": "text/",
    "xml": "text/", "yaml": "text/", "yml": "text/",
    # Database / SQL
    "sql": "text/", "sqlite": "application/", "db": "application/",
    # Columnar / Analytics
    "parquet": "application/", "orc": "application/",
    "avro": "application/", "feather": "application/", "arrow": "application/",
    # Scientific / ML
    "hdf5": "application/", "h5": "application/",
    "mat": "application/", "pkl": "application/", "pickle": "application/",
    "joblib": "application/", "npy": "application/", "npz": "application/",
    # Images
    "jpg": "image/", "jpeg": "image/", "png": "image/",
    "bmp": "image/", "tiff": "image/", "tif": "image/",
    "gif": "image/", "webp": "image/",
}

# ─── Magic bytes for binary format validation ─────────────────────────────────

_MAGIC_SIGNATURES = {
    b"PK":          "zip_based",       # XLSX, XLSM, DOCX, ODS, etc.
    b"PAR1":        "parquet",
    b"ORC":         "orc",
    b"\x89HDF":     "hdf5",
    b"\x89PNG":     "png",
    b"\xff\xd8\xff": "jpeg",
    b"GIF8":        "gif",
    b"BM":          "bmp",
    b"RIFF":        "webp_or_avi",
    b"Obj\x01":     "avro",
    b"\x93NUMPY":   "numpy",
}

# Extensions that are dangerous and require safe-mode parsing
DANGEROUS_EXTENSIONS = {"pkl", "pickle", "joblib", "mat"}


def detect_file_type(file_path: str) -> Tuple[str, Optional[str]]:
    """
    Detect file type by extension and optionally validate with magic bytes.

    Returns:
        (extension, mime_hint)
        extension: Normalized file extension (lowercase, no dot)
        mime_hint: Best-guess MIME type or None
    """
    ext = ""
    if "." in file_path:
        ext = file_path.rsplit(".", 1)[-1].lower()

    mime_hint = None

    # Try magic bytes for binary files
    try:
        with open(file_path, "rb") as f:
            header = f.read(16)

        for signature, format_name in _MAGIC_SIGNATURES.items():
            if header.startswith(signature):
                mime_hint = f"application/{format_name}"
                break

        if not mime_hint and header:
            # Check if it looks like text
            try:
                header.decode("utf-8")
                mime_hint = "text/plain"
            except (UnicodeDecodeError, ValueError):
                mime_hint = "application/octet-stream"
    except OSError:
        pass

    return ext, mime_hint


def is_safe_extension(ext: str) -> bool:
    """Check if the extension is known and supported."""
    return ext in _EXT_MIME_MAP


def is_dangerous_format(ext: str) -> bool:
    """Check if a format requires sandboxed / safe-mode parsing."""
    return ext in DANGEROUS_EXTENSIONS


def validate_file(file_path: str) -> Tuple[bool, str]:
    """
    Pre-parse validation: check file exists, is readable, and extension is known.
    Returns (is_valid, error_message).
    """
    if not os.path.exists(file_path):
        return False, f"File not found: {file_path}"

    if not os.path.isfile(file_path):
        return False, f"Not a file: {file_path}"

    try:
        with open(file_path, "rb") as f:
            f.read(1)
    except PermissionError:
        return False, f"Permission denied: {file_path}"
    except OSError as e:
        return False, f"Cannot read file: {e}"

    ext = file_path.rsplit(".", 1)[-1].lower() if "." in file_path else ""
    if not ext:
        return False, "No file extension detected"

    if not is_safe_extension(ext):
        return False, f"Unknown or unsupported extension: .{ext}"

    return True, ""
