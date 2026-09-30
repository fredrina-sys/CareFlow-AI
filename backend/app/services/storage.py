import os, uuid
from app.core.config import settings

class LocalStorage:
    """Swap for S3/GCS by implementing save/read with the same signatures."""
    def save(self, data: bytes, ext: str) -> str:
        os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
        key = f"{uuid.uuid4().hex}{ext}"
        with open(os.path.join(settings.UPLOAD_DIR, key), "wb") as f: f.write(data)
        return key
    def read(self, key: str) -> bytes:
        with open(os.path.join(settings.UPLOAD_DIR, os.path.basename(key)), "rb") as f: return f.read()

storage = LocalStorage()
