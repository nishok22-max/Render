"""
ThinkSync — Parsers V2 Package
Modular, pluggable file parser system for extended format support.
Non-breaking extension of the existing file_parsers.py system.
"""
from .registry import get_v2_parser, V2_SUPPORTED_EXTENSIONS
from .core import NormalizedDocument

__all__ = ["get_v2_parser", "V2_SUPPORTED_EXTENSIONS", "NormalizedDocument"]
