"""
ThinkSync — Tabular Parser Adapter
Handles: TSV, PSV, DAT (tab, pipe, and generic delimited files)
Note: CSV and XLSX are handled by the legacy parser — this only covers NEW formats.
"""
from __future__ import annotations

import os
import logging
from typing import Iterator

from ..core import BaseParser, NormalizedDocument

logger = logging.getLogger("thinksync.parsers_v2.tabular")

# Delimiter mapping by extension
_DELIMITERS = {
    "tsv": "\t",
    "psv": "|",
    "dat": None,   # Auto-detect via csv.Sniffer
}

_MAX_ROWS_PER_CHUNK = 50
_MAX_TOTAL_ROWS = 500


class TabularParser(BaseParser):
    name = "tabular"
    max_file_size = 100 * 1024 * 1024  # 100 MB

    def parse(self, file_path: str) -> Iterator[NormalizedDocument]:
        ext = file_path.rsplit(".", 1)[-1].lower() if "." in file_path else ""

        # Validate size
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
            delimiter = _DELIMITERS.get(ext)

            if delimiter is None:
                # Auto-detect delimiter using csv.Sniffer
                import csv
                with open(file_path, "r", encoding="utf-8", errors="replace") as f:
                    sample = f.read(4096)
                try:
                    dialect = csv.Sniffer().sniff(sample)
                    delimiter = dialect.delimiter
                except csv.Error:
                    delimiter = ","  # Fallback to comma

            df = pd.read_csv(
                file_path,
                sep=delimiter,
                nrows=_MAX_TOTAL_ROWS,
                encoding="utf-8",
                encoding_errors="replace",
                on_bad_lines="skip",
            )

            filename = os.path.basename(file_path)

            # Yield a summary header chunk
            summary = f"Tabular File: {filename}\n"
            summary += f"Format: {ext.upper()} (delimiter: {repr(delimiter)})\n"
            summary += f"Shape: {df.shape[0]} rows × {df.shape[1]} columns\n"
            summary += f"Columns: {', '.join(df.columns.astype(str).tolist())}\n\n"
            summary += "Data Types:\n"
            for col in df.columns:
                summary += f"  - {col}: {df[col].dtype}\n"

            numeric_cols = df.select_dtypes(include=["number"]).columns
            if len(numeric_cols) > 0:
                summary += f"\nStatistics:\n{df[numeric_cols].describe().to_string()}"

            yield NormalizedDocument(
                content=summary,
                file_type=ext,
                source=file_path,
                structural_info={"section": "summary", "columns": df.columns.tolist()},
                metadata={"filename": filename, "rows": len(df), "cols": len(df.columns)},
            )

            # Yield row chunks
            for start in range(0, len(df), _MAX_ROWS_PER_CHUNK):
                end = min(start + _MAX_ROWS_PER_CHUNK, len(df))
                chunk_df = df.iloc[start:end]
                content = f"--- Rows {start + 1} to {end} ---\n{chunk_df.to_string()}"

                yield NormalizedDocument(
                    content=content,
                    file_type=ext,
                    source=file_path,
                    structural_info={"section": "data", "row_start": start, "row_end": end},
                    metadata={"filename": filename},
                )

        except Exception as e:
            logger.error("[TabularParser] Error parsing %s: %s", file_path, e)
            yield self._make_error_doc(file_path, str(e), ext)
