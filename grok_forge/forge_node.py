"""Grok Prompt Forge (xAI): one node for prompt writing, caption rewriting and
image captioning. A task preset fills the system prompt, the standard negative
prompt and the sampling settings; everything stays editable on the node and can
be saved as a preset of your own (see web/grok_prompt_forge.js)."""

from . import models, presets
from .api import (DEFAULT_BASE_URL, DEFAULT_KEY_FILE, DEFAULT_MODEL, apply_sampling_params,
                  chat, image_to_data_uri, resolve_api_key)
from .builtin_presets import BUILTIN, DEFAULT_PRESET

LOG = "[Grok Prompt Forge]"
NO_TRIGGER = "(none)"
IMAGE_SLOTS = 3

# Appended to every system prompt (built-in, edited or custom).
BINDING_RULE = """## The user's input is binding
Every explicit wish or instruction in the user's input must be carried out in the result - subjects, details, actions, style, wording, text to render, things to leave out, counts. If it conflicts with the guidance above, the user's input wins. Only the output format and the English-output rule stay as described above."""

WORDS_TOOLTIP = (
    "Optional length of the generated prompt in words: min_words / max_words. "
    "0 = off (the preset's own length guidance applies). When set, the range is "
    "binding for every preset, including your own system prompts. Tag lists count "
    "each tag as one word; multi-section formats (MiniMax H3) apply it to the main "
    "description.")


def length_rule(min_words, max_words):
    """System-prompt block for the optional word range ('' when both are 0)."""
    lo, hi = max(int(min_words or 0), 0), max(int(max_words or 0), 0)
    if lo and hi and lo > hi:
        lo, hi = hi, lo
    if lo and hi:
        target = f"between {lo} and {hi} words"
    elif lo:
        target = f"at least {lo} words"
    elif hi:
        target = f"at most {hi} words"
    else:
        return ""
    return (f"## Length (binding)\nThe result must have {target}. This overrides any "
            "length given above. Count only the words of the result itself; in tag lists "
            "each comma-separated tag counts as one word; in formats with several sections "
            "the range applies to the main description section (e.g. "
            "integrated_multimodal_description or detailed_description) and the other "
            "sections stay as described. Check the count before answering and adjust.")

IMAGE_TOOLTIP = (
    "Optional reference image {n} of 3. Grok sees it as 'Image {n}'. Connect a "
    "single image, not a batch (only the first image of a batch is used).\n"
    "How the presets use the images:\n"
    "- Caption > Describe image: image_1 is the image to caption.\n"
    "- Qwen-Image-Edit: image_1..3 are the edit's input images (Picture 1..3), "
    "in the same order as in your edit workflow.\n"
    "- MiniMax H3 FL2VA: image_1 = first frame, image_2 = last frame.\n"
    "- MiniMax H3 REF2VA: image_1..3 = reference pictures (people, places, "
    "objects, style).\n"
    "- Wan image-to-video: image_1 = start frame.\n"
    "- Every other preset: optional visual context Grok may take details from.\n"
    "Images cost extra tokens; max_side controls the upload size."
)


