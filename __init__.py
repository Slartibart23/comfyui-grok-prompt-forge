from .grok_forge import models, routes
from .grok_forge.forge_node import GrokPromptForge
from .grok_text_refine_node import NODE_CLASS_MAPPINGS as _LEGACY_CLASSES
from .grok_text_refine_node import NODE_DISPLAY_NAME_MAPPINGS as _LEGACY_NAMES

__version__ = "3.0.1"

NODE_CLASS_MAPPINGS = {"GrokPromptForge": GrokPromptForge, **_LEGACY_CLASSES}
NODE_DISPLAY_NAME_MAPPINGS = {"GrokPromptForge": "Grok Prompt Forge (xAI)", **_LEGACY_NAMES}

WEB_DIRECTORY = "./web"

routes.register()
models.start_background_refresh()

__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]
