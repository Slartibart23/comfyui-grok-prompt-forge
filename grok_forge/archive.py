"""Prompt archive: every result of Grok Prompt Forge (when `archive` is on) is
appended as one JSON line to ComfyUI/user/grok_prompt_forge/archive.jsonl."""

import json
import os
import threading
import time

from .api import user_dir

_lock = threading.Lock()


def _path():
    return os.path.join(user_dir(), "archive.jsonl")


def append(entry):
    entry = dict(entry, time=time.strftime("%Y-%m-%d %H:%M:%S"))
    line = json.dumps(entry, ensure_ascii=False)
    with _lock:
        with open(_path(), "a", encoding="utf-8") as f:
            f.write(line + "\n")


def entries(limit=200, query=""):
    """Newest first, optionally filtered by a case-insensitive search text."""
    try:
        with open(_path(), "r", encoding="utf-8") as f:
            lines = f.readlines()
    except FileNotFoundError:
        return []
    q = (query or "").lower().strip()
    out = []
    for line in reversed(lines):
        try:
            entry = json.loads(line)
        except ValueError:
            continue
        if q and q not in json.dumps(entry, ensure_ascii=False).lower():
            continue
        out.append(entry)
        if len(out) >= limit:
            break
    return out
