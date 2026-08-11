# comfyui-grok-prompt-forge

ComfyUI custom node pack for the **official xAI Grok API** (OpenAI-compatible endpoint `https://api.x.ai/v1`): prompt generation, text refinement, vision captioning and batch text loading — with full sampling control and beginner-friendly tooltips on every widget (hover over any option in ComfyUI to see what it does).

Successor to `comfyui-grok-text-refine`. **Node class IDs are unchanged**, so existing workflows keep working — only the pack name, metadata and feature set are new.

Two typical pipelines:

```
Caption refinement (deterministic):
[Load Image] → [JoyCaption] → [Grok Text Refine (xAI)] → [Save Text File]

Prompt generation (maximum variety):
[Text File Loader / CONTENT line] → [Grok Text Refine (xAI)] → [CLIP Text Encode] → [KSampler]
```

## Nodes

| Node | Purpose |
|---|---|
| **Grok Text Refine (xAI)** | Sends input text + a system prompt to the Grok chat-completions API, returns the result. What it *does* is defined entirely by the system prompt: caption refiner, prompt generator, translator... Retries on transient errors; optional fallback to the unmodified input so batch runs never break. |
| **Grok System Prompt Loader** | Loads a system prompt from a `.txt` file (from `system_prompts/` in this pack, the ComfyUI root, or an absolute path). Watches the file's modification time — edit and save the file, and the next run automatically uses the new content. |
| **Grok Text File Loader (Batch)** | Sequentially loads `.txt` files from any folder on any drive (natural sort order). Outputs the text, the filename without extension (for matching save-node names), the full path, and the total file count. Set the control under `index` to "increment" and queue as many runs as there are files. `loop_at_end` wraps around instead of stopping. |
| **Grok Vision Caption (xAI)** | Sends an IMAGE plus an instruction prompt to the Grok vision API and returns a caption. Downscales the image before upload (`max_side`) to save tokens. Requires a vision-capable model. |

## New in 2.0.0

- **`top_p`, `presence_penalty`, `frequency_penalty`** on both API nodes (Text Refine and Vision Caption) — see the sampling guide below.
- **Tooltips on every widget**, written for non-experts. Hover over any option in ComfyUI.
- Neutral values (`top_p` = 1.0, penalties = 0.0) are **not sent to the API at all**. Default behavior is therefore byte-identical to older versions, and xAI reasoning models that reject these parameters keep working.

## The sampling guide: temperature, top_p and the penalties

Every time the model writes a word, it internally ranks *all* candidate words by probability and then draws one. The four sampling options control that draw — each in a different way. Understanding the difference is the key to getting *varied* output without getting *broken* output.

### temperature — reshapes the dice

Temperature stretches or squashes the whole probability distribution. Low values make the model nearly always pick its top-ranked word: output becomes predictable, repetitive, safe. High values give unusual words a real chance: output becomes varied and surprising — and eventually incoherent.

