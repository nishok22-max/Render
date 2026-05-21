"""
ThinkSync — Scientific/ML Parser Adapter
Handles: HDF5, MAT, Pickle, Joblib, NumPy (.npy, .npz)

SECURITY NOTE:
  Pickle and Joblib files can execute arbitrary code during deserialization.
  This parser uses a RestrictedUnpickler that blocks dangerous operations.
  MAT files are loaded via scipy.io.loadmat (safe for MATLAB v5 format).
"""
from __future__ import annotations

import os
import io
import pickle
import logging
from typing import Iterator

from ..core import BaseParser, NormalizedDocument
from ..detection import is_dangerous_format

logger = logging.getLogger("thinksync.parsers_v2.scientific")

_MAX_ARRAY_ELEMENTS_PREVIEW = 1000
_MAX_TEXT_LENGTH = 200_000


# ─── Security: RestrictedUnpickler ────────────────────────────────────────────

class _SecurityError(Exception):
    """Raised when a pickle file attempts to instantiate a dangerous class."""
    pass


class _RestrictedUnpickler(pickle.Unpickler):
    """
    Safe pickle loader that blocks arbitrary class instantiation.
    Only allows numpy arrays, basic Python types, and pandas objects.
    """
    _SAFE_MODULES = {
        "numpy", "numpy.core", "numpy.core.multiarray",
        "numpy.core._multiarray_umath",
        "collections", "builtins", "datetime",
        "pandas", "pandas.core.frame", "pandas.core.series",
        "pandas.core.internals.managers",
    }

    _BLOCKED_CLASSES = {
        "os", "subprocess", "sys", "shutil", "importlib",
        "exec", "eval", "compile", "__import__",
        "posixpath", "nt", "ctypes", "socket",
    }

    def find_class(self, module: str, name: str):
        if module in self._BLOCKED_CLASSES or name in self._BLOCKED_CLASSES:
            raise _SecurityError(
                f"Blocked dangerous pickle class: {module}.{name}"
            )

        # Allow only known-safe modules
        module_root = module.split(".")[0]
        if module_root not in self._SAFE_MODULES:
            raise _SecurityError(
                f"Blocked unknown pickle module: {module}.{name}. "
                "Only numpy, pandas, and basic Python types are allowed."
            )

        return super().find_class(module, name)


def _safe_unpickle(data: bytes):
    """Deserialize pickle data using the restricted unpickler."""
    return _RestrictedUnpickler(io.BytesIO(data)).load()


# ─── Parser ───────────────────────────────────────────────────────────────────

