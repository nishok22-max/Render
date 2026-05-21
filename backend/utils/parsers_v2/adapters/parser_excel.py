"""
ThinkSync — Excel Parser Adapter
Handles: XLS, XLSM, XLSB (new formats not covered by legacy xlsx parser)
"""
from __future__ import annotations

import os
import logging
from typing import Iterator

from ..core import BaseParser, NormalizedDocument

logger = logging.getLogger("thinksync.parsers_v2.excel")

_MAX_ROWS = 500
_MAX_SHEETS = 10


class ExcelParser(BaseParser):
    name = "excel"
    max_file_size = 100 * 1024 * 1024  # 100 MB

    def parse(self, file_path: str) -> Iterator[NormalizedDocument]:
        ext = file_path.rsplit(".", 1)[-1].lower() if "." in file_path else ""

        size_err = self._validate_file_size(file_path)
        if size_err:
            yield self._make_error_doc(file_path, size_err, ext)
            return

        try:
            import pandas as pd
        except ImportError:
            yield self._make_error_doc(file_path, "pandas is required: pip install pandas", ext)
            return

        try:
            filename = os.path.basename(file_path)

            # Select engine based on format
            engine = self._get_engine(ext)
            if engine is None:
                yield self._make_error_doc(file_path, f"No engine available for .{ext}", ext)
                return

            xls = pd.ExcelFile(file_path, engine=engine)
            sheet_names = xls.sheet_names[:_MAX_SHEETS]

            for sheet_name in sheet_names:
                try:
                    df = pd.read_excel(xls, sheet_name=sheet_name, nrows=_MAX_ROWS)

                    content = f"Sheet: {sheet_name}\n"
                    content += f"Shape: {df.shape[0]} rows × {df.shape[1]} columns\n"
                    content += f"Columns: {', '.join(df.columns.astype(str).tolist())}\n\n"
                    content += f"Preview (first 20 rows):\n{df.head(20).to_string()}\n"

                    numeric_cols = df.select_dtypes(include=["number"]).columns
                    if len(numeric_cols) > 0:
                        content += f"\nStatistics:\n{df[numeric_cols].describe().to_string()}"

                    yield NormalizedDocument(
                        content=content,
                        file_type=ext,
                        source=file_path,
                        structural_info={"sheet": sheet_name, "rows": len(df), "cols": len(df.columns)},
                        metadata={"filename": filename, "sheet_name": sheet_name},
                    )
                except Exception as sheet_err:
                    logger.warning("[ExcelParser] Error reading sheet '%s': %s", sheet_name, sheet_err)
                    yield NormalizedDocument(
                        content=f"[Sheet '{sheet_name}' could not be read: {sheet_err}]",
                        file_type=ext,
                        source=file_path,
                        structural_info={"sheet": sheet_name},
                        metadata={"filename": filename, "error": True},
                    )

        except Exception as e:
            logger.error("[ExcelParser] Error parsing %s: %s", file_path, e)
            yield self._make_error_doc(file_path, str(e), ext)

    def _get_engine(self, ext: str) -> str | None:
        """Select pandas ExcelFile engine based on format."""
        engines = {
            "xls": "xlrd",
            "xlsm": "openpyxl",
            "xlsb": "pyxlsb",
        }
        engine = engines.get(ext)

        # Verify the engine is importable
        if engine:
            try:
                __import__(engine)
                return engine
            except ImportError:
                # Try openpyxl as fallback for xlsm
                if ext == "xlsm":
                    return "openpyxl"
                logger.warning("[ExcelParser] Engine '%s' not installed for .%s", engine, ext)
                return None
        return None
