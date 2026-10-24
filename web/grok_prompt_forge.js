// Grok Prompt Forge (xAI):
// - selecting a preset fills system_prompt, negative_prompt, temperature, top_p
//   and max_tokens with the preset's values
// - "Save preset as..." stores the current values under a name of your own
//   (ComfyUI/user/grok_prompt_forge/presets.json), "Delete preset" removes it
// - "Refresh model list" loads the current model ids from the xAI API
// - "Persons & styles..." edits your library (ComfyUI/user/grok_prompt_forge/
//   library.json) with export / import; person_1..4 and style_1..2 follow it
// - "Load from archive..." puts an archived prompt into the text field

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

// ------------------------------------------------------------------ dialogs
// Plain DOM modal in ComfyUI's colours. It sits below ComfyUI's own dialogs
// (z-index 1000), so confirm boxes and toasts appear on top of it.
const NONE = "(none)";
const RECAST = "Recast ▸ Swap persons"; // built-in preset name, see builtin_presets.py

function el(tag, props = {}, ...children) {
  const e = document.createElement(tag);
  const { style, ...rest } = props;
  Object.assign(e, rest);
  if (style) Object.assign(e.style, style);
  for (const c of children) e.append(c);
  return e;
}

const INPUT_STYLE = {
  width: "100%", boxSizing: "border-box", padding: "6px 8px", borderRadius: "6px",
  border: "1px solid var(--border-color, #555)", background: "var(--comfy-input-bg, #222)",
  color: "var(--input-text, #ddd)", font: "inherit",
};
const BUTTON_STYLE = {
  padding: "6px 12px", borderRadius: "6px", border: "1px solid var(--border-color, #555)",
  background: "var(--comfy-input-bg, #333)", color: "var(--input-text, #ddd)", cursor: "pointer",
};
const HINT_STYLE = { fontSize: "12px", opacity: 0.7, margin: "2px 0 10px" };

function button(label, onclick, extra = {}) {
  return el("button", { textContent: label, onclick, style: { ...BUTTON_STYLE, ...extra } });
}

function modal(title, width = "820px") {
  const overlay = el("div", { style: {
    position: "fixed", inset: "0", background: "rgba(0,0,0,0.5)", zIndex: 1000,
    display: "flex", alignItems: "center", justifyContent: "center" } });
  const body = el("div", { style: { padding: "14px", overflow: "auto", flex: "1" } });
  const close = () => { overlay.remove(); document.removeEventListener("keydown", onKey); };
  const onKey = (e) => {
    // Escape closes unless one of ComfyUI's own dialogs is open on top
    if (e.key === "Escape" && !document.querySelector(".p-dialog")) close();
  };
  const panel = el("div", { style: {
    width, maxWidth: "95vw", maxHeight: "90vh", display: "flex", flexDirection: "column",
    background: "var(--comfy-menu-bg, #2a2a2a)", color: "var(--fg-color, #ddd)",
    border: "1px solid var(--border-color, #555)", borderRadius: "10px",
    boxShadow: "0 10px 40px rgba(0,0,0,0.5)", fontSize: "14px" } },
    el("div", { style: { display: "flex", alignItems: "center", padding: "10px 14px",
      borderBottom: "1px solid var(--border-color, #555)" } },
      el("b", { textContent: title, style: { flex: "1" } }),
      button("✕", close, { padding: "2px 8px" })),
    body);
  overlay.append(panel);
  overlay.addEventListener("mousedown", (e) => { if (e.target === overlay) close(); });
  document.addEventListener("keydown", onKey);
  document.body.append(overlay);
  return { body, close };
}

// -------------------------------------------------- persons & style blocks
const LIBRARY = {
  person: {
    tab: "👤 Persons", slots: ["person_1", "person_2", "person_3", "person_4"],
    fields: [
      { key: "trigger", label: "Trigger", rows: 1,
        hint: "The LoRA's trigger token, written into the prompt exactly like this right after the name. Leave empty if the name itself is the trigger or there is no LoRA." },
      { key: "description", label: "Description", rows: 5,
        hint: "Appearance and fixed traits (face, hair, body, age, typical look). Binding in every prompt; tag models get it as tags." },
      { key: "voice", label: "Voice", rows: 2,
        hint: "Timbre, pitch, pace, accent, e.g. 'deep raspy male voice, slow, northern German accent'. Used only by models with audio: MiniMax H3 FL2VA / REF2VA, Wan 2.7, Wan 3.0. Ignored by Wan 2.2 and all image models." },
    ],
  },
  style: {
    tab: "🎨 Style blocks", slots: ["style_1", "style_2"],
    fields: [
      { key: "text", label: "Text", rows: 6,
        hint: "Applied to every result while selected, e.g. a camera look ('shot on 35mm film, grain, muted colours'), a lighting mood or a ban list ('never: golden hour, neon lights')." },
    ],
  },
};

async function fetchLibrary() {
  return (await api.fetchApi("/grok_prompt_forge/library")).json();
}

