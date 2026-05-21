"""
ThinkSync — Image OCR Parser Adapter
Handles: BMP, TIFF, GIF (new image formats with OCR text extraction)
Note: JPG, PNG, JPEG, WEBP are handled by the legacy parser.
      This adapter adds OCR text extraction for NEW image formats.

Requires:
  - Pillow (already installed)
  - pytesseract + Tesseract-OCR binary (optional, for OCR)
"""
from __future__ import annotations

import os
import logging
from typing import Iterator

from ..core import BaseParser, NormalizedDocument

logger = logging.getLogger("thinksync.parsers_v2.image")


class ImageOCRParser(BaseParser):
    name = "image_ocr"
    max_file_size = 25 * 1024 * 1024  # 25 MB

    def parse(self, file_path: str) -> Iterator[NormalizedDocument]:
        ext = file_path.rsplit(".", 1)[-1].lower() if "." in file_path else ""

        size_err = self._validate_file_size(file_path)
        if size_err:
            yield self._make_error_doc(file_path, size_err, ext)
            return

        try:
            from PIL import Image
        except ImportError:
            yield self._make_error_doc(file_path, "Pillow required: pip install Pillow", ext)
            return

        filename = os.path.basename(file_path)

        try:
            img = Image.open(file_path)

            # Metadata
            content = (
                f"Image File: {filename}\n"
                f"Format: {img.format or ext.upper()}\n"
                f"Size: {img.size[0]}x{img.size[1]}\n"
                f"Mode: {img.mode}\n"
            )

            # EXIF data if available
            exif_data = self._extract_exif(img)
            if exif_data:
                content += f"\nEXIF Metadata:\n{exif_data}\n"

            # Attempt OCR
            ocr_text = self._try_ocr(img)
            if ocr_text:
                content += f"\nExtracted Text (OCR):\n{ocr_text}\n"
            else:
                content += "\n[No text detected via OCR — image content requires Vision Agent analysis]\n"

            yield NormalizedDocument(
                content=content,
                file_type=ext,
                source=file_path,
                structural_info={"width": img.size[0], "height": img.size[1], "format": img.format},
                metadata={
                    "filename": filename,
                    "has_ocr_text": bool(ocr_text),
                    "image_mode": img.mode,
                },
            )

        except Exception as e:
            logger.error("[ImageOCRParser] Error parsing %s: %s", file_path, e)
            yield self._make_error_doc(file_path, str(e), ext)

    def _try_ocr(self, img) -> str:
        """Attempt OCR text extraction. Returns empty string if unavailable."""
        try:
            import pytesseract
            text = pytesseract.image_to_string(img, timeout=30)
            text = text.strip()
            if len(text) < 5:
                return ""
            return text
        except ImportError:
            logger.debug("[ImageOCRParser] pytesseract not installed — skipping OCR")
            return ""
        except Exception as e:
            logger.debug("[ImageOCRParser] OCR failed: %s", e)
            return ""

    def _extract_exif(self, img) -> str:
        """Extract EXIF metadata if available."""
        try:
            exif = img.getexif()
            if not exif:
                return ""
            from PIL.ExifTags import TAGS
            parts = []
            for tag_id, value in list(exif.items())[:20]:
                tag = TAGS.get(tag_id, str(tag_id))
                parts.append(f"  {tag}: {str(value)[:100]}")
            return "\n".join(parts)
        except Exception:
            return ""
