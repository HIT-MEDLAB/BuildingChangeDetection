"""
ML Service for Building Change Detection.

This FastAPI application provides a single endpoint that accepts two images
and returns detected changes between them. Currently returns mock data —
students will integrate the actual Tiny-CD model.
"""

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware

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

    # --- MOCK RESPONSE ---
    # TODO: Replace with actual Tiny-CD inference
    # The bounding box format is {x, y, w, h} in pixels relative to the image dimensions
    mock_result = {
        "changes_detected": True,
        "bounding_boxes": [
            {"x": 120, "y": 85, "w": 200, "h": 150},
            {"x": 400, "y": 300, "w": 80, "h": 60},
        ],
        "confidence": 0.87,
    }

    return mock_result
