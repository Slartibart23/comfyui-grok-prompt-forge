"""Shared xAI Grok API helpers: key resolution, image upload encoding and the
chat-completions request with retries."""

import os
import re
import time

import requests

DEFAULT_MODEL = "grok-4.20-0309-reasoning"
DEFAULT_BASE_URL = "https://api.x.ai/v1"
DEFAULT_KEY_FILE = "grok_api_key.txt"


def find_comfy_root():
    """Best-effort detection of the ComfyUI root directory."""
    try:
        import folder_paths  # available inside ComfyUI
        return folder_paths.base_path
    except Exception:
        pass
    # Fallback: three levels up from this file (custom_nodes/<pack>/grok_forge/..)
    here = os.path.dirname(os.path.abspath(__file__))
    candidate = os.path.abspath(os.path.join(here, "..", "..", ".."))
    return candidate if os.path.isdir(candidate) else os.getcwd()


def pack_dir():
    return os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def user_dir():
    """Per-install folder for user data (presets, model cache). Lives in
    ComfyUI/user, so it survives updates of this node pack."""
    try:
        import folder_paths
        base = folder_paths.get_user_directory()
    except Exception:
        base = os.path.join(find_comfy_root(), "user")
    path = os.path.join(base, "grok_prompt_forge")
    os.makedirs(path, exist_ok=True)
    return path


def resolve_api_key(api_key_widget: str, api_key_file: str, log="[Grok]",
                    quiet=False) -> str:
    """Widget > env var XAI_API_KEY > key file (absolute or relative to ComfyUI root)."""
    if api_key_widget and api_key_widget.strip():
        return api_key_widget.strip()

    env_key = os.environ.get("XAI_API_KEY", "").strip()
    if env_key:
        return env_key

    if api_key_file and api_key_file.strip():
        p = api_key_file.strip()
        candidates = []
        if os.path.isabs(p):
            candidates.append(p)
        else:
            root = find_comfy_root()
            candidates.append(os.path.join(root, p))                    # ComfyUI root (next to main.py)
            candidates.append(os.path.join(os.path.dirname(root), p))   # portable root (next to run_*.bat)
            candidates.append(os.path.join(pack_dir(), p))              # this node pack's folder
        for path in candidates:
            if os.path.isfile(path):
                with open(path, "r", encoding="utf-8") as f:
                    file_key = f.read().strip()
                if file_key:
                    return file_key
        if not quiet:
            print(f"{log} Key file not found. Searched: {', '.join(candidates)}")

    raise RuntimeError(
        f"{log} No xAI API key found. Provide it via the api_key widget, "
        "the XAI_API_KEY environment variable, or a key file (default: grok_api_key.txt "
        "in the ComfyUI root). Get a key at https://console.x.ai"
    )


def strip_wrapping(text: str) -> str:
    """Remove accidental markdown fences / surrounding quotes from the model output."""
    t = text.strip()
    if t.startswith("```"):
        lines = t.splitlines()
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip().startswith("```"):
            lines = lines[:-1]
        t = "\n".join(lines).strip()
    if len(t) >= 2 and t[0] == t[-1] and t[0] in ('"', "'"):
        t = t[1:-1].strip()
    return t


def apply_sampling_params(payload, top_p, presence_penalty, frequency_penalty):
    """Add optional sampling parameters to the request payload.

    Neutral values (top_p=1.0, penalties=0.0) are NOT sent at all — the API
    default is identical, and some xAI reasoning models reject these
    parameters outright when present."""
    if top_p is not None and float(top_p) < 1.0:
        payload["top_p"] = float(top_p)
    if presence_penalty is not None and abs(float(presence_penalty)) > 1e-9:
        payload["presence_penalty"] = float(presence_penalty)
    if frequency_penalty is not None and abs(float(frequency_penalty)) > 1e-9:
        payload["frequency_penalty"] = float(frequency_penalty)


# Maps the camelCase names in xAI error messages to our payload keys.
_REJECTABLE_PARAMS = {
    "presencepenalty": "presence_penalty",
    "frequencypenalty": "frequency_penalty",
    "topp": "top_p",
    "temperature": "temperature",
}


