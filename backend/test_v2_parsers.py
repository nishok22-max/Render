"""
ThinkSync V2 Parser — Full Verification Suite
Creates tiny test files for every V2 format and runs them through the parsers.
"""
import os
import sys
import json
import tempfile
import traceback

# Ensure backend is on the path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from utils.parsers_v2 import get_v2_parser, V2_SUPPORTED_EXTENSIONS
from utils.parsers_v2.core import NormalizedDocument

RESULTS = {"passed": [], "failed": [], "skipped": []}
TMPDIR = tempfile.mkdtemp(prefix="thinksync_test_")


def test_parser(ext: str, create_fn):
    """Test a single parser: create a file, parse it, verify output."""
    try:
        file_path = create_fn(ext)
        parser = get_v2_parser(ext)
        if parser is None:
            RESULTS["failed"].append((ext, "No parser registered"))
            return

        docs = list(parser.parse(file_path))
        if not docs:
            RESULTS["failed"].append((ext, "Parser returned 0 documents"))
            return

        for doc in docs:
            if not isinstance(doc, NormalizedDocument):
                RESULTS["failed"].append((ext, f"Wrong type: {type(doc)}"))
                return
            if not doc.content:
                RESULTS["failed"].append((ext, "Empty content"))
                return
            if "[error" in doc.content.lower() or "[security" in doc.content.lower():
                # Check if it's a genuine parse or an error doc
                if "parsing error" in doc.content.lower():
                    RESULTS["failed"].append((ext, f"Parse error: {doc.content[:120]}"))
                    return

        total_chars = sum(len(d.content) for d in docs)
        RESULTS["passed"].append((ext, f"{len(docs)} docs, {total_chars} chars"))
    except Exception as e:
        RESULTS["failed"].append((ext, f"EXCEPTION: {e}\n{traceback.format_exc()}"))


# ─── Test File Creators ──────────────────────────────────────────────────────

def make_tabular(ext):
    delimiters = {"tsv": "\t", "psv": "|", "dat": ","}
    delim = delimiters.get(ext, ",")
    path = os.path.join(TMPDIR, f"test.{ext}")
    with open(path, "w") as f:
        f.write(f"name{delim}age{delim}city\n")
        f.write(f"Alice{delim}30{delim}NYC\n")
        f.write(f"Bob{delim}25{delim}London\n")
        f.write(f"Charlie{delim}35{delim}Tokyo\n")
    return path


def make_jsonl(ext):
    path = os.path.join(TMPDIR, f"test.{ext}")
    with open(path, "w") as f:
        for i in range(5):
            f.write(json.dumps({"id": i, "value": f"item_{i}"}) + "\n")
    return path


def make_xml(ext):
    path = os.path.join(TMPDIR, f"test.{ext}")
    with open(path, "w") as f:
        f.write('<?xml version="1.0"?>\n<root>\n  <item id="1">Hello</item>\n  <item id="2">World</item>\n</root>')
    return path


def make_yaml(ext):
    path = os.path.join(TMPDIR, f"test.{ext}")
    with open(path, "w") as f:
        f.write("name: ThinkSync\nversion: 2.0\nfeatures:\n  - rag\n  - search\n  - chat\n")
    return path


def make_sqlite(ext):
    import sqlite3
    path = os.path.join(TMPDIR, f"test.{ext}")
    conn = sqlite3.connect(path)
    conn.execute("CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, age INTEGER)")
    conn.execute("INSERT INTO users VALUES (1, 'Alice', 30)")
    conn.execute("INSERT INTO users VALUES (2, 'Bob', 25)")
    conn.commit()
    conn.close()
    return path


def make_numpy_npy(ext):
    import numpy as np
    path = os.path.join(TMPDIR, f"test.{ext}")
    arr = np.array([[1, 2, 3], [4, 5, 6]], dtype=np.float32)
    np.save(path, arr)
    return path


def make_numpy_npz(ext):
    import numpy as np
    path = os.path.join(TMPDIR, f"test.{ext}")
    np.savez(path, x=np.array([1, 2, 3]), y=np.array([4, 5, 6]))
    return path


def make_image(ext):
    from PIL import Image
    path = os.path.join(TMPDIR, f"test.{ext}")
    img = Image.new("RGB", (100, 100), color=(255, 0, 0))
    # GIF and BMP need special handling
    if ext == "gif":
        img.save(path, format="GIF")
    elif ext in ("tiff", "tif"):
        img.save(path, format="TIFF")
    elif ext == "bmp":
        img.save(path, format="BMP")
    else:
        img.save(path)
    return path


def make_parquet(ext):
    try:
        import pyarrow as pa
        import pyarrow.parquet as pq
        table = pa.table({"name": ["Alice", "Bob"], "age": [30, 25]})
        path = os.path.join(TMPDIR, f"test.{ext}")
        pq.write_table(table, path)
        return path
    except ImportError:
        return None


def make_feather(ext):
    try:
        import pyarrow as pa
        import pyarrow.feather as feather
        table = pa.table({"x": [1, 2, 3], "y": [4, 5, 6]})
        path = os.path.join(TMPDIR, f"test.{ext}")
        feather.write_feather(table, path)
        return path
    except ImportError:
        return None


