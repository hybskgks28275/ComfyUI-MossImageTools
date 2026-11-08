from comfy_api.latest import ComfyExtension, io
from .nodes.layout import MossCreateBoundingBoxes

WEB_DIRECTORY = "./web"


class MossImageToolsExtension(ComfyExtension):
    async def get_node_list(self) -> list[type[io.ComfyNode]]:
        return [MossCreateBoundingBoxes]


async def comfy_entrypoint() -> MossImageToolsExtension:
    return MossImageToolsExtension()
