"""
ThinkSync — Parsers V2 Registry
Central mapping of file extensions → parser adapters.
Lazy-loads parser classes to avoid importing heavy dependencies at startup.
"""
from __future__ import annotations

import logging
from typing import Dict, Optional, TYPE_CHECKING

if TYPE_CHECKING:
    from .core import BaseParser

logger = logging.getLogger("thinksync.parsers_v2.registry")


# ─── Extension → parser module.class mapping (lazy) ──────────────────────────

_PARSER_MAP: Dict[str, str] = {
    # Tabular
    "tsv":     "adapters.parser_tabular.TabularParser",
    "psv":     "adapters.parser_tabular.TabularParser",
    "dat":     "adapters.parser_tabular.TabularParser",
    # Spreadsheets  (csv and xlsx are handled by legacy — these are NEW formats)
    "xls":     "adapters.parser_excel.ExcelParser",
    "xlsm":    "adapters.parser_excel.ExcelParser",
    "xlsb":    "adapters.parser_excel.ExcelParser",
    # Structured data
    "jsonl":   "adapters.parser_structured.StructuredParser",
    "ndjson":  "adapters.parser_structured.StructuredParser",
    "xml":     "adapters.parser_structured.StructuredParser",
    "yaml":    "adapters.parser_structured.StructuredParser",
    "yml":     "adapters.parser_structured.StructuredParser",
    # Database / SQL
    "sqlite":  "adapters.parser_sql.SQLParser",
    "db":      "adapters.parser_sql.SQLParser",
    # Columnar / Analytics
    "parquet": "adapters.parser_columnar.ColumnarParser",
    "orc":     "adapters.parser_columnar.ColumnarParser",
    "avro":    "adapters.parser_columnar.ColumnarParser",
    "feather": "adapters.parser_columnar.ColumnarParser",
    "arrow":   "adapters.parser_columnar.ColumnarParser",
    # Scientific / ML
    "hdf5":    "adapters.parser_scientific.ScientificParser",
    "h5":      "adapters.parser_scientific.ScientificParser",
    "mat":     "adapters.parser_scientific.ScientificParser",
    "pkl":     "adapters.parser_scientific.ScientificParser",
    "pickle":  "adapters.parser_scientific.ScientificParser",
    "joblib":  "adapters.parser_scientific.ScientificParser",
    "npy":     "adapters.parser_scientific.ScientificParser",
    "npz":     "adapters.parser_scientific.ScientificParser",
    # Images (OCR enhanced — these REPLACE the legacy metadata-only parser)
    "bmp":     "adapters.parser_image.ImageOCRParser",
    "tiff":    "adapters.parser_image.ImageOCRParser",
    "tif":     "adapters.parser_image.ImageOCRParser",
    "gif":     "adapters.parser_image.ImageOCRParser",
}

# All extensions the V2 system handles (union of the map above)
V2_SUPPORTED_EXTENSIONS = set(_PARSER_MAP.keys())

# Parser instance cache (singleton per class)
_parser_cache: Dict[str, "BaseParser"] = {}


def get_v2_parser(ext: str) -> Optional["BaseParser"]:
    """
    Get a parser instance for a given file extension.
    Returns None if the extension is not handled by V2 (falls back to legacy).
    Uses lazy loading to avoid importing heavy deps at startup.
    """
    class_path = _PARSER_MAP.get(ext)
    if class_path is None:
        return None

    # Return cached instance if available
    if class_path in _parser_cache:
        return _parser_cache[class_path]

    # Lazy-load the parser class
    try:
        module_path, class_name = class_path.rsplit(".", 1)
        full_module = f"utils.parsers_v2.{module_path}"

        import importlib
        module = importlib.import_module(full_module)
        parser_class = getattr(module, class_name)
        instance = parser_class()
        _parser_cache[class_path] = instance
        logger.debug("[Registry] Loaded parser: %s for .%s", class_path, ext)
        return instance
    except Exception as e:
        logger.error("[Registry] Failed to load parser %s for .%s: %s", class_path, ext, e)
        return None
