"""List of xAI language models for the model dropdown.

Read from a cache file in ComfyUI/user/grok_prompt_forge/models.json, refreshed
in the background at startup and on demand (button on the node). Without a key
or network the built-in list below is used."""

import json
import os
import threading

import requests

from .api import DEFAULT_BASE_URL, DEFAULT_KEY_FILE, DEFAULT_MODEL, resolve_api_key, user_dir

LOG = "[Grok Prompt Forge]"

# State of the xAI API on 2026-10-24.
FALLBACK_MODELS = [
    "grok-4.20-0309-reasoning",
    "grok-4.20-0309-non-reasoning",
    "grok-4.3",
    "grok-4.5",
    "grok-4.6",
    "grok-4.7",
]

_lock = threading.Lock()
_models = None


def _cache_path():
    return os.path.join(user_dir(), "models.json")


def _usable(model_id):
    # Multi-agent models are rejected on chat completions ("Multi Agent
    # requests are not allowed on chat completions"), which this pack uses.
    return "multi-agent" not in model_id


def _ordered(ids):
    """Default model first, the rest sorted; models the nodes can't call are dropped."""
    rest = sorted({i for i in ids if _usable(i)} - {DEFAULT_MODEL})
    return [DEFAULT_MODEL] + rest


def model_list():
    global _models
    with _lock:
        if _models is None:
            try:
                with open(_cache_path(), "r", encoding="utf-8") as f:
                    cached = json.load(f).get("models") or []
            except Exception:
                cached = []
            _models = _ordered(cached or FALLBACK_MODELS)
        return list(_models)


def refresh(base_url=DEFAULT_BASE_URL, api_key_file=DEFAULT_KEY_FILE, timeout=15):
    """Fetch the current model ids from the API. Returns the new list, or
    raises RuntimeError (no key, network or HTTP error)."""
    global _models
    key = resolve_api_key("", api_key_file, log=LOG, quiet=True)
    resp = requests.get(base_url.rstrip("/") + "/language-models",
                        headers={"Authorization": f"Bearer {key}"}, timeout=timeout)
    if resp.status_code != 200:
        raise RuntimeError(f"{LOG} model list: HTTP {resp.status_code}: {resp.text[:200]}")
    ids = [m.get("id") for m in (resp.json().get("models") or []) if m.get("id")]
    if not ids:
        raise RuntimeError(f"{LOG} model list: API returned no models.")
    models = _ordered(ids)
    try:
        with open(_cache_path(), "w", encoding="utf-8") as f:
            json.dump({"models": models}, f, indent=2)
    except OSError as e:
        print(f"{LOG} could not write model cache: {e}")
    with _lock:
        _models = models
    return list(models)


def start_background_refresh():
    def run():
        try:
            refresh()
        except Exception as e:
            print(f"{LOG} model list not refreshed, using cached list ({e}).")

    threading.Thread(target=run, name="grok-forge-models", daemon=True).start()