// Show the new name lists on every node; renamed / deleted entries are followed.
function updateLibraryLists(data, kind, renamed = null) {
  const lists = { person: data.persons, style: data.styles };
  for (const node of forgeNodes()) {
    for (const k of Object.keys(LIBRARY)) {
      for (const slot of LIBRARY[k].slots) {
        const w = widget(node, slot);
        if (!w) continue;
        if (k === kind && renamed && w.value === renamed.from) w.value = renamed.to ?? NONE;
        w.options.values = lists[k].includes(w.value) ? lists[k] : [w.value, ...lists[k]];
      }
    }
    node.setDirtyCanvas?.(true, true);
  }
}

async function postJson(url, body) {
  const resp = await api.fetchApi(url, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.error || `HTTP ${resp.status}`);
  return data;
}

async function openLibrary(node, startKind = "person") {
  let data = await fetchLibrary();
  let kind = startKind;
  let selected = null; // name being edited, null = new entry
  const { body } = modal("Grok Prompt Forge · persons & style blocks");

  const tabs = el("div", { style: { display: "flex", gap: "6px", marginBottom: "12px" } });
  const main = el("div", { style: { display: "flex", gap: "14px", minHeight: "360px" } });
  const list = el("div", { style: { width: "220px", flexShrink: 0, display: "flex",
    flexDirection: "column", gap: "4px", overflow: "auto", maxHeight: "60vh" } });
  const form = el("div", { style: { flex: "1" } });
  const footer = el("div", { style: { display: "flex", gap: "8px", marginTop: "12px",
    borderTop: "1px solid var(--border-color, #555)", paddingTop: "10px", alignItems: "center" } });
  main.append(list, form);
  body.append(tabs, main, footer);

  const entries = () => data.library[kind === "person" ? "persons" : "styles"];

  function renderTabs() {
    tabs.replaceChildren(...Object.entries(LIBRARY).map(([k, spec]) =>
      button(spec.tab, () => { kind = k; selected = null; render(); },
        k === kind ? { borderColor: "var(--p-primary-color, #4a90e2)", fontWeight: "bold" } : {})));
  }

  function renderList() {
    const names = Object.keys(entries()).sort((a, b) => a.localeCompare(b));
    list.replaceChildren(
      button("＋ New", () => { selected = null; renderForm(); }, { textAlign: "left" }),
      ...names.map((n) => button(n, () => { selected = n; renderForm(); }, {
        textAlign: "left", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        ...(n === selected ? { borderColor: "var(--p-primary-color, #4a90e2)" } : {}) })),
      names.length ? "" : el("div", { textContent: "Nothing saved yet.", style: HINT_STYLE }));
  }

  function renderForm() {
    renderList();
    const spec = LIBRARY[kind];
    const values = selected ? entries()[selected] : {};
    const nameInput = el("input", { value: selected ?? "", placeholder: kind === "person"
      ? "Name of the person (appears in every prompt)" : "Name shown in the selection box",
      style: INPUT_STYLE });
    const inputs = {};
    const rows = [el("label", { textContent: "Name" }), nameInput,
      el("div", { textContent: kind === "person"
        ? "Shown in the selection box AND written into every prompt exactly like this, so poses and actions are clearly assigned. It can also act as the trigger."
        : "Only a label for the selection box - it is never written into the prompt.", style: HINT_STYLE })];
    for (const f of spec.fields) {
      const input = f.rows > 1
        ? el("textarea", { value: values[f.key] ?? "", rows: f.rows, style: { ...INPUT_STYLE, resize: "vertical" } })
        : el("input", { value: values[f.key] ?? "", style: INPUT_STYLE });
      input.title = f.hint;
      inputs[f.key] = input;
      rows.push(el("label", { textContent: f.label }), input, el("div", { textContent: f.hint, style: HINT_STYLE }));
    }
    const save = button("💾 Save", async () => {
      try {
        const vals = Object.fromEntries(Object.entries(inputs).map(([k, i]) => [k, i.value]));
        const res = await postJson("/grok_prompt_forge/library",
          { kind, name: nameInput.value, values: vals, old_name: selected });
        const renamed = selected && selected !== res.name ? { from: selected, to: res.name } : null;
        data = res;
        selected = res.name;
        updateLibraryLists(data, kind, renamed);
        toast("success", "Saved", res.name);
        renderForm();
      } catch (e) { toast("error", "Not saved", String(e.message ?? e)); }
    }, { fontWeight: "bold" });
    const del = button("🗑 Delete", async () => {
      if (!selected || !(await confirmBox(`Delete "${selected}" from your library?`))) return;
      try {
        data = await postJson("/grok_prompt_forge/library/delete", { kind, name: selected });
        updateLibraryLists(data, kind, { from: selected, to: null });
        toast("success", "Deleted", selected);
        selected = null;
        renderForm();
      } catch (e) { toast("error", "Not deleted", String(e.message ?? e)); }
    });
    del.disabled = !selected;
    del.style.opacity = selected ? 1 : 0.4;
    form.replaceChildren(...rows, el("div", { style: { display: "flex", gap: "8px" } }, save, del));
  }

  function renderFooter() {
    const fileInput = el("input", { type: "file", accept: ".json,application/json", style: { display: "none" } });
    fileInput.onchange = async () => {
      const file = fileInput.files?.[0];
      fileInput.value = "";
      if (!file) return;
      try {
        const payload = JSON.parse(await file.text());
        const lib = data.library;
        const clashes = ["persons", "styles"].flatMap((k) =>
          Object.keys(payload[k] || {}).filter((n) => n in lib[k]));
        let overwrite = false;
        if (clashes.length) {
          overwrite = await confirmBox(
            `${clashes.length} name(s) already exist in your library (${clashes.slice(0, 5).join(", ")}${clashes.length > 5 ? ", ..." : ""}). Replace them with the imported ones? Cancel keeps yours and imports only the new names.`);
        }
        const res = await postJson("/grok_prompt_forge/library/import", { data: payload, overwrite });
        data = res;
        updateLibraryLists(data, null);
        toast("success", "Imported", `${res.added} added, ${res.replaced} replaced, ${res.skipped} skipped`);
        render();
      } catch (e) { toast("error", "Import failed", String(e.message ?? e)); }
    };
    const exportBtn = button("⬇ Export library", () => {
      const blob = new Blob([JSON.stringify(data.library, null, 2)], { type: "application/json" });
      const a = el("a", { href: URL.createObjectURL(blob), download: "grok_prompt_forge_library.json" });
      document.body.append(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    });
    exportBtn.title = "Download all persons and style blocks as one JSON file, e.g. to move them to another ComfyUI install.";
    const importBtn = button("⬆ Import...", () => fileInput.click());
    importBtn.title = "Add persons and style blocks from an exported JSON file.";
    footer.replaceChildren(exportBtn, importBtn, fileInput,
      el("div", { style: { ...HINT_STYLE, margin: "0 0 0 auto" },
        textContent: "Stored in ComfyUI/user/grok_prompt_forge/library.json" }));
  }

  function render() { renderTabs(); renderForm(); renderFooter(); }
  render();
}

// ------------------------------------------------------------------ archive
async function openArchive(node) {
  const { body, close } = modal("Grok Prompt Forge · load from archive", "900px");
  const search = el("input", { placeholder: "Search prompts, inputs, presets, persons...", style: INPUT_STYLE });
  const results = el("div", { style: { display: "flex", flexDirection: "column", gap: "8px", marginTop: "10px" } });
  body.append(search,
    el("div", { style: HINT_STYLE, textContent:
      "'Use as text' puts the prompt into the text field. 'Recast' also selects the preset 'Recast ▸ Swap persons' and the archived negative prompt - then choose person_1..4 and add an instruction such as 'replace the man with Person 1'." }),
    results);

  const use = async (entry, recast) => {
    if (recast) {
      widget(node, "preset").value = RECAST;
      await applyPreset(node, RECAST);
      if (entry.negative_prompt) setValue(node, "negative_prompt", entry.negative_prompt);
    }
    setValue(node, "text", entry.prompt);
    node.setDirtyCanvas?.(true, true);
    close();
    toast("success", recast ? "Ready to recast" : "Loaded into text",
      recast ? "Choose person_1..4 and say whom to replace in the text." : entry.preset);
  };

  let timer = null;
  const load = async () => {
    const q = encodeURIComponent(search.value.trim());
    const data = await (await api.fetchApi(`/grok_prompt_forge/archive?limit=200&q=${q}`)).json();
    const entries = data.entries || [];
    results.replaceChildren(...(entries.length ? entries.map((e) => {
      const meta = [e.time, e.preset, e.persons?.length ? `persons: ${e.persons.join(", ")}` : ""]
        .filter(Boolean).join(" · ");
      return el("div", { style: { border: "1px solid var(--border-color, #555)", borderRadius: "8px", padding: "8px" } },
        el("div", { textContent: meta, style: { fontSize: "12px", opacity: 0.7, marginBottom: "4px" } }),
        el("div", { textContent: e.prompt, title: e.prompt, style: { whiteSpace: "pre-wrap",
          display: "-webkit-box", WebkitLineClamp: "3", WebkitBoxOrient: "vertical", overflow: "hidden" } }),
        el("div", { style: { display: "flex", gap: "8px", marginTop: "6px" } },
          button("Use as text", () => use(e, false)), button("Recast", () => use(e, true))));
    }) : [el("div", { style: HINT_STYLE, textContent: search.value
      ? "Nothing found." : "The archive is empty. Results are archived while 'archive' is on." })]));
  };
  search.oninput = () => { clearTimeout(timer); timer = setTimeout(load, 250); };
  await load();
  search.focus();
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
      addButton(node, "👤 Persons & styles...", openLibrary);
      addButton(node, "📜 Load from archive...", openArchive);
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