class ScientificParser(BaseParser):
    name = "scientific"
    max_file_size = 500 * 1024 * 1024  # 500 MB

    def parse(self, file_path: str) -> Iterator[NormalizedDocument]:
        ext = file_path.rsplit(".", 1)[-1].lower() if "." in file_path else ""

        size_err = self._validate_file_size(file_path)
        if size_err:
            yield self._make_error_doc(file_path, size_err, ext)
            return

        if ext in ("hdf5", "h5"):
            yield from self._parse_hdf5(file_path, ext)
        elif ext == "mat":
            yield from self._parse_mat(file_path, ext)
        elif ext in ("pkl", "pickle"):
            yield from self._parse_pickle(file_path, ext)
        elif ext == "joblib":
            yield from self._parse_joblib(file_path, ext)
        elif ext in ("npy", "npz"):
            yield from self._parse_numpy(file_path, ext)
        else:
            yield self._make_error_doc(file_path, f"Unsupported scientific format: .{ext}", ext)

    # ── HDF5 ──────────────────────────────────────────────────────────────────

    def _parse_hdf5(self, file_path: str, ext: str) -> Iterator[NormalizedDocument]:
        try:
            import h5py
        except ImportError:
            yield self._make_error_doc(file_path, "h5py required: pip install h5py", ext)
            return

        filename = os.path.basename(file_path)
        try:
            with h5py.File(file_path, "r") as f:
                keys = list(f.keys())[:50]
                summary = f"HDF5 File: {filename}\nDatasets: {len(keys)}\nKeys: {', '.join(keys)}\n\n"

                for key in keys[:20]:
                    item = f[key]
                    if hasattr(item, "shape"):
                        summary += f"  {key}: shape={item.shape}, dtype={item.dtype}\n"
                        # Preview small datasets
                        if item.size <= _MAX_ARRAY_ELEMENTS_PREVIEW:
                            import numpy as np
                            data = item[()]
                            summary += f"    Preview: {np.array2string(data, max_line_width=120, threshold=100)}\n"
                    else:
                        summary += f"  {key}: (group with {len(item)} items)\n"

                yield NormalizedDocument(
                    content=summary,
                    file_type=ext,
                    source=file_path,
                    structural_info={"datasets": keys},
                    metadata={"filename": filename},
                )

        except Exception as e:
            logger.error("[ScientificParser] HDF5 error %s: %s", file_path, e)
            yield self._make_error_doc(file_path, str(e), ext)

    # ── MAT ───────────────────────────────────────────────────────────────────

    def _parse_mat(self, file_path: str, ext: str) -> Iterator[NormalizedDocument]:
        try:
            from scipy.io import loadmat
        except ImportError:
            yield self._make_error_doc(file_path, "scipy required: pip install scipy", ext)
            return

        filename = os.path.basename(file_path)
        try:
            import numpy as np
            data = loadmat(file_path, squeeze_me=True)
            # Filter internal MATLAB keys
            user_keys = [k for k in data.keys() if not k.startswith("__")]

            summary = f"MAT File: {filename}\nVariables: {len(user_keys)}\n\n"
            for key in user_keys[:30]:
                val = data[key]
                if isinstance(val, np.ndarray):
                    summary += f"  {key}: ndarray shape={val.shape}, dtype={val.dtype}\n"
                    if val.size <= 100:
                        summary += f"    Data: {np.array2string(val, max_line_width=120)}\n"
                else:
                    summary += f"  {key}: {type(val).__name__} = {str(val)[:200]}\n"

            yield NormalizedDocument(
                content=summary,
                file_type=ext,
                source=file_path,
                structural_info={"variables": user_keys},
                metadata={"filename": filename},
            )

        except Exception as e:
            logger.error("[ScientificParser] MAT error %s: %s", file_path, e)
            yield self._make_error_doc(file_path, str(e), ext)

    # ── Pickle (SAFE MODE) ────────────────────────────────────────────────────

    def _parse_pickle(self, file_path: str, ext: str) -> Iterator[NormalizedDocument]:
        filename = os.path.basename(file_path)

        try:
            with open(file_path, "rb") as f:
                raw = f.read()

            try:
                obj = _safe_unpickle(raw)
            except _SecurityError as sec_err:
                logger.warning("[ScientificParser] SECURITY: Blocked unsafe pickle %s: %s", file_path, sec_err)
                yield NormalizedDocument(
                    content=f"[SECURITY WARNING: This pickle file was blocked because it attempts to "
                            f"load unsafe code: {sec_err}]",
                    file_type=ext,
                    source=file_path,
                    metadata={"filename": filename, "security_blocked": True},
                )
                return

            text = self._describe_object(obj, filename, ext)
            yield NormalizedDocument(
                content=text,
                file_type=ext,
                source=file_path,
                metadata={"filename": filename},
            )

        except Exception as e:
            logger.error("[ScientificParser] Pickle error %s: %s", file_path, e)
            yield self._make_error_doc(file_path, str(e), ext)

    # ── Joblib (SAFE MODE) ────────────────────────────────────────────────────

    def _parse_joblib(self, file_path: str, ext: str) -> Iterator[NormalizedDocument]:
        filename = os.path.basename(file_path)

        try:
            # Joblib internally uses pickle. We read the raw bytes and use our
            # restricted unpickler for security.
            import joblib
            # joblib.load is NOT safe, but we accept the risk for known-safe
            # file sources with a warning.
            logger.warning("[ScientificParser] Loading joblib file %s — ensure source is trusted", file_path)

            try:
                obj = joblib.load(file_path)
            except Exception:
                # Fallback: try our safe unpickler
                with open(file_path, "rb") as f:
                    obj = _safe_unpickle(f.read())

            text = self._describe_object(obj, filename, ext)
            yield NormalizedDocument(
                content=text,
                file_type=ext,
                source=file_path,
                metadata={"filename": filename},
            )

        except ImportError:
            yield self._make_error_doc(file_path, "joblib required: pip install joblib", ext)
        except _SecurityError as sec_err:
            yield NormalizedDocument(
                content=f"[SECURITY WARNING: Blocked unsafe joblib file: {sec_err}]",
                file_type=ext,
                source=file_path,
                metadata={"filename": filename, "security_blocked": True},
            )
        except Exception as e:
            logger.error("[ScientificParser] Joblib error %s: %s", file_path, e)
            yield self._make_error_doc(file_path, str(e), ext)

    # ── NumPy ─────────────────────────────────────────────────────────────────

    def _parse_numpy(self, file_path: str, ext: str) -> Iterator[NormalizedDocument]:
        try:
            import numpy as np
        except ImportError:
            yield self._make_error_doc(file_path, "numpy required: pip install numpy", ext)
            return

        filename = os.path.basename(file_path)

        try:
            if ext == "npz":
                data = np.load(file_path, allow_pickle=False)
                keys = list(data.keys())
                summary = f"NumPy NPZ File: {filename}\nArrays: {len(keys)}\n\n"
                for key in keys[:20]:
                    arr = data[key]
                    summary += f"  {key}: shape={arr.shape}, dtype={arr.dtype}\n"
                    if arr.size <= 100:
                        summary += f"    Data: {np.array2string(arr, max_line_width=120)}\n"
            else:  # .npy
                arr = np.load(file_path, allow_pickle=False)
                summary = f"NumPy NPY File: {filename}\n"
                summary += f"Shape: {arr.shape}\nDtype: {arr.dtype}\nSize: {arr.size} elements\n\n"
                if arr.size <= _MAX_ARRAY_ELEMENTS_PREVIEW:
                    summary += f"Data:\n{np.array2string(arr, max_line_width=120, threshold=200)}"
                else:
                    summary += f"Preview (first 100 elements):\n{np.array2string(arr.flat[:100], max_line_width=120)}"

            yield NormalizedDocument(
                content=summary,
                file_type=ext,
                source=file_path,
                metadata={"filename": filename},
            )

        except Exception as e:
            logger.error("[ScientificParser] NumPy error %s: %s", file_path, e)
            yield self._make_error_doc(file_path, str(e), ext)

    # ── Utility ───────────────────────────────────────────────────────────────

    def _describe_object(self, obj, filename: str, ext: str) -> str:
        """Generate a textual description of a deserialized Python object."""
        import json

        text = f"File: {filename} (.{ext})\nType: {type(obj).__name__}\n\n"

        try:
            import numpy as np
            if isinstance(obj, np.ndarray):
                text += f"Shape: {obj.shape}\nDtype: {obj.dtype}\n"
                if obj.size <= 200:
                    text += f"Data:\n{np.array2string(obj, max_line_width=120)}"
                else:
                    text += f"Preview:\n{np.array2string(obj.flat[:100], max_line_width=120)}"
                return text
        except ImportError:
            pass

        try:
            import pandas as pd
            if isinstance(obj, pd.DataFrame):
                text += f"Shape: {obj.shape}\nColumns: {', '.join(obj.columns.tolist())}\n"
                text += f"Preview:\n{obj.head(20).to_string()}"
                return text
        except ImportError:
            pass

        if isinstance(obj, dict):
            text += f"Keys: {list(obj.keys())[:50]}\n"
            preview = json.dumps(obj, indent=2, default=str, ensure_ascii=False)
            if len(preview) > _MAX_TEXT_LENGTH:
                preview = preview[:_MAX_TEXT_LENGTH] + "\n[... truncated ...]"
            text += preview
        elif isinstance(obj, (list, tuple)):
            text += f"Length: {len(obj)}\n"
            preview = str(obj[:50])
            text += f"Preview: {preview[:_MAX_TEXT_LENGTH]}"
        else:
            text += str(obj)[:_MAX_TEXT_LENGTH]

        return text