def strip_unsupported_param(payload, error_text):
    """If an HTTP 400 says the model doesn't support a sampling parameter,
    remove it from the payload so the request can be retried without it.
    Returns the removed payload key, or None if the error is something else."""
    m = re.search(r"does not support parameter\s+['\"]?([A-Za-z_]+)",
                  error_text or "")
    if not m:
        return None
    key = _REJECTABLE_PARAMS.get(m.group(1).lower().replace("_", ""))
    if key and key in payload:
        del payload[key]
        return key
    return None


def image_to_data_uri(image, image_index=0, max_side=1536, image_format="jpeg"):
    """ComfyUI IMAGE tensor (B,H,W,C floats 0..1) -> base64 data URI."""
    import base64
    import io

    import numpy as np
    from PIL import Image

    arr = image
    if hasattr(arr, "cpu"):  # torch tensor from ComfyUI
        arr = arr.cpu().numpy()
    arr = np.asarray(arr)
    if arr.ndim == 4:  # (B, H, W, C) — pick one image from the batch
        idx = min(int(image_index), arr.shape[0] - 1)
        arr = arr[idx]
    arr = np.clip(arr * 255.0, 0, 255).astype(np.uint8)

    img = Image.fromarray(arr)
    if max(img.size) > max_side:
        img.thumbnail((max_side, max_side), Image.LANCZOS)

    buf = io.BytesIO()
    if image_format == "png":
        img.save(buf, format="PNG")
        mime = "image/png"
    else:
        img.convert("RGB").save(buf, format="JPEG", quality=92)
        mime = "image/jpeg"
    b64 = base64.b64encode(buf.getvalue()).decode("ascii")
    return f"data:{mime};base64,{b64}"


def chat(payload, key, base_url=DEFAULT_BASE_URL, timeout_seconds=120,
         log="[Grok]"):
    """POST a chat-completions request and return the cleaned answer text.

    Retries twice on timeouts, connection errors, 429 and 5xx. A 400 about an
    unsupported sampling parameter strips that parameter and resends without
    using up a retry. Raises RuntimeError when everything failed."""
    url = base_url.rstrip("/") + "/chat/completions"
    headers = {
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }

    last_error = None
    attempt = 0
    while attempt < 3:  # 1 try + 2 retries on transient errors
        try:
            resp = requests.post(url, json=payload, headers=headers,
                                 timeout=timeout_seconds)
            if resp.status_code == 400:
                removed = strip_unsupported_param(payload, resp.text)
                if removed:
                    print(f"{log} Model '{payload['model']}' rejected "
                          f"'{removed}' — retrying without it.")
                    continue
            if resp.status_code in (429, 500, 502, 503, 504):
                last_error = RuntimeError(f"{log} HTTP {resp.status_code}: {resp.text[:300]}")
                attempt += 1
                time.sleep(2 * attempt)
                continue
            if resp.status_code != 200:
                raise RuntimeError(f"{log} HTTP {resp.status_code}: {resp.text[:500]}")

            data = resp.json()
            choices = data.get("choices") or []
            if not choices:
                raise RuntimeError(f"{log} Empty response: {str(data)[:500]}")
            content = (choices[0].get("message") or {}).get("content") or ""
            result = strip_wrapping(content)
            finish = choices[0].get("finish_reason")
            usage = data.get("usage") or {}
            reasoning = (usage.get("completion_tokens_details") or {}).get("reasoning_tokens")
            if not result:
                if finish == "length":
                    raise RuntimeError(
                        f"{log} max_tokens ({payload.get('max_tokens')}) was used up "
                        f"before any answer was written (reasoning tokens: "
                        f"{reasoning or '?'}). Raise max_tokens.")
                raise RuntimeError(f"{log} Model returned empty text.")
            if finish == "length":
                print(f"{log} WARNING: answer cut off at max_tokens="
                      f"{payload.get('max_tokens')} — raise max_tokens.")

            extra = f", reasoning={reasoning}" if reasoning else ""
            print(f"{log} OK (model={payload['model']}, "
                  f"tokens={usage.get('total_tokens', '?')}{extra}).")
            return result

        except (requests.Timeout, requests.ConnectionError) as e:
            last_error = e
            attempt += 1
            time.sleep(2 * attempt)
            continue

    raise RuntimeError(f"{log} Request failed after retries: {last_error}")
