"""Grok Show Prompt: shows a text on the node and passes it through unchanged.

Counting (words, tags, sentences, characters) and the on/off switch for it
live in web/grok_prompt_forge.js and are display only, so switching them never
re-runs this node or anything after it."""


class GrokShowPrompt:
    CATEGORY = "Grok/Text"
    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("text",)
    FUNCTION = "show"
    OUTPUT_NODE = True
    DESCRIPTION = ("Shows the text on the node with its word, tag, sentence and character "
                   "count, and passes it on unchanged.")

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "text": ("STRING", {"forceInput": True, "tooltip":
                    "Any text, e.g. the prompt output of Grok Prompt Forge. It is shown on "
                    "the node and passed on unchanged - counting never changes it and "
                    "never starts a new run."}),
            },
        }

    def show(self, text):
        text = text if isinstance(text, str) else str(text or "")
        return {"ui": {"text": [text]}, "result": (text,)}
