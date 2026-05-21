"""
ThinkSync — Structured Data Parser Adapter
Handles: JSONL, NDJSON, XML, YAML/YML
Note: Standard JSON is handled by the legacy parser.
"""
from __future__ import annotations

import os
import logging
from typing import Iterator

from ..core import BaseParser, NormalizedDocument

logger = logging.getLogger("thinksync.parsers_v2.structured")

_MAX_RECORDS_JSONL = 500
_MAX_TEXT_LENGTH = 500_000   # 500KB of text output max


class StructuredParser(BaseParser):
    name = "structured"
    max_file_size = 100 * 1024 * 1024  # 100 MB

    def parse(self, file_path: str) -> Iterator[NormalizedDocument]:
        ext = file_path.rsplit(".", 1)[-1].lower() if "." in file_path else ""

        size_err = self._validate_file_size(file_path)
        if size_err:
            yield self._make_error_doc(file_path, size_err, ext)
            return

        if ext in ("jsonl", "ndjson"):
            yield from self._parse_jsonl(file_path, ext)
        elif ext == "xml":
            yield from self._parse_xml(file_path, ext)
        elif ext in ("yaml", "yml"):
            yield from self._parse_yaml(file_path, ext)
        else:
            yield self._make_error_doc(file_path, f"Unsupported structured format: .{ext}", ext)

    # ── JSONL / NDJSON ────────────────────────────────────────────────────────

    def _parse_jsonl(self, file_path: str, ext: str) -> Iterator[NormalizedDocument]:
        import json

        filename = os.path.basename(file_path)
        records_parsed = 0
        errors = 0
        batch: list[str] = []
        batch_size = 25

        try:
            with open(file_path, "r", encoding="utf-8", errors="replace") as f:
                for line_num, line in enumerate(f, 1):
                    if records_parsed >= _MAX_RECORDS_JSONL:
                        break

                    line = line.strip()
                    if not line:
                        continue

                    try:
                        obj = json.loads(line)
                        batch.append(json.dumps(obj, indent=2, ensure_ascii=False))
                        records_parsed += 1
                    except json.JSONDecodeError:
                        errors += 1
                        continue

                    if len(batch) >= batch_size:
                        content = f"--- Records {records_parsed - len(batch) + 1} to {records_parsed} ---\n"
                        content += "\n---\n".join(batch)
                        yield NormalizedDocument(
                            content=content,
                            file_type=ext,
                            source=file_path,
                            structural_info={"section": "records", "count": len(batch)},
                            metadata={"filename": filename},
                        )
                        batch = []

            # Flush remaining
            if batch:
                content = f"--- Records {records_parsed - len(batch) + 1} to {records_parsed} ---\n"
                content += "\n---\n".join(batch)
                yield NormalizedDocument(
                    content=content,
                    file_type=ext,
                    source=file_path,
                    structural_info={"section": "records", "count": len(batch)},
                    metadata={"filename": filename, "total_records": records_parsed, "parse_errors": errors},
                )

            # Summary
            yield NormalizedDocument(
                content=f"JSONL File: {filename}\nTotal records parsed: {records_parsed}\nParse errors: {errors}",
                file_type=ext,
                source=file_path,
                structural_info={"section": "summary"},
                metadata={"filename": filename},
            )

        except Exception as e:
            logger.error("[StructuredParser] JSONL error %s: %s", file_path, e)
            yield self._make_error_doc(file_path, str(e), ext)

    # ── XML ───────────────────────────────────────────────────────────────────

    def _parse_xml(self, file_path: str, ext: str) -> Iterator[NormalizedDocument]:
        filename = os.path.basename(file_path)

        try:
            # Use defusedxml for safe parsing (prevents XXE attacks)
            try:
                import defusedxml.ElementTree as ET
            except ImportError:
                import xml.etree.ElementTree as ET
                logger.warning("[StructuredParser] defusedxml not available, using stdlib (less safe)")

            tree = ET.parse(file_path)
            root = tree.getroot()

            # Convert XML tree to readable text
            text_parts: list[str] = []
            self._xml_to_text(root, text_parts, depth=0, max_depth=10)

            full_text = "\n".join(text_parts)
            if len(full_text) > _MAX_TEXT_LENGTH:
                full_text = full_text[:_MAX_TEXT_LENGTH] + "\n\n[... truncated ...]"

            yield NormalizedDocument(
                content=f"XML File: {filename}\nRoot tag: {root.tag}\n\n{full_text}",
                file_type=ext,
                source=file_path,
                structural_info={"root_tag": root.tag},
                metadata={"filename": filename},
            )

        except Exception as e:
            logger.error("[StructuredParser] XML error %s: %s", file_path, e)
            yield self._make_error_doc(file_path, str(e), ext)

    def _xml_to_text(self, element, parts: list, depth: int, max_depth: int):
        """Recursively convert XML element tree to indented text."""
        if depth > max_depth:
            return

        indent = "  " * depth
        tag = element.tag.split("}")[-1] if "}" in element.tag else element.tag

        # Element with text
        text = (element.text or "").strip()
        attrs = " ".join(f'{k}="{v}"' for k, v in element.attrib.items())
        header = f"{indent}<{tag}>"
        if attrs:
            header = f"{indent}<{tag} {attrs}>"

        if text:
            parts.append(f"{header} {text}")
        elif len(element) == 0:
            parts.append(header)
        else:
            parts.append(header)

        for child in element:
            self._xml_to_text(child, parts, depth + 1, max_depth)

    # ── YAML ──────────────────────────────────────────────────────────────────

    def _parse_yaml(self, file_path: str, ext: str) -> Iterator[NormalizedDocument]:
        filename = os.path.basename(file_path)

        try:
            import yaml
        except ImportError:
            yield self._make_error_doc(file_path, "PyYAML required: pip install pyyaml", ext)
            return

        try:
            with open(file_path, "r", encoding="utf-8", errors="replace") as f:
                # SECURITY: Always use safe_load to prevent code execution
                data = yaml.safe_load(f)

            import json
            text = json.dumps(data, indent=2, ensure_ascii=False, default=str)
            if len(text) > _MAX_TEXT_LENGTH:
                text = text[:_MAX_TEXT_LENGTH] + "\n\n[... truncated ...]"

            yield NormalizedDocument(
                content=f"YAML File: {filename}\n\n{text}",
                file_type=ext,
                source=file_path,
                structural_info={"format": "yaml"},
                metadata={"filename": filename},
            )

        except Exception as e:
            logger.error("[StructuredParser] YAML error %s: %s", file_path, e)
            yield self._make_error_doc(file_path, str(e), ext)
