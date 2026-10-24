"""Your library of persons and style blocks for Grok Prompt Forge.

Stored in ComfyUI/user/grok_prompt_forge/library.json - never in the node
pack, so personal characters stay on your machine and survive updates.

    person: name -> {"trigger", "description", "voice"}
    style:  name -> {"text"}
"""

import json
import os
import threading

from .api import user_dir

NONE = "(none)"
KINDS = {
    "person": {"key": "persons", "fields": ("trigger", "description", "voice")},
    "style": {"key": "styles", "fields": ("text",)},
}
MAX_NAME = 80

_lock = threading.Lock()


def _path():
    return os.path.join(user_dir(), "library.json")


def load():
    with _lock:
        return _read()


def _read():
    try:
        with open(_path(), "r", encoding="utf-8") as f:
            data = json.load(f)
    except FileNotFoundError:
        data = {}
    except Exception as e:
        print(f"[Grok Prompt Forge] library.json unreadable, ignoring it: {e}")
        data = {}
    if not isinstance(data, dict):
        data = {}
    out = {}
    for kind, spec in KINDS.items():
        entries = data.get(spec["key"])
        out[spec["key"]] = {n: _clean(kind, v) for n, v in entries.items()
                            if isinstance(v, dict)} if isinstance(entries, dict) else {}
    return out


def _write(data):
    path = _path()
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump({"version": 1, **data}, f, indent=2, ensure_ascii=False)
    os.replace(tmp, path)


def _clean(kind, values):
    return {f: str(values.get(f) or "").strip() for f in KINDS[kind]["fields"]}


def _check_name(name):
    name = (name or "").strip()
    if not name:
        raise ValueError("Name is empty.")
    if name == NONE:
        raise ValueError(f'"{NONE}" is reserved.')
    if len(name) > MAX_NAME:
        raise ValueError(f"Name is longer than {MAX_NAME} characters.")
    return name


def names(kind):
    return [NONE] + sorted(load()[KINDS[kind]["key"]], key=str.lower)


def get(kind, name):
    if not name or name == NONE:
        return None
    return load()[KINDS[kind]["key"]].get(name)


def save(kind, name, values, old_name=None):
    """Create or update an entry; old_name renames it."""
    name = _check_name(name)
    key = KINDS[kind]["key"]
    with _lock:
        data = _read()
        if old_name and old_name != name:
            data[key].pop(old_name, None)
        data[key][name] = _clean(kind, values)
        _write(data)
    return name


def delete(kind, name):
    key = KINDS[kind]["key"]
    with _lock:
        data = _read()
        if name not in data[key]:
            return False
        del data[key][name]
        _write(data)
    return True


def import_entries(payload, overwrite=False):
    """Merge an exported library. Existing names are kept unless overwrite.
    Returns (added, replaced, skipped)."""
    if not isinstance(payload, dict):
        raise ValueError("Not a Grok Prompt Forge library file.")
    added = replaced = skipped = 0
    with _lock:
        data = _read()
        for kind, spec in KINDS.items():
            entries = payload.get(spec["key"])
            if not isinstance(entries, dict):
                continue
            for name, values in entries.items():
                if not isinstance(values, dict):
                    continue
                try:
                    name = _check_name(name)
                except ValueError:
                    skipped += 1
                    continue
                if name in data[spec["key"]]:
                    if not overwrite:
                        skipped += 1
                        continue
                    replaced += 1
                else:
                    added += 1
                data[spec["key"]][name] = _clean(kind, values)
        _write(data)
    return added, replaced, skipped
