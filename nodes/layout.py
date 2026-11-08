import numpy as np
import torch
from PIL import Image, ImageDraw
from comfy_api.latest import io
from .geometry import parse_state, build_elements

EMPTY = '{"version":1,"boxes":[],"grid":{"cols":32,"rows":32,"snap":true,"background":"#1d2939","alternate":"#253247"}}'


class MossCreateBoundingBoxes(io.ComfyNode):
    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="MossImageCreateBoundingBoxes",
            display_name="Create Bounding Boxes (MossImage)",
            category="MossImage/layout",
            description="Pixel-size region editor with numbered grid and overlapping-region selection. Connect elements to MOSS-Image Layout Prompt.",
            inputs=[io.Int.Input("width", default=1024, min=64, max=16384, step=16),
                    io.Int.Input("height", default=1024, min=64, max=16384, step=16),
                    io.String.Input("editor_state", default=EMPTY, socketless=True),
                    io.Image.Input("background", optional=True)],
            outputs=[io.Image.Output(display_name="preview"),
                     io.BoundingBox.Output(display_name="bboxes"),
                     io.Array.Output(display_name="elements"),
                     io.Int.Output(display_name="width"), io.Int.Output(display_name="height")],
        )

    @classmethod
    def execute(cls, width, height, editor_state=EMPTY, background=None):
        boxes = parse_state(editor_state, width, height)
        # Bound preview memory independently of the generation resolution.
        scale = min(1, 1536 / max(width, height))
        size = (max(1, round(width * scale)), max(1, round(height * scale)))
        image = Image.new("RGB", size, "#202938")
        ui = {"dims": [width, height]}
        if background is not None:
            arr = (background[0].detach().cpu().numpy() * 255).clip(0, 255).astype(np.uint8)
            image = Image.fromarray(arr).convert("RGB").resize(size, Image.Resampling.LANCZOS)
            # Match core CreateBoundingBoxes' background delivery protocol.
            import nodes
            ui["background_images"] = nodes.PreviewImage().save_images(background[:1], "moss.layout.background")["ui"]["images"]
        else:
            ui["background_images"] = []
        draw = ImageDraw.Draw(image)
        for i, box in enumerate(boxes):
            x, y, w, h = [box[k] * scale for k in ("x", "y", "width", "height")]
            color = (box["metadata"]["palette"] or ["#69d2ff"])[0]
            draw.rectangle((x, y, x+w, y+h), outline=color, width=2)
            draw.text((x+3, y+3), f'{i+1}: {box["width"]} x {box["height"]} px', fill=color)
        preview = torch.from_numpy(np.asarray(image).astype(np.float32) / 255).unsqueeze(0)
        return io.NodeOutput(preview, [boxes] if boxes else [], build_elements(boxes, width, height), width, height, ui=ui)
