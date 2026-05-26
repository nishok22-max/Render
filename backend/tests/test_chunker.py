"""
ThinkSync OS — Whitebox Tests: Chunker (Final Fix)
Verifies text splitting logic and boundary preservation.
"""
import pytest
from rag.chunker import chunk_text, chunk_code

def test_chunker_basic_split():
    """Verify that text is split into chunks of appropriate size."""
    text = "Word " * 1000  # Large text
    chunks = chunk_text(text, chunk_size=100, chunk_overlap=20)
    assert len(chunks) > 1
    # Check content length
    assert all(len(c["content"]) <= 150 for c in chunks)

def test_chunker_paragraph_preservation():
    """Verify that the chunker respects paragraph boundaries."""
    text = "Paragraph one.\n\nParagraph two.\n\nParagraph three."
    # Size that forces a split but allows paragraph break detection
    chunks = chunk_text(text, chunk_size=20)
    assert len(chunks) >= 3

def test_chunker_code_aware_splitting():
    """Verify that code blocks are treated as logical units using chunk_code."""
    code_text = "def function_one():\n    pass\n\ndef function_two():\n    pass"
    chunks = chunk_code(code_text, language="python")
    
    # Should detect two distinct functions
    assert len(chunks) == 2
    assert "def function_one" in chunks[0]["content"]
    assert "def function_two" in chunks[1]["content"]
