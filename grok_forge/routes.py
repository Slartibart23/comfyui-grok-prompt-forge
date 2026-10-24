"""HTTP routes used by web/grok_prompt_forge.js (all under /grok_prompt_forge/)."""

from . import models, presets

LOG = "[Grok Prompt Forge]"


def register():
    try:
        from aiohttp import web
        from server import PromptServer
    except Exception as e:  # pragma: no cover
        print(f"{LOG} routes not registered: {e}")
        return

    srv = PromptServer.instance
    if getattr(srv, "_grok_forge_routes_registered", False):
        return
    srv._grok_forge_routes_registered = True
    no_store = {"Cache-Control": "no-store"}

    @srv.routes.get("/grok_prompt_forge/presets")
    async def grok_forge_presets(request):
        return web.json_response({"presets": presets.all_presets()}, headers=no_store)

    @srv.routes.post("/grok_prompt_forge/presets")
    async def grok_forge_save_preset(request):
        try:
            body = await request.json()
            preset = presets.save(body.get("name"), body.get("values") or {})
        except Exception as e:
            return web.json_response({"error": str(e)}, status=400)
        return web.json_response({"preset": preset, "presets": presets.all_presets()})

    @srv.routes.post("/grok_prompt_forge/presets/delete")
    async def grok_forge_delete_preset(request):
        try:
            body = await request.json()
            removed = presets.delete(body.get("name") or "")
        except Exception as e:
            return web.json_response({"error": str(e)}, status=400)
        return web.json_response({"removed": removed, "presets": presets.all_presets()})

    @srv.routes.get("/grok_prompt_forge/models")
    async def grok_forge_models(request):
        if request.query.get("refresh"):
            import asyncio
            try:
                await asyncio.get_running_loop().run_in_executor(None, models.refresh)
            except Exception as e:
                return web.json_response({"error": str(e), "models": models.model_list()},
                                         status=502)
        return web.json_response({"models": models.model_list()}, headers=no_store)