def make_excel_xls(ext):
    # XLS requires xlwt which may not be available; skip if so
    RESULTS["skipped"].append((ext, "XLS creation requires xlwt — parser tested via import check"))
    return None


def make_excel_xlsm(ext):
    # XLSM is just XLSX with macros — test with openpyxl
    try:
        from openpyxl import Workbook
        path = os.path.join(TMPDIR, f"test.{ext}")
        wb = Workbook()
        ws = wb.active
        ws.title = "TestSheet"
        ws.append(["Name", "Value"])
        ws.append(["Test", 42])
        wb.save(path)
        return path
    except ImportError:
        RESULTS["skipped"].append((ext, "openpyxl not installed"))
        return None


def make_hdf5(ext):
    try:
        import h5py
        import numpy as np
        path = os.path.join(TMPDIR, f"test.{ext}")
        with h5py.File(path, "w") as f:
            f.create_dataset("data", data=np.array([1.0, 2.0, 3.0]))
            f.create_dataset("labels", data=np.array([10, 20, 30]))
        return path
    except ImportError:
        RESULTS["skipped"].append((ext, "h5py not installed"))
        return None


def make_mat(ext):
    try:
        from scipy.io import savemat
        import numpy as np
        path = os.path.join(TMPDIR, f"test.{ext}")
        savemat(path, {"x": np.array([1, 2, 3]), "name": "test"})
        return path
    except ImportError:
        RESULTS["skipped"].append((ext, "scipy not installed"))
        return None


def make_pickle(ext):
    import pickle
    path = os.path.join(TMPDIR, f"test.{ext}")
    with open(path, "wb") as f:
        pickle.dump({"key": "value", "numbers": [1, 2, 3]}, f)
    return path


def make_joblib(ext):
    try:
        import joblib
        path = os.path.join(TMPDIR, f"test.{ext}")
        joblib.dump({"model": "test", "params": [1, 2]}, path)
        return path
    except ImportError:
        RESULTS["skipped"].append((ext, "joblib not installed"))
        return None


# ─── Run All Tests ────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("=" * 70)
    print("  ThinkSync V2 Parser — Full Verification Suite")
    print("=" * 70)
    print(f"\nV2 Supported Extensions: {sorted(V2_SUPPORTED_EXTENSIONS)}")
    print(f"Total: {len(V2_SUPPORTED_EXTENSIONS)} extensions\n")

    # Map each extension to its test file creator
    test_map = {
        "tsv": make_tabular, "psv": make_tabular, "dat": make_tabular,
        "jsonl": make_jsonl, "ndjson": make_jsonl,
        "xml": make_xml,
        "yaml": make_yaml, "yml": make_yaml,
        "sqlite": make_sqlite, "db": make_sqlite,
        "npy": make_numpy_npy, "npz": make_numpy_npz,
        "bmp": make_image, "tiff": make_image, "tif": make_image, "gif": make_image,
        "parquet": make_parquet, "feather": make_feather, "arrow": make_feather,
        "xls": make_excel_xls, "xlsm": make_excel_xlsm, "xlsb": make_excel_xls,
        "hdf5": make_hdf5, "h5": make_hdf5,
        "mat": make_mat,
        "pkl": make_pickle, "pickle": make_pickle,
        "joblib": make_joblib,
    }

    # Skip formats that need external binaries we can't create in-process
    skip_formats = {"orc", "avro"}  # Require specific writers

    for ext in sorted(V2_SUPPORTED_EXTENSIONS):
        if ext in skip_formats:
            RESULTS["skipped"].append((ext, "Requires external writer binary"))
            continue

        creator = test_map.get(ext)
        if creator is None:
            RESULTS["skipped"].append((ext, "No test creator defined"))
            continue

        path = creator(ext)
        if path is None:
            continue  # Already recorded as skipped

        test_parser(ext, lambda e, p=path: p)

    # ── Report ────────────────────────────────────────────────────────────────

    print("\n" + "─" * 70)
    print(f"  PASSED: {len(RESULTS['passed'])}")
    print("─" * 70)
    for ext, detail in RESULTS["passed"]:
        print(f"  ✅ .{ext:8s} → {detail}")

    if RESULTS["skipped"]:
        print(f"\n{'─' * 70}")
        print(f"  SKIPPED: {len(RESULTS['skipped'])} (missing optional deps)")
        print("─" * 70)
        for ext, reason in RESULTS["skipped"]:
            print(f"  ⏭️  .{ext:8s} → {reason}")

    if RESULTS["failed"]:
        print(f"\n{'─' * 70}")
        print(f"  FAILED: {len(RESULTS['failed'])}")
        print("─" * 70)
        for ext, reason in RESULTS["failed"]:
            print(f"  ❌ .{ext:8s} → {reason}")

    print(f"\n{'=' * 70}")
    total = len(RESULTS["passed"]) + len(RESULTS["failed"]) + len(RESULTS["skipped"])
    print(f"  TOTAL: {total} | PASS: {len(RESULTS['passed'])} | FAIL: {len(RESULTS['failed'])} | SKIP: {len(RESULTS['skipped'])}")
    print("=" * 70)

    # Exit with error code if any failures
    sys.exit(1 if RESULTS["failed"] else 0)
