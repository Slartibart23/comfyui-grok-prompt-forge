"""Task presets of the Grok Prompt Forge node.

Built-in presets ship with the pack (builtin_presets.py). User presets are
saved under their own name in ComfyUI/user/grok_prompt_forge/presets.json, so
they survive updates and never end up in the repository. A user preset with
the name of a built-in one replaces it; deleting it brings the built-in back."""

import json
import os
import threading

from .api import user_dir
from .builtin_presets import BUILTIN, DEFAULT_PRESET

FIELDS = {
    "description": str,
    "system_prompt": str,
    "negative_prompt": str,
    "temperature": float,
    "top_p": float,
    "max_tokens": int,
}
LIMITS = {"temperature": (0.0, 2.0), "top_p": (0.05, 1.0), "max_tokens": (256, 32768)}
MAX_NAME = 80

_lock = threading.Lock()


def _path():
    return os.path.join(user_dir(), "presets.json")


def _load_user():
    try:
        with open(_path(), "r", encoding="utf-8") as f:
            data = json.load(f)
    except FileNotFoundError:
        return {}
    except Exception as e:
        print(f"[Grok Prompt Forge] presets.json unreadable, ignoring it: {e}")
        return {}
    presets = data.get("presets") if isinstance(data, dict) else None
    return presets if isinstance(presets, dict) else {}


def _save_user(presets):
    path = _path()
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump({"version": 1, "presets": presets}, f, indent=2, ensure_ascii=False)
    os.replace(tmp, path)


def clean(values):
    """Keep known fields, coerce types, clamp numbers."""
    out = {}
    for key, typ in FIELDS.items():
        if key not in values or values[key] is None:
            continue
        try:
            v = typ(values[key])
        except (TypeError, ValueError):
            continue
        if key in LIMITS:
            lo, hi = LIMITS[key]
            v = min(max(v, lo), hi)
        out[key] = v
    return out


def all_presets():
    """Ordered list: built-ins (or their user override) first, then user presets."""
    with _lock:
        user = _load_user()
    result = []
    for name, preset in BUILTIN.items():
        if name in user:
            result.append(dict(preset, **clean(user[name]), name=name, builtin=True, overridden=True))
        else:
            result.append(dict(preset, name=name, builtin=True, overridden=False))
    for name in sorted(n for n in user if n not in BUILTIN):
        base = {k: BUILTIN[DEFAULT_PRESET].get(k) for k in FIELDS}
        result.append(dict(base, **clean(user[name]), name=name, builtin=False, overridden=False))
    return result


def names():
    return [p["name"] for p in all_presets()]


def get(name):
    for p in all_presets():
        if p["name"] == name:
            return p
    return None


def save(name, values):
    name = (name or "").strip()
    if not name:
        raise ValueError("Preset name is empty.")
    if len(name) > MAX_NAME:
        raise ValueError(f"Preset name is longer than {MAX_NAME} characters.")
    with _lock:
        user = _load_user()
        user[name] = clean(values)
        _save_user(user)
    return get(name)


def delete(name):
    """Remove a user preset (or a user override of a built-in one).
    Returns True if something was removed."""
    with _lock:
        user = _load_user()
        if name not in user:
            return False
        del user[name]
        _save_user(user)
    return True
