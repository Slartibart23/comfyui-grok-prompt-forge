// Grok Prompt Forge (xAI):
// - selecting a preset fills system_prompt, negative_prompt, temperature, top_p
//   and max_tokens with the preset's values
// - "Save preset as..." stores the current values under a name of your own
//   (ComfyUI/user/grok_prompt_forge/presets.json), "Delete preset" removes it
// - "Refresh model list" loads the current model ids from the xAI API

const { app } = window.comfyAPI.app;
const { api } = window.comfyAPI.api;

const NODE = "GrokPromptForge";
const FIELDS = ["system_prompt", "negative_prompt", "temperature", "top_p", "max_tokens"];
const WORD_FIELDS = ["min_words", "max_words"];
const TITLE = "Grok Prompt Forge";
const CUSTOM = "Custom system prompt"; // built-in preset name, see builtin_presets.py

let presetsPromise = null;
function loadPresets(force = false) {
  if (force || !presetsPromise) {
    presetsPromise = api
      .fetchApi("/grok_prompt_forge/presets")
      .then((r) => r.json())
      .then((d) => d.presets || [])
      .catch((e) => {
        console.warn(`[${TITLE}] presets not available:`, e);
        presetsPromise = null;
        return [];
      });
  }
  return presetsPromise;
}

function widget(node, name) {
  return node.widgets?.find((w) => w.name === name);
}

function forgeNodes() {
  const graph = app.graph;
  return (graph?._nodes ?? graph?.nodes ?? []).filter((n) => n.comfyClass === NODE || n.type === NODE);
}

function toast(severity, summary, detail) {
  const t = app.extensionManager?.toast;
  if (t?.add) t.add({ severity, summary, detail, life: 4000 });
  else console.log(`[${TITLE}] ${summary}: ${detail ?? ""}`);
}

async function askName(defaultValue) {
  const dialog = app.extensionManager?.dialog;
  if (dialog?.prompt) {
    return dialog.prompt({ title: "Save preset as...", message: "Name of the preset:", defaultValue });
  }
  return window.prompt("Name of the preset:", defaultValue);
}

async function confirmBox(message) {
  const dialog = app.extensionManager?.dialog;
  if (dialog?.confirm) return dialog.confirm({ title: TITLE, message });
  return window.confirm(message);
}

function setValue(node, name, value) {
  const w = widget(node, name);
  if (!w || value === undefined || value === null) return;
  w.value = value;
  w.callback?.(value);
}

// min_words / max_words: the tooltip names the length the selected preset's
// target model recommends.
async function showWordHint(node) {
  const name = widget(node, "preset")?.value;
  const preset = (await loadPresets()).find((p) => p.name === name);
  const hint = preset?.words
    ? `Recommended for "${name}": ${preset.words}.`
    : "This preset has no recommended length.";
  for (const f of WORD_FIELDS) {
    const w = widget(node, f);
    if (!w) continue;
    // the general explanation is in the node definition, not on the widget
    w._grokBaseTooltip ??= node.constructor.nodeData?.input?.optional?.[f]?.[1]?.tooltip ?? "";
    w.tooltip = `${hint}\n\n${w._grokBaseTooltip}`;
  }
}

async function applyPreset(node, name, announce = false) {
  const preset = (await loadPresets()).find((p) => p.name === name);
  if (!preset) return;
  for (const f of FIELDS) setValue(node, f, preset[f]);
  await showWordHint(node);
  node.setDirtyCanvas?.(true, true);
  if (announce && preset.description) {
    const words = preset.words ? `\nLength: ${preset.words}.` : "";
    toast("info", name, preset.description + words);
  }
}

// Show the new preset list on every Grok Prompt Forge node; each keeps its value.
function updatePresetLists(list) {
  const names = list.map((p) => p.name);
  for (const node of forgeNodes()) {
    const w = widget(node, "preset");
    if (!w) continue;
    w.options.values = names.includes(w.value) ? names : [w.value, ...names];
    node.setDirtyCanvas?.(true, true);
  }
}

