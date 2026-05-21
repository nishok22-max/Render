"""
ThinkSync — Columnar/Analytics Parser Adapter
Handles: Parquet, ORC, Avro, Feather, Arrow
Uses lazy-loading via PyArrow for memory-safe parsing of large files.
"""
from __future__ import annotations

import os
import logging
from typing import Iterator

from ..core import BaseParser, NormalizedDocument

logger = logging.getLogger("thinksync.parsers_v2.columnar")

_MAX_ROWS = 500
_CHUNK_ROWS = 50


class ColumnarParser(BaseParser):
    name = "columnar"
    max_file_size = 500 * 1024 * 1024  # 500 MB

    def parse(self, file_path: str) -> Iterator[NormalizedDocument]:
        ext = file_path.rsplit(".", 1)[-1].lower() if "." in file_path else ""

        size_err = self._validate_file_size(file_path)
        if size_err:
            yield self._make_error_doc(file_path, size_err, ext)
            return

        try:
            if ext == "parquet":
                yield from self._parse_parquet(file_path, ext)
            elif ext in ("feather", "arrow"):
                yield from self._parse_feather(file_path, ext)
            elif ext == "avro":
                yield from self._parse_avro(file_path, ext)
            elif ext == "orc":
                yield from self._parse_orc(file_path, ext)
            else:
                yield self._make_error_doc(file_path, f"Unsupported columnar format: .{ext}", ext)
        except Exception as e:
            logger.error("[ColumnarParser] Error parsing %s: %s", file_path, e)
            yield self._make_error_doc(file_path, str(e), ext)

    def _parse_parquet(self, file_path: str, ext: str) -> Iterator[NormalizedDocument]:
        try:
            import pyarrow.parquet as pq
        except ImportError:
            yield self._make_error_doc(file_path, "pyarrow required: pip install pyarrow", ext)
            return

        filename = os.path.basename(file_path)
        pf = pq.ParquetFile(file_path)
        schema = pf.schema_arrow
        num_rows = pf.metadata.num_rows

        # Summary
        col_info = "\n".join(f"  - {f.name}: {f.type}" for f in schema)
        summary = (
            f"Parquet File: {filename}\n"
            f"Total rows: {num_rows}\n"
            f"Columns ({len(schema)}):\n{col_info}\n"
            f"Row groups: {pf.metadata.num_row_groups}"
        )

        yield NormalizedDocument(
            content=summary,
            file_type=ext,
            source=file_path,
            structural_info={"section": "summary", "columns": [f.name for f in schema]},
            metadata={"filename": filename, "total_rows": num_rows},
        )

        # Read first N rows via batches
        rows_read = 0
        for batch in pf.iter_batches(batch_size=_CHUNK_ROWS):
            if rows_read >= _MAX_ROWS:
                break
            df = batch.to_pandas()
            content = f"--- Rows {rows_read + 1} to {rows_read + len(df)} ---\n{df.to_string()}"
            yield NormalizedDocument(
                content=content,
                file_type=ext,
                source=file_path,
                structural_info={"section": "data", "row_start": rows_read},
                metadata={"filename": filename},
            )
            rows_read += len(df)

    def _parse_feather(self, file_path: str, ext: str) -> Iterator[NormalizedDocument]:
        try:
            import pyarrow.feather as feather
        except ImportError:
            yield self._make_error_doc(file_path, "pyarrow required: pip install pyarrow", ext)
            return

        filename = os.path.basename(file_path)
        df = feather.read_feather(file_path)

        summary = (
            f"Feather/Arrow File: {filename}\n"
            f"Shape: {df.shape[0]} rows × {df.shape[1]} columns\n"
            f"Columns: {', '.join(df.columns.tolist())}\n\n"
            f"Preview:\n{df.head(_MAX_ROWS).to_string()}"
        )

        yield NormalizedDocument(
            content=summary,
            file_type=ext,
            source=file_path,
            structural_info={"section": "full", "columns": df.columns.tolist()},
            metadata={"filename": filename, "rows": len(df)},
        )

    def _parse_avro(self, file_path: str, ext: str) -> Iterator[NormalizedDocument]:
        filename = os.path.basename(file_path)

        # Try pyarrow first, then fastavro
        try:
            import pyarrow
            from pyarrow import csv as pa_csv
            import json

            try:
                import pyarrow as pa
                reader = pa.ipc.open_file(file_path)
                table = reader.read_all()
                df = table.to_pandas()
            except Exception:
                # Fallback: try reading as Avro via fastavro
                try:
                    import fastavro
                    records = []
                    with open(file_path, "rb") as f:
                        for record in fastavro.reader(f):
                            records.append(record)
                            if len(records) >= _MAX_ROWS:
                                break
                    import pandas as pd
                    df = pd.DataFrame(records)
                except ImportError:
                    yield self._make_error_doc(file_path, "fastavro required for .avro: pip install fastavro", ext)
                    return

            summary = (
                f"Avro File: {filename}\n"
                f"Shape: {df.shape[0]} rows × {df.shape[1]} columns\n"
                f"Columns: {', '.join(df.columns.tolist())}\n\n"
                f"Preview:\n{df.head(20).to_string()}"
            )

            yield NormalizedDocument(
                content=summary,
                file_type=ext,
                source=file_path,
                structural_info={"section": "full"},
                metadata={"filename": filename, "rows": len(df)},
            )

        except Exception as e:
            yield self._make_error_doc(file_path, str(e), ext)

    def _parse_orc(self, file_path: str, ext: str) -> Iterator[NormalizedDocument]:
        try:
            import pyarrow.orc as orc
        except ImportError:
            yield self._make_error_doc(file_path, "pyarrow required: pip install pyarrow", ext)
            return

        filename = os.path.basename(file_path)

        try:
            table = orc.read_table(file_path)
            df = table.to_pandas()
            if len(df) > _MAX_ROWS:
                df = df.head(_MAX_ROWS)

            summary = (
                f"ORC File: {filename}\n"
                f"Shape: {df.shape[0]} rows × {df.shape[1]} columns\n"
                f"Columns: {', '.join(df.columns.tolist())}\n\n"
                f"Preview:\n{df.head(20).to_string()}"
            )

            yield NormalizedDocument(
                content=summary,
                file_type=ext,
                source=file_path,
                structural_info={"section": "full"},
                metadata={"filename": filename, "rows": len(df)},
            )

        except Exception as e:
            yield self._make_error_doc(file_path, str(e), ext)