| Value | Behavior | Use for |
|---|---|---|
| 0.0 – 0.3 | Near-deterministic | Caption refinement, translation, anything repeatable |
| 0.7 – 0.9 | Balanced variety | General text tasks |
| 1.0 – 1.15 | High variety | **Prompt generation** |
| > 1.3 | Word salad risk | (don't) |

### top_p — removes dice faces entirely

Top_p ("nucleus sampling") is a *cutoff*, not a reshaping. Before drawing, the model sorts all candidates and keeps only the smallest set whose probabilities sum to `p` — the unlikely tail is **thrown away completely**. At `top_p = 0.9`, a rare-but-interesting word ("laundromat") may simply be unreachable, no matter how high the temperature is.

Crucially, the size of that kept set is *dynamic*: where the model is certain (after "golden" comes "hour"), the set is one or two words and top_p changes nothing. Where the model is uncertain — which location, which pose, which light source — the set is huge, and that's exactly where a low top_p cuts hardest. A low top_p therefore trims *precisely the choices that make your images different from each other*.

**Rule of thumb: temperature shapes the dice, top_p removes dice faces.** For variety, keep top_p high (0.98–1.0) and steer with temperature. Lower top_p only when high temperature produces visible nonsense and you want to trim just the garbage tail (0.95–0.98).

Moving both dials at once multiplies their effects unpredictably — pick one to lead (usually temperature) and leave the other near neutral.

### presence_penalty — "you already said that word"

Applies a fixed penalty to every word that has appeared *at least once* in the output so far, pushing the model toward fresh vocabulary. This attacks the model's stock phrases more directly than either dial above: once "golden" has appeared, it becomes less likely to appear again. `0.3–0.6` is a sensible range for prompt generation; above ~1.0 the model starts avoiding words it legitimately needs, and coherence suffers.

### frequency_penalty — "you keep saying that word"

Same idea, but the penalty *grows with each repetition*. It targets literal loops ("she... she... she...") rather than general vocabulary reuse. `0.2–0.5` if your outputs repeat words; otherwise leave at 0.

### Recommended presets

| | temperature | top_p | presence_p. | frequency_p. | seed control |
|---|---|---|---|---|---|
| **Prompt generation** | 1.0 – 1.1 | 0.98 | 0.4 | 0.2 | randomize |
| **Caption refinement** | 0.2 | 1.0 (off) | 0.0 (off) | 0.0 (off) | fixed |
| **Vision captioning** | 0.3 – 0.5 | 1.0 (off) | 0.0 (off) | 0.0 (off) | fixed |

### Reasoning models

Some xAI reasoning models partially ignore `temperature`/`top_p` and **reject** the penalty parameters (e.g. `grok-4.5` refuses `presencePenalty` with an HTTP 400). Two safeguards handle this: neutral values are never sent in the first place, and if the API rejects a parameter, the node **strips it and automatically resends the request** — the queue keeps running, and the console logs which parameter was dropped (e.g. `Model 'grok-4.5' rejected 'presence_penalty' — retrying without it.`). Practical consequence: on such models the penalty dials silently do nothing, so get your variety from temperature plus the ban-list/wildcard techniques below.

### What sampling can NOT fix

Sampling adds variety at the *word* level. It cannot stop the model from loving the same *motifs* — the same golden-hour backdrops, the same centered poses. If your generated images still look alike:

1. **Ban list in the system prompt.** Replace vague "be creative" instructions (which do almost nothing) with explicit bans: `Never use: golden hour, neon lights, rain-slicked streets, subject centered facing camera, ...` Extend the list whenever a cliché reappears.
2. **Inject external randomness.** Feed randomized scene ingredients (location, camera angle, pose, light source, weather) into the input text — e.g. via wildcard nodes or the Text File Loader cycling through a folder of scene fragments with `loop_at_end`. The sampling dials provide the noise; the wildcards provide the ideas.

### seed (cache-breaker)

The `seed` widget is **not sent to the API**. ComfyUI only re-executes a node when one of its inputs changed — with identical text and settings, the node would silently reuse its cached output and never call the API again. The seed exists purely to break that cache:

- **randomize** → fresh API call every queue run. *Required for prompt generation* — otherwise you generate every image from the literally identical prompt text.
- **fixed** → identical requests reuse the cached result. Ideal for caption refinement: repeated runs of the same workflow don't cost money twice.

## Installation (Windows, Portable ComfyUI)

1. Copy this folder into `ComfyUI\custom_nodes\` so you get:
   `ComfyUI\custom_nodes\comfyui-grok-prompt-forge\`
2. Install the single dependency (usually already present) — from the portable root:
   ```
   python_embeded\python.exe -m pip install requests
   ```
   *(Manual/venv installs: activate your environment and run `pip install requests`.)*
3. Restart ComfyUI. The nodes appear under **Grok → Text**.

**Upgrading from comfyui-grok-text-refine:** delete (or move away) the old `custom_nodes\comfyui-grok-text-refine` folder so the node class IDs aren't registered twice, then restart. Existing workflows load unchanged; re-add the Refine/Vision nodes once if you want the new widgets to appear on old node instances.

## API key setup

Get a key at **https://console.x.ai**. The nodes resolve the key in this order:

1. `api_key` widget — **not recommended** (the key would be saved inside exported workflows)
2. Environment variable `XAI_API_KEY`
3. **Key file (recommended):** create `grok_api_key.txt` containing only the key. The node searches, in order: the ComfyUI root (next to `main.py`), the portable root (next to `run_nvidia_gpu.bat`), and this node pack's own folder. Beware Windows hiding file extensions — make sure the file is not accidentally named `grok_api_key.txt.txt`.

Never share workflows or screenshots containing your key.

## Model name

The `model` field defaults to `grok-4`. Model names on the xAI API change over time — check the current list in the xAI console, or query it directly:

```
curl https://api.x.ai/v1/models -H "Authorization: Bearer YOUR_KEY"
```

Enter the exact model id you want into the `model` field.

## Notes

- The xAI API is a paid service billed per token; single-caption refinement costs are negligible (cents per hundreds of captions).
- `docs/NOTE_settings_guide.txt` contains a plain-text version of the sampling guide, sized to paste into a ComfyUI **Note** node next to your workflow.
- If individual responses come back refused or softened, check the console log, adjust the system prompt, or rely on `fallback_to_input`.

## License

MIT
