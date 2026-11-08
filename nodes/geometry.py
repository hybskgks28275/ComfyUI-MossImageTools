"""Pixel editor state to ComfyUI BOUNDING_BOX and MOSS ARRAY. No runtime dependencies."""
import json
import math
import re


def parse_state(value, width, height):
    state = json.loads(value) if isinstance(value, str) else value
    if not isinstance(state, dict) or state.get("version") != 1:
        raise ValueError("Unsupported layout state. Expected version 1 JSON object.")
    boxes = state.get("boxes", [])
    if not isinstance(boxes, list) or len(boxes) > 512:
        raise ValueError("boxes must be a list with at most 512 regions.")
    result = []
    for i, box in enumerate(boxes):
        if not isinstance(box, dict):
            raise ValueError(f"Region {i + 1} must be an object.")
        values = [box.get(k, 0) for k in ("x", "y", "width", "height")]
        if any(isinstance(v, bool) or not isinstance(v, (int, float)) or not math.isfinite(v) for v in values):
            raise ValueError(f"Region {i + 1}: coordinates must be finite numbers.")
        x, y, w, h = values
        if w == 0 or h == 0:
            raise ValueError(f"Region {i + 1} has no area inside the canvas.")
        x0, x1 = sorted((x, x + w))
        y0, y1 = sorted((y, y + h))
        # Match the editor when linked dimensions shrink around existing regions.
        x0 = max(0, min(width - 1, round(x0)))
        y0 = max(0, min(height - 1, round(y0)))
        x1 = max(x0 + 1, min(width, round(x1)))
        y1 = max(y0 + 1, min(height, round(y1)))
        palette = box.get("palette", [])
        if not isinstance(palette, list) or any(not isinstance(c, str) or not re.fullmatch(r"#[0-9a-fA-F]{6}", c) for c in palette):
            raise ValueError(f"Region {i + 1}: palette requires #RRGGBB colors.")
        result.append({"x": x0, "y": y0, "width": x1-x0, "height": y1-y0,
                       "metadata": {"type": "text" if box.get("type") == "text" else "obj",
                                    "text": str(box.get("text", "")), "desc": str(box.get("desc", "")),
                                    "palette": palette[:5]}})
    return result


def build_elements(boxes, width, height):
    elements = []
    for box in boxes:
        meta = box["metadata"]
        el = {"type": meta["type"], "desc": meta["desc"],
              "bbox": [round(box["y"] / height * 1000), round(box["x"] / width * 1000),
                       round((box["y"] + box["height"]) / height * 1000),
                       round((box["x"] + box["width"]) / width * 1000)]}
        if meta["type"] == "text":
            el["text"] = meta["text"]
        if meta["palette"]:
            el["color_palette"] = meta["palette"]
        elements.append(el)
    return elements
