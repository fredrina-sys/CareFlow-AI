import io
import logging
import asyncio
from concurrent.futures import ThreadPoolExecutor
from PIL import Image

log = logging.getLogger("careflow.ocr")

def _run_coro_safely(coro):
    """Executes a coroutine safely whether or not an event loop is already running."""
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = None

    if loop is not None and loop.is_running():
        with ThreadPoolExecutor(max_workers=1) as pool:
            return pool.submit(asyncio.run, coro).result()
    else:
        return asyncio.run(coro)

def ocr_image_bytes(img_bytes: bytes) -> tuple[str, float | None]:
    """Runs Windows Native Media OCR or pytesseract on image bytes."""
    # 1. Try native Windows Media OCR (built-in Windows 10 & 11)
    try:
        import winrt.windows.media.ocr as ocr
        import winrt.windows.graphics.imaging as imaging
        import winrt.windows.storage.streams as streams

        async def _win_ocr():
            stream = streams.InMemoryRandomAccessStream()
            writer = streams.DataWriter(stream)
            writer.write_bytes(img_bytes)
            await writer.store_async()
            await writer.flush_async()
            stream.seek(0)
            decoder = await imaging.BitmapDecoder.create_async(stream)
            bitmap = await decoder.get_software_bitmap_async()
            engine = ocr.OcrEngine.try_create_from_user_profile_languages()
            res = await engine.recognize_async(bitmap)
            lines = [line.text for line in res.lines] if hasattr(res, "lines") else [res.text]
            return "\n".join(lines).strip(), 94.0

        text, conf = _run_coro_safely(_win_ocr())
        if text:
            return text, conf
    except Exception as e:
        log.debug("Windows native OCR skipped: %s", e)

    # 2. Try pytesseract (if tesseract binary is installed in system PATH)
    try:
        import pytesseract
        img = Image.open(io.BytesIO(img_bytes))
        d = pytesseract.image_to_data(img, output_type=pytesseract.Output.DICT)
        confs = [float(c) for c in d["conf"] if str(c) not in ("-1", "")]
        text = pytesseract.image_to_string(img).strip()
        conf = round(sum(confs) / len(confs), 1) if confs else None
        if text:
            return text, conf
    except Exception as e:
        log.debug("Pytesseract skipped: %s", e)

    return "", None

def run_ocr(data: bytes, content_type: str) -> dict:
    """Extracts text from PDF (digital or scanned) or Image.
    Returns {status: 'DONE'|'UNAVAILABLE', text: str|None, confidence: float|None}.
    Never raises exceptions. Output is marked OCR_EXTRACTED.
    """
    try:
        if content_type == "application/pdf":
            # Tier 1: Try digital text extraction via pypdf
            try:
                from pypdf import PdfReader
                reader = PdfReader(io.BytesIO(data))
                digital_text = "\n".join((pg.extract_text() or "") for pg in reader.pages).strip()
                if len(digital_text) > 40:
                    return {"status": "DONE", "text": digital_text, "confidence": 99.0}
            except Exception as e:
                log.debug("Digital PDF extraction skipped: %s", e)

            # Tier 2: Scanned / Image-based PDF: rasterize pages to images and run OCR
            extracted_pages = []
            try:
                import pypdfium2 as pdfium
                pdf = pdfium.PdfDocument(data)
                for i, page in enumerate(pdf):
                    pil_img = page.render(scale=2).to_pil()
                    buf = io.BytesIO()
                    pil_img.save(buf, format="PNG")
                    page_text, _ = ocr_image_bytes(buf.getvalue())
                    if page_text:
                        extracted_pages.append(f"--- Page {i + 1} ---\n{page_text}")
            except Exception as e:
                log.warning("pypdfium2 rasterization failed: %s", e)

            full_text = "\n\n".join(extracted_pages).strip()
            if full_text:
                return {"status": "DONE", "text": full_text, "confidence": 92.5}
            return {"status": "UNAVAILABLE", "text": None, "confidence": None}

        # Standalone images (PNG / JPG / JPEG)
        text, conf = ocr_image_bytes(data)
        if text:
            return {"status": "DONE", "text": text, "confidence": conf or 90.0}
        return {"status": "UNAVAILABLE", "text": None, "confidence": None}
    except Exception as e:
        log.error("run_ocr top-level error: %s", e)
        return {"status": "UNAVAILABLE", "text": None, "confidence": None}
