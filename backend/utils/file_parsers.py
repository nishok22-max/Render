"""
Aetheris OS — File Parsers
Extracts text content from various file types.
"""
import os
import json
import io


def parse_txt(file_path: str) -> str:
    """Parse plain text files."""
    with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
        return f.read()


def parse_markdown(file_path: str) -> str:
    """Parse markdown files (treated as plain text)."""
    return parse_txt(file_path)


def parse_json_file(file_path: str) -> str:
    """Parse JSON files into readable text."""
    with open(file_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    return json.dumps(data, indent=2)


def parse_pdf(file_path: str) -> str:
    """Parse PDF files using PyPDF2."""
    try:
        from PyPDF2 import PdfReader
        reader = PdfReader(file_path)
        text_parts = []
        for i, page in enumerate(reader.pages):
            page_text = page.extract_text() or ""
            if page_text.strip():
                text_parts.append(f"--- Page {i + 1} ---\n{page_text}")
        return "\n\n".join(text_parts)
    except Exception as e:
        return f"[PDF parsing error: {str(e)}]"


def parse_docx(file_path: str) -> str:
    """Parse DOCX files using python-docx."""
    try:
        from docx import Document
        doc = Document(file_path)
        paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
        return "\n\n".join(paragraphs)
    except Exception as e:
        return f"[DOCX parsing error: {str(e)}]"


def parse_csv(file_path: str) -> str:
    """Parse CSV files into text representation."""
    try:
        import pandas as pd
        df = pd.read_csv(file_path, nrows=500)  # Limit rows for embedding
        summary = f"CSV File: {os.path.basename(file_path)}\n"
        summary += f"Shape: {df.shape[0]} rows × {df.shape[1]} columns\n"
        summary += f"Columns: {', '.join(df.columns.tolist())}\n\n"
        summary += "Data Types:\n"
        for col in df.columns:
            summary += f"  - {col}: {df[col].dtype}\n"
        summary += f"\nFirst 20 rows:\n{df.head(20).to_string()}\n"
        # Add basic stats for numeric columns
        numeric_cols = df.select_dtypes(include=["number"]).columns
        if len(numeric_cols) > 0:
            summary += f"\nStatistics:\n{df[numeric_cols].describe().to_string()}"
        return summary
    except Exception as e:
        return f"[CSV parsing error: {str(e)}]"


def parse_xlsx(file_path: str) -> str:
    """Parse Excel files."""
    try:
        import pandas as pd
        xls = pd.ExcelFile(file_path)
        parts = []
        for sheet_name in xls.sheet_names[:5]:  # Max 5 sheets
            df = pd.read_excel(xls, sheet_name=sheet_name, nrows=500)
            part = f"Sheet: {sheet_name}\n"
            part += f"Shape: {df.shape[0]} rows × {df.shape[1]} columns\n"
            part += f"Columns: {', '.join(df.columns.astype(str).tolist())}\n"
            part += f"Preview:\n{df.head(20).to_string()}\n"
            parts.append(part)
        return "\n\n---\n\n".join(parts)
    except Exception as e:
        return f"[XLSX parsing error: {str(e)}]"


def parse_code(file_path: str) -> str:
    """Parse code files with metadata."""
    ext = file_path.rsplit(".", 1)[-1].lower()
    lang_map = {
        "py": "Python", "java": "Java", "js": "JavaScript",
        "ts": "TypeScript", "c": "C", "cpp": "C++",
        "html": "HTML", "css": "CSS", "sql": "SQL",
    }
    language = lang_map.get(ext, "Unknown")

    with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
        code = f.read()

    lines = code.split("\n")
    header = f"Language: {language}\n"
    header += f"File: {os.path.basename(file_path)}\n"
    header += f"Lines: {len(lines)}\n\n"

    return header + code


def parse_image_metadata(file_path: str) -> str:
    """Return image metadata (actual vision analysis done separately)."""
    try:
        from PIL import Image
        img = Image.open(file_path)
        return (
            f"Image File: {os.path.basename(file_path)}\n"
            f"Format: {img.format}\n"
            f"Size: {img.size[0]}x{img.size[1]}\n"
            f"Mode: {img.mode}\n"
            f"[Image content requires Vision Agent analysis]"
        )
    except Exception as e:
        return f"[Image metadata error: {str(e)}]"


# Parser registry
PARSERS = {
    "txt": parse_txt,
    "md": parse_markdown,
    "json": parse_json_file,
    "pdf": parse_pdf,
    "docx": parse_docx,
    "csv": parse_csv,
    "xlsx": parse_xlsx,
    "py": parse_code,
    "java": parse_code,
    "js": parse_code,
    "ts": parse_code,
    "c": parse_code,
    "cpp": parse_code,
    "html": parse_code,
    "css": parse_code,
    "sql": parse_code,
    "png": parse_image_metadata,
    "jpg": parse_image_metadata,
    "jpeg": parse_image_metadata,
    "webp": parse_image_metadata,
}


def parse_file(file_path: str) -> str:
    """Parse any supported file and return text content."""
    ext = file_path.rsplit(".", 1)[-1].lower() if "." in file_path else ""

    # Legacy parsers first (unchanged behavior for existing formats)
    parser = PARSERS.get(ext)
    if parser:
        return parser(file_path)

    # V2 modular parsers for new formats (additive extension)
    try:
        from utils.parsers_v2 import get_v2_parser
        v2_parser = get_v2_parser(ext)
        if v2_parser:
            docs = list(v2_parser.parse(file_path))
            return "\n\n".join(doc.content for doc in docs if doc.content)
    except Exception as e:
        return f"[V2 parser error for .{ext}: {e}]"

    return f"[Unsupported file type: .{ext}]"