async function savePreset(node) {
  const current = widget(node, "preset")?.value ?? "";
  const list = await loadPresets();
  const name = (await askName(current))?.trim();
  if (!name) return;
  const existing = list.find((p) => p.name === name);
  if (existing) {
    const what = existing.builtin
      ? `"${name}" is a built-in preset. Save your values in its place? (Delete brings the built-in values back.)`
      : `Overwrite your preset "${name}"?`;
    if (!(await confirmBox(what))) return;
  }
  const values = { description: existing?.description ?? "" };
  for (const f of FIELDS) values[f] = widget(node, f)?.value;
  const resp = await api.fetchApi("/grok_prompt_forge/presets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, values }),
  });
  const data = await resp.json();
  if (!resp.ok) return toast("error", "Preset not saved", data.error);
  presetsPromise = Promise.resolve(data.presets);
  updatePresetLists(data.presets);
  widget(node, "preset").value = name;
  node.setDirtyCanvas?.(true, true);
  toast("success", "Preset saved", name);
}

async function deletePreset(node) {
  const name = widget(node, "preset")?.value;
  const preset = (await loadPresets()).find((p) => p.name === name);
  if (!preset) return;
  if (preset.builtin && !preset.overridden) {
    return toast("info", "Built-in preset", `"${name}" ships with the node pack and cannot be deleted.`);
  }
  const question = preset.builtin
    ? `Discard your saved values for "${name}" and go back to the built-in values?`
    : `Delete your preset "${name}"?`;
  if (!(await confirmBox(question))) return;
  const resp = await api.fetchApi("/grok_prompt_forge/presets/delete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  const data = await resp.json();
  if (!resp.ok) return toast("error", "Preset not deleted", data.error);
  presetsPromise = Promise.resolve(data.presets);
  if (preset.builtin) {
    await applyPreset(node, name);
  } else {
    // keep the values on the node; they are now simply custom values
    widget(node, "preset").value = CUSTOM;
  }
  updatePresetLists(data.presets);
  toast("success", preset.builtin ? "Built-in values restored" : "Preset deleted", name);
}

async function refreshModels(node) {
  const resp = await api.fetchApi("/grok_prompt_forge/models?refresh=1");
  const data = await resp.json();
  const models = data.models || [];
  for (const n of forgeNodes()) {
    const w = widget(n, "model");
    if (w && models.length) w.options.values = models.includes(w.value) ? models : [w.value, ...models];
  }
  node.setDirtyCanvas?.(true, true);
  if (!resp.ok) toast("warn", "Model list not refreshed", data.error);
  else toast("success", "Model list refreshed", `${models.length} models`);
}

function addButton(node, label, handler) {
  const w = node.addWidget("button", label, null, () => {
    handler(node).catch((e) => toast("error", label, String(e)));
  });
  w.serialize = false;
  w.options = { ...(w.options || {}), serialize: false };
  return w;
}

app.registerExtension({
  name: "GrokPromptForge.Presets",

  async beforeRegisterNodeDef(nodeType, nodeData) {
    if (nodeData?.name !== NODE) return;

    const onNodeCreated = nodeType.prototype.onNodeCreated;
    nodeType.prototype.onNodeCreated = function () {
      const r = onNodeCreated?.apply(this, arguments);
      const node = this;
      const w = widget(node, "preset");
      if (w) {
        const cb = w.callback;
        w.callback = function (value) {
          const res = cb?.apply(this, arguments);
          applyPreset(node, value, true);
          return res;
        };
      }
      addButton(node, "💾 Save preset as...", savePreset);
      addButton(node, "🗑 Delete preset", deletePreset);
      addButton(node, "🔄 Refresh model list", refreshModels);
      showWordHint(node);
      return r;
    };

    const onConfigure = nodeType.prototype.onConfigure;
    nodeType.prototype.onConfigure = function () {
      const r = onConfigure?.apply(this, arguments);
      showWordHint(this); // a loaded workflow may use another preset
      return r;
    };
  },
});
