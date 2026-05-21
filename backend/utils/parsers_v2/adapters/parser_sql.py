"""
ThinkSync — SQL / SQLite Parser Adapter
Handles: .sqlite, .db (SQLite database files)
Note: Plain .sql code files are handled by the legacy code parser.
"""
from __future__ import annotations

import os
import sqlite3
import logging
from typing import Iterator

from ..core import BaseParser, NormalizedDocument

logger = logging.getLogger("thinksync.parsers_v2.sql")

_MAX_ROWS_PER_TABLE = 100
_MAX_TABLES = 50


class SQLParser(BaseParser):
    name = "sql_database"
    max_file_size = 500 * 1024 * 1024  # 500 MB

    def parse(self, file_path: str) -> Iterator[NormalizedDocument]:
        ext = file_path.rsplit(".", 1)[-1].lower() if "." in file_path else ""

        size_err = self._validate_file_size(file_path)
        if size_err:
            yield self._make_error_doc(file_path, size_err, ext)
            return

        try:
            yield from self._parse_sqlite(file_path, ext)
        except Exception as e:
            logger.error("[SQLParser] Error parsing %s: %s", file_path, e)
            yield self._make_error_doc(file_path, str(e), ext)

    def _parse_sqlite(self, file_path: str, ext: str) -> Iterator[NormalizedDocument]:
        filename = os.path.basename(file_path)

        # Open read-only to prevent accidental writes
        conn = sqlite3.connect(f"file:{file_path}?mode=ro", uri=True)
        conn.row_factory = sqlite3.Row

        try:
            cursor = conn.cursor()

            # Get all table names
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
            tables = [row[0] for row in cursor.fetchall()][:_MAX_TABLES]

            # Summary chunk
            summary = f"SQLite Database: {filename}\n"
            summary += f"Tables: {len(tables)}\n"
            summary += f"Table names: {', '.join(tables)}\n"

            yield NormalizedDocument(
                content=summary,
                file_type=ext,
                source=file_path,
                structural_info={"section": "summary", "tables": tables},
                metadata={"filename": filename, "table_count": len(tables)},
            )

            # Per-table schema + preview
            for table in tables:
                try:
                    # Get schema
                    cursor.execute(f"PRAGMA table_info('{table}')")
                    columns = cursor.fetchall()
                    col_info = [(c[1], c[2]) for c in columns]  # (name, type)

                    # Get row count
                    cursor.execute(f"SELECT COUNT(*) FROM '{table}'")
                    row_count = cursor.fetchone()[0]

                    # Get preview rows
                    cursor.execute(f"SELECT * FROM '{table}' LIMIT {_MAX_ROWS_PER_TABLE}")
                    rows = cursor.fetchall()

                    content = f"Table: {table}\n"
                    content += f"Rows: {row_count}\n"
                    content += f"Columns:\n"
                    for name, dtype in col_info:
                        content += f"  - {name} ({dtype})\n"
                    content += f"\nPreview ({min(len(rows), _MAX_ROWS_PER_TABLE)} rows):\n"

                    if rows:
                        headers = [desc[0] for desc in cursor.description]
                        content += " | ".join(headers) + "\n"
                        content += "-" * 60 + "\n"
                        for row in rows:
                            content += " | ".join(str(v) for v in row) + "\n"

                    yield NormalizedDocument(
                        content=content,
                        file_type=ext,
                        source=file_path,
                        structural_info={"table": table, "row_count": row_count},
                        metadata={"filename": filename, "table_name": table},
                    )

                except Exception as table_err:
                    logger.warning("[SQLParser] Error reading table '%s': %s", table, table_err)
                    yield NormalizedDocument(
                        content=f"[Table '{table}' could not be read: {table_err}]",
                        file_type=ext,
                        source=file_path,
                        structural_info={"table": table},
                        metadata={"filename": filename, "error": True},
                    )

        finally:
            conn.close()
