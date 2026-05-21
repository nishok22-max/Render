"""
Aetheris OS — Whitebox Tests: File Parsers
Verifies content extraction from various formats.
"""
import pytest
import os
from utils.file_parsers import parse_file, PARSERS

def test_parser_selection():
    """Verify the correct parser is selected for each extension."""
    assert PARSERS.get("pdf").__name__ == "parse_pdf"
    assert PARSERS.get("csv").__name__ == "parse_csv"
    assert PARSERS.get("py").__name__ == "parse_code"
    assert PARSERS.get("png").__name__ == "parse_image_metadata"

def test_txt_parser(tmp_path):
    """Verify TXT parsing logic."""
    d = tmp_path / "test"
    d.mkdir()
    p = d / "test.txt"
    p.write_text("Hello World\nLine 2")
    
    content = parse_file(str(p))
    assert "Hello World" in content
    assert "Line 2" in content

def test_unsupported_format():
    """Verify graceful handling of unknown files."""
    content = parse_file("binary.exe")
    assert "Unsupported file type" in content
