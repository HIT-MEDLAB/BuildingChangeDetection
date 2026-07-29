"""
ML Service for Building Change Detection.

This FastAPI application provides a single endpoint that accepts two images
and returns detected changes between them. Currently returns mock data —
students will integrate the actual Tiny-CD model.
"""

import io

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image, UnidentifiedImageError

app = FastAPI(
    title="BCD ML Service",
    description="Change detection inference service using Tiny-CD",
    version="0.1.0",
)

# CORS — only the backend should call this service, but we allow it for
# development flexibility
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["POST"],
    allow_headers=["*"],
)


@app.get("/health")
def health_check():
    return {"status": "ok", "model_loaded": False}


@app.post("/predict")
async def predict(
    image_before: UploadFile = File(..., description="The baseline (earlier) image"),
    image_after: UploadFile = File(..., description="The current (later) image"),
):
    """
    Accept two images and return detected changes.

    Currently returns MOCK DATA. To integrate the real model:

    1. Download the Tiny-CD pre-trained weights (see README or paper)
    2. Load the model in a startup event (app.on_event("startup"))
    3. Preprocess the uploaded images (resize, normalize, tensor conversion)
    4. Run inference: model(image_before_tensor, image_after_tensor)
    5. Post-process the output (threshold the change map, extract bounding boxes)
    6. Return real results instead of the mock data below

    Tiny-CD paper: https://arxiv.org/abs/2207.13159
    """

    # Validate that files are images
    for img in [image_before, image_after]:
        if not img.content_type or not img.content_type.startswith("image/"):
            raise HTTPException(
                status_code=400,
                detail=f"File '{img.filename}' is not an image (got {img.content_type})",
            )

    # NFR-REL-01 / REQ-CORE-06: gracefully handle incompatible images —
    # corrupt files, or a pair the model can't reasonably compare — instead
    # of crashing or letting bad data reach the "model".
    before_bytes = await image_before.read()
    after_bytes = await image_after.read()

    sizes = {}
    for label, data, upload in [("before", before_bytes, image_before), ("after", after_bytes, image_after)]:
        try:
            with Image.open(io.BytesIO(data)) as im:
                im.verify()
            # verify() invalidates the image object per Pillow docs — reopen to read .size
            with Image.open(io.BytesIO(data)) as im:
                sizes[label] = im.size
        except (UnidentifiedImageError, OSError):
            raise HTTPException(
                status_code=422,
                detail=f"Comparison failed - '{upload.filename}' could not be read (corrupt or unsupported image data)",
            )

    # Reject pairs the model can't meaningfully compare: wildly different
    # aspect ratios usually mean different camera angles/framing, not a
    # detectable change at the same location.
    before_w, before_h = sizes["before"]
    after_w, after_h = sizes["after"]
    before_ratio = before_w / before_h
    after_ratio = after_w / after_h
    ratio_diff = abs(before_ratio - after_ratio) / before_ratio

    if ratio_diff > 0.25:
        raise HTTPException(
            status_code=422,
            detail="Comparison failed - camera angles are too different between the two images",
        )

    # --- MOCK RESPONSE ---
    # TODO: Replace with actual Tiny-CD inference
    # The bounding box format is {x, y, w, h} in pixels relative to the image dimensions.
    #
    # Bug fixed here (found via a broken-looking PDF report - boxes drawn outside
    # the image, or in seemingly random spots): these used to be hardcoded absolute
    # pixel values (e.g. {"x": 400, "y": 300, ...}), which only look right for a
    # coincidentally-sized image. Every real uploaded photo has different pixel
    # dimensions, so a box like y=300,h=60 can land entirely below the bottom edge
    # of a smaller image, or bunched into a tiny corner of a much larger one - both
    # the backend's PDF report and the standalone processed image trust these
    # coordinates completely and simply place a rectangle at (x, y, w, h) on top of
    # the real "after" image, so garbage in the mock is garbage in every artifact
    # that draws it. Deriving the boxes as a proportion of the real "after" image's
    # own dimensions (already read above via Pillow) guarantees they always land
    # sensibly inside the image, regardless of its actual resolution.
    mock_result = {
        "changes_detected": True,
        "bounding_boxes": [
            {
                "x": round(after_w * 0.15),
                "y": round(after_h * 0.15),
                "w": round(after_w * 0.30),
                "h": round(after_h * 0.35),
            },
            {
                "x": round(after_w * 0.55),
                "y": round(after_h * 0.55),
                "w": round(after_w * 0.15),
                "h": round(after_h * 0.15),
            },
        ],
        "confidence": 0.87,
    }

    return mock_result