class GrokPromptForge:
    CATEGORY = "Grok/Text"
    RETURN_TYPES = ("STRING", "STRING")
    RETURN_NAMES = ("prompt", "negative_prompt")
    FUNCTION = "forge"
    DESCRIPTION = ("Turns a short idea or a caption (any language) into an English "
                   "prompt for the chosen target model, rewrites captions, or "
                   "captions an image - via the xAI Grok API.")

    @classmethod
    def INPUT_TYPES(cls):
        default = BUILTIN[DEFAULT_PRESET]
        model_names = models.model_list()
        optional = {
            "custom_system_prompt": ("STRING", {"forceInput": True, "tooltip":
                "Connect a text here to use it as the system prompt INSTEAD of "
                "the system_prompt field - it always wins over the preset. "
                "Leave unconnected (or empty) to use the preset."}),
        }
        for n in range(1, IMAGE_SLOTS + 1):
            optional[f"image_{n}"] = ("IMAGE", {"tooltip": IMAGE_TOOLTIP.format(n=n)})
        optional.update({
            "trigger_word": ("STRING", {"default": "", "tooltip":
                "Only for 'Caption > LoRA training caption': the LoRA's trigger "
                "token for the main subject (replaces {trigger} in the system "
                "prompt). Leave empty for captions without a trigger token."}),
            "max_side": ("INT", {"default": 1536, "min": 256, "max": 4096, "step": 64,
                "tooltip": "Downscale the longest image side before upload (saves "
                           "tokens; prompts and captions don't need full resolution)."}),
            "api_key": ("STRING", {"default": "", "tooltip":
                "Your xAI API key. Leave EMPTY if possible - keys typed here end "
                "up in exported workflows! Prefer the XAI_API_KEY environment "
                "variable or the key file below."}),
            "api_key_file": ("STRING", {"default": DEFAULT_KEY_FILE, "tooltip":
                "Path to a text file containing only your xAI API key. Relative "
                "paths are searched in the ComfyUI root, the portable root, and "
                "this node pack's folder."}),
            "base_url": ("STRING", {"default": DEFAULT_BASE_URL, "tooltip":
                "API endpoint. Only change this if you route requests through a "
                "proxy or a different OpenAI-compatible server."}),
            "fallback_to_input": ("BOOLEAN", {"default": True, "tooltip":
                "If the API call fails (no key, network error, refusal, ...), "
                "pass the input text through unchanged instead of stopping the "
                "queue. Keeps long batch runs alive."}),
            "timeout_seconds": ("INT", {"default": 180, "min": 10, "max": 900, "tooltip":
                "How long to wait for the API before retrying (3 attempts total). "
                "Reasoning models think before answering - keep this generous."}),
            # Added in 3.1.0. New widgets go last: saved workflows map widget
            # values by position, so inserting them earlier shifts old values.
            "min_words": ("INT", {"default": 0, "min": 0, "max": 2000, "step": 5,
                                  "tooltip": WORDS_TOOLTIP}),
            "max_words": ("INT", {"default": 0, "min": 0, "max": 2000, "step": 5,
                                  "tooltip": WORDS_TOOLTIP}),
        })
        return {
            "required": {
                "preset": (presets.names(), {"default": DEFAULT_PRESET, "tooltip":
                    "The task. Selecting a preset fills system_prompt, "
                    "negative_prompt, temperature, top_p and max_tokens with values "
                    "tuned for it. Change them freely and keep them with "
                    "'Save preset as...' under a name of your own.\n"
                    "Idea > ...: expand a short idea into a full prompt for that model.\n"
                    "Caption > ...: rewrite an existing caption faithfully (no new "
                    "content) into that model's prompt style.\n"
                    "Input may be in any language; the output is always English."}),
                "text": ("STRING", {"multiline": True, "default": "", "tooltip":
                    "Your input, in any language: a short idea, an existing caption, "
                    "or an edit request. You can also connect a text output (e.g. "
                    "JoyCaption or the Text File Loader) to this field."}),
                "system_prompt": ("STRING", {"multiline": True,
                    "default": default["system_prompt"], "tooltip":
                    "Instructions that define what Grok does. Filled by the preset; "
                    "edit freely. Ignored when custom_system_prompt is connected."}),
                "negative_prompt": ("STRING", {"multiline": True,
                    "default": default["negative_prompt"], "tooltip":
                    "Standard negative prompt for the target model, passed straight "
                    "to the negative_prompt output (not sent to Grok). Empty for "
                    "models that ignore negatives at CFG 1 (FLUX, Krea 2, Z-Image "
                    "Turbo, Qwen with Lightning LoRAs...)."}),
                "model": (model_names, {"default": DEFAULT_MODEL, "tooltip":
                    "xAI Grok model. Default: grok-4.20-0309-reasoning - it accepts "
                    "temperature and top_p. Use 'Refresh model list' to load the "
                    "current list from the API."}),
                "temperature": ("FLOAT", {"default": default["temperature"],
                    "min": 0.0, "max": 2.0, "step": 0.05, "tooltip":
                    "Creativity dial. Low (0.2-0.4) = faithful, repeatable - for "
                    "caption rewriting and edit instructions. High (0.8-1.0) = varied "
                    "- for expanding ideas. Above ~1.3 grammar falls apart."}),
                "top_p": ("FLOAT", {"default": default["top_p"],
                    "min": 0.05, "max": 1.0, "step": 0.01, "tooltip":
                    "Cutoff filter: drops the least likely words before picking. "
                    "1.0 = off (not sent). Keep it high (0.9-1.0) and steer with "
                    "temperature."}),
                "max_tokens": ("INT", {"default": default["max_tokens"],
                    "min": 256, "max": 32768, "step": 256, "tooltip":
                    "Upper limit for the answer INCLUDING the model's hidden "
                    "reasoning. Reasoning models spend several hundred to a few "
                    "thousand tokens thinking first - too low gives empty or cut-off "
                    "answers."}),
                "seed": ("INT", {"default": 0, "min": 0, "max": 0xffffffffffffffff,
                    "control_after_generate": True, "tooltip":
                    "Cache-breaker, NOT sent to the API. 'randomize' = fresh prompt "
                    "every queue run. 'fixed' = identical input reuses the cached "
                    "result (saves money when rewriting captions)."}),
            },
            "optional": optional,
        }

    @classmethod
    def VALIDATE_INPUTS(cls, preset, model):
        # The preset only labels the values on the node and the model list is
        # live from the API: a workflow from another machine (other presets,
        # older model list) must still run.
        return True

    def forge(self, preset, text, system_prompt, negative_prompt, model, temperature,
              top_p, max_tokens, seed=0, custom_system_prompt=None, image_1=None,
              image_2=None, image_3=None, trigger_word="", min_words=0, max_words=0,
              max_side=1536, api_key="",
              api_key_file=DEFAULT_KEY_FILE, base_url=DEFAULT_BASE_URL,
              fallback_to_input=True, timeout_seconds=180):
        text = text or ""
        negative = negative_prompt or ""
        # (slot number, image): an unconnected slot keeps the numbering of the others
        images = [(n, img) for n, img in enumerate((image_1, image_2, image_3), 1)
                  if img is not None]

        if not text.strip() and not images:
            print(f"{LOG} Empty input text and no image - nothing to do.")
            return ("", negative)

        system = system_prompt
        if custom_system_prompt and custom_system_prompt.strip():
            system = custom_system_prompt
        system = system.replace("{trigger}", (trigger_word or "").strip() or NO_TRIGGER)
        rules = [BINDING_RULE, length_rule(min_words, max_words)]
        system = "\n\n".join(part for part in [system.strip(), *rules] if part)

        try:
            key = resolve_api_key(api_key, api_key_file, log=LOG)
            messages = [{"role": "system", "content": system}]
            messages.append({"role": "user",
                             "content": self._user_content(text, images, max_side)})
            payload = {
                "model": model.strip(),
                "messages": messages,
                "temperature": float(temperature),
                "max_tokens": int(max_tokens),
            }
            apply_sampling_params(payload, top_p, None, None)
            result = chat(payload, key, base_url, timeout_seconds, log=LOG)
            if min_words or max_words:
                parts = len([p for p in result.split(",") if p.strip()])
                print(f"{LOG} result: {len(result.split())} words / {parts} comma-separated "
                      f"parts (range {min_words or '-'} to {max_words or '-'}).")
        except Exception as e:
            if fallback_to_input:
                print(f"{e} - falling back to input text.")
                return (text, negative)
            raise
        return (result, negative)

    @staticmethod
    def _user_content(text, images, max_side):
        if not images:
            return text
        for n, img in images:
            if getattr(img, "shape", None) is not None and len(img.shape) == 4 and img.shape[0] > 1:
                print(f"{LOG} image_{n} carries a batch of {img.shape[0]} - "
                      "only its first image is used.")
        labels = ", ".join(f"Image {n}" for n, _ in images)
        content = [{"type": "text", "text": f"Attached images: {labels}."}]
        for n, img in images:
            content.append({"type": "text", "text": f"Image {n}:"})
            content.append({"type": "image_url", "image_url": {
                "url": image_to_data_uri(img, 0, max_side), "detail": "high"}})
        content.append({"type": "text", "text": "User input:\n" + (
            text.strip() or "(no text - work from the images alone)")})
        return content
