# Changelog

## 3.2.0 — 2026-10-24

- **Persons:** up to four persons per prompt (`person_1` … `person_4`) from your own library.
  - Each person has a name, a LoRA trigger, a description and a voice.
  - Selected persons are binding. The name always appears in the prompt and can also act as the trigger. The trigger is written exactly, and the description is used as given (as tags in tag models).
  - Every pose, action and line of dialogue is attributed to a person by name.
  - The voice is used only by models with audio (MiniMax H3, Wan 2.7, Wan 3.0).
  - Your text can refer to them by name or as "Person N".
- **Linked reference images:** with `image_n_is_person_n` on, `image_N` shows Person N. The prompt then points at the image with the model's reference syntax (`<imageN>`, `<Picture N>`, "Image N") instead of describing the face.
- **Style blocks:** `style_1` / `style_2` apply saved texts, such as a camera look, a lighting mood or a ban list, to every result.
- **Library dialog** "👤 Persons & styles...": create, edit, rename and delete entries, and export or import them as JSON (e.g. between two ComfyUI installs).
  - Stored in `ComfyUI/user/grok_prompt_forge/library.json`, never in the node pack.
  - Renaming or deleting an entry updates the selection boxes.
  - An edited description makes the node run again.
- **Prompt archive:** with `archive` on (default), every result is appended to `ComfyUI/user/grok_prompt_forge/archive.jsonl` together with its input, preset, persons and settings. "📜 Load from archive..." searches the archive. "Use as text" puts the prompt back into the text field; "Recast" also selects the new preset.
- **New preset "Recast ▸ Swap persons":** swaps the persons in an existing prompt for the selected ones and adapts pronouns and gendered details. Action, background, style, format and length stay as they are.
- **New node: Grok Show Prompt.** It shows a text and passes it on unchanged.
  - A status line counts words, tags, sentences and characters; switch it off with "show counts".
  - Counting is done locally and is display only: switching or recounting never re-runs a node.
  - The last text is kept with the workflow.
- **Language switch English / Deutsch** at the top of both nodes. It translates field labels, tooltips (including those of the input sockets), inputs and outputs, buttons, dialogs, notifications and the preset notes.
  - Display only: it is not saved with the workflow and never re-runs the node.
  - It is remembered in the browser and applies to all Grok Prompt Forge nodes.
  - Preset names, system prompts and the generated prompt stay English.
- All new fields sit at the end of the node, so saved workflows keep their values in place.
- README with screenshots of the nodes and dialogs.

## 3.1.0 — 2026-10-24

- **Optional word range:** new fields `min_words` / `max_words` (0 = off) on Grok Prompt Forge.
  - When set, a binding length rule is appended to every system prompt, including your own, and overrides the preset's length guidance.
  - Tag lists count each tag as one word. In MiniMax H3 formats the range applies to the main description.
  - The tooltip and the preset note show the length the target model's maker recommends for the selected preset.
  - The console logs the word count of each result.
- **The user's input is binding:** a rule appended to every system prompt makes every explicit wish in the input win over the preset's guidance. Only the output format and the English-output rule stay.
- The new fields sit at the end of the node, so workflows saved with 3.0.x load with their values in the right place.
- A lone full stop on the last line of a result (seen after tag lists) is removed.

## 3.0.1 — 2026-10-24

- Multi-agent models (e.g. `grok-4.20-multi-agent-0309`) are no longer listed in the model dropdown. The xAI API rejects them on chat completions, which these nodes use.

## 3.0.0 — 2026-10-24

- **New node: Grok Prompt Forge (xAI).** One node for prompt writing, caption rewriting and image captioning:
  - 29 built-in task presets: "Idea ▸ …" and "Caption ▸ …" for each of Krea 2, Qwen-Image 2.1, Qwen-Image-Edit 2.1, Z-Image, FLUX, Illustrious, Pony, SDXL, Wan 2.2, Wan 2.7, Wan 3.0, MiniMax H3 FL2VA and MiniMax H3 REF2VA, plus "Caption ▸ LoRA training caption", "Caption ▸ Describe image" and "Custom system prompt".
  - Each preset sets the system prompt, the target model's standard negative prompt, temperature, top_p and max_tokens.
  - "Save preset as..." and "Delete preset" buttons. Your presets are stored in `ComfyUI/user/grok_prompt_forge/presets.json`.
  - Optional `custom_system_prompt` input that always replaces the preset's system prompt.
  - Three optional image inputs, numbered by slot, with usage notes in the tooltip.
  - Input in any language, output always in English.
  - Second output `negative_prompt`.
  - Model dropdown loaded from the xAI API, with a "Refresh model list" button.
- **Default model is now `grok-4.20-0309-reasoning`** on all API nodes. `max_tokens` defaults were raised to 8192 because the model's hidden reasoning counts against the limit. An answer that ran out of tokens is now reported clearly instead of coming back empty.
- Grok Text Refine and Grok Vision Caption are now **legacy**. They are hidden from the node search but still load and run existing workflows, and they share the new API client. Text Refine's `fallback_to_input` now also covers HTTP errors such as 401 and 403.
- The example system prompts are now neutral: `system_prompts/example_caption_refine.txt` replaces the subject-specific prompts.
- Offline unit tests in `tests/`.

## 2.0.1

- If a model rejects a sampling parameter (e.g. `presencePenalty` on reasoning models), the parameter is stripped and the request is resent automatically.

## 2.0.0

- `top_p`, `presence_penalty` and `frequency_penalty` on both API nodes. Neutral values are not sent.
- Tooltips on every widget.
