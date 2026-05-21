import base64
import io
from typing import Tuple
from PIL import Image, ImageFilter

MAX_DIMENSION = 1024  # Max width or height in pixels

def decode_base64_to_image(b64_string: str) -> Image.Image:
    """Decode a base64 string to a Pillow Image.
    Raises ValueError if decoding fails or image is unsupported.
    """
    try:
        image_data = base64.b64decode(b64_string)
        image = Image.open(io.BytesIO(image_data))
        image = image.convert("RGB")
        return image
    except Exception as e:
        raise ValueError(f"Invalid base64 image data: {e}")

def resize_image(image: Image.Image, max_dim: int = MAX_DIMENSION) -> Image.Image:
    """Resize image while keeping aspect ratio; max side length = max_dim.
    Returns a new Image instance.
    """
    width, height = image.size
    if max(width, height) <= max_dim:
        return image
    ratio = max_dim / float(max(width, height))
    new_size = (int(width * ratio), int(height * ratio))
    return image.resize(new_size, Image.LANCZOS)

def enhance_image(image: Image.Image) -> Image.Image:
    """Apply mild denoising and sharpening to improve OCR quality.
    Uses Pillow filters for speed and portability.
    """
    img = image.filter(ImageFilter.MedianFilter(size=3))
    img = img.filter(ImageFilter.SHARPEN)
    return img

def encode_image_to_bytes(image: Image.Image, fmt: str = "PNG") -> bytes:
    """Encode Pillow Image to raw bytes (PNG by default)."""
    buf = io.BytesIO()
    image.save(buf, format=fmt, optimize=True)
    return buf.getvalue()

def preprocess_image(b64_string: str) -> Tuple[bytes, Image.Image]:
    """Full preprocessing pipeline.
    Returns a tuple of (raw_bytes, Pillow Image) ready for downstream services.
    """
    img = decode_base64_to_image(b64_string)
    img = resize_image(img)
    img = enhance_image(img)
    raw_bytes = encode_image_to_bytes(img)
    return raw_bytes, img
