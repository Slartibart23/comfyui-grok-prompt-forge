// Grok Prompt Forge (xAI):
// - selecting a preset fills system_prompt, negative_prompt, temperature, top_p
//   and max_tokens with the preset's values
// - "Save preset as..." stores the current values under a name of your own
//   (ComfyUI/user/grok_prompt_forge/presets.json), "Delete preset" removes it
// - "Refresh model list" loads the current model ids from the xAI API
// - "Persons & styles..." edits your library (ComfyUI/user/grok_prompt_forge/
//   library.json) with export / import; person_1..4 and style_1..2 follow it
// - "Load from archive..." puts an archived prompt into the text field
// - the language switch at the top shows the node in English or German
//   (display only, remembered in this browser; see grok_prompt_forge_i18n.js)

import { LANGUAGES, NODE_TEXT_DE, STRINGS } from "./grok_prompt_forge_i18n.js";

const { app } = window.comfyAPI.app;
const { api } = window.comfyAPI.api;

const NODE = "GrokPromptForge";
const FIELDS = ["system_prompt", "negative_prompt", "temperature", "top_p", "max_tokens"];
const WORD_FIELDS = ["min_words", "max_words"];
const TITLE = "Grok Prompt Forge";
const CUSTOM = "Custom system prompt"; // built-in preset name, see builtin_presets.py
const LANG_WIDGET = "grok_language";
const LANG_KEY = "grokPromptForge.language";

// ----------------------------------------------------------------- language
let lang = (() => {
  try {
    return localStorage.getItem(LANG_KEY) === "de" ? "de" : "en";
  } catch {
    return "en";
  }
})();

function t(key, ...args) {
  const value = STRINGS[lang][key] ?? STRINGS.en[key];
  return typeof value === "function" ? value(...args) : value;
}

function specTooltip(node, name) {
  const spec = node.constructor.nodeData?.input;
  return (spec?.required?.[name] ?? spec?.optional?.[name])?.[1]?.tooltip;
}

// Labels and tooltips of one node in the current language. Only what is shown
// changes: widget names, values and the saved workflow stay the same.
function applyLanguage(node) {
  const de = lang === "de";
  for (const w of node.widgets || []) {
    if (w._grokText) {
      w.label = t(w._grokText);
      continue;
    }
    const text = NODE_TEXT_DE[w.name];
    if (!text) continue;
    // remember the English texts once, to switch back to them
    w._grokEn ??= { label: w.label, tooltip: w.tooltip ?? specTooltip(node, w.name),
                    placeholder: w.inputEl?.placeholder };
    w.label = de ? text.label : w._grokEn.label;
    if (!WORD_FIELDS.includes(w.name)) w.tooltip = de ? text.tooltip : w._grokEn.tooltip;
    if (w.inputEl) w.inputEl.placeholder = de ? text.label : w._grokEn.placeholder;
  }
  const slots = [...(node.inputs || []).filter((i) => !i.widget).map((i) => [i, i.name]),
                 ...(node.outputs || []).map((o) => [o, `output:${o.name}`])];
  for (const [slot, key] of slots) { // widget inputs follow their widget
    const text = NODE_TEXT_DE[key];
    if (!text) continue;
    // slot labels are saved with the workflow: only undo our own German label
    if (de) slot.label = text.label;
    else if (slot.label === text.label) slot.label = undefined;
  }
  showWordHint(node);
  node.setDirtyCanvas?.(true, true);
}

function setLanguage(value) {
  lang = value === "de" ? "de" : "en";
  try {
    localStorage.setItem(LANG_KEY, lang);
  } catch {
    // private window or blocked storage: the switch still works for this page
  }
  for (const node of forgeNodes()) {
    const w = widget(node, LANG_WIDGET);
    if (w) w.value = LANGUAGES[lang];
    applyLanguage(node);
  }
}

// The switch sits at the very top and is never saved with the workflow, so the
// positions of the saved widget values do not change.
function addLanguageSwitch(node) {
  const w = node.addWidget("combo", LANG_WIDGET, LANGUAGES[lang], (value) => {
    setLanguage(Object.keys(LANGUAGES).find((k) => LANGUAGES[k] === value) ?? "en");
  }, { values: Object.values(LANGUAGES), serialize: false });
  w.serialize = false;
  w.label = STRINGS.en.language;
  node.widgets.splice(node.widgets.indexOf(w), 1);
  node.widgets.unshift(w);
}

// ------------------------------------------------------------------ presets
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
  const toaster = app.extensionManager?.toast;
  if (toaster?.add) toaster.add({ severity, summary, detail, life: 4000 });
  else console.log(`[${TITLE}] ${summary}: ${detail ?? ""}`);
}

async function askName(defaultValue) {
  const dialog = app.extensionManager?.dialog;
  if (dialog?.prompt) {
    return dialog.prompt({ title: t("savePresetTitle"), message: t("presetName"), defaultValue });
  }
  return window.prompt(t("presetName"), defaultValue);
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

const presetText = (preset, key) => (lang === "de" && preset?.[`${key}_de`]) || preset?.[key] || "";

// min_words / max_words: the tooltip names the length the selected preset's
// target model recommends.
async function showWordHint(node) {
  const name = widget(node, "preset")?.value;
  const preset = (await loadPresets()).find((p) => p.name === name);
  const words = presetText(preset, "words");
  const hint = words ? t("recommended", name, words) : t("noLength");
  for (const f of WORD_FIELDS) {
    const w = widget(node, f);
    if (!w) continue;
    // the general explanation is in the node definition, not on the widget
    const base = lang === "de" ? NODE_TEXT_DE[f].tooltip : specTooltip(node, f) ?? "";
    w.tooltip = `${hint}\n\n${base}`;
  }
}

async function applyPreset(node, name, announce = false) {
  const preset = (await loadPresets()).find((p) => p.name === name);
  if (!preset) return;
  for (const f of FIELDS) setValue(node, f, preset[f]);
  await showWordHint(node);
  node.setDirtyCanvas?.(true, true);
  const description = presetText(preset, "description");
  if (announce && description) {
    const words = presetText(preset, "words");
    toast("info", name, description + (words ? `\n${t("length")}: ${words}.` : ""));
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
    const what = existing.builtin ? t("overwriteBuiltin", name) : t("overwriteOwn", name);
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
  if (!resp.ok) return toast("error", t("presetNotSaved"), data.error);
  presetsPromise = Promise.resolve(data.presets);
  updatePresetLists(data.presets);
  widget(node, "preset").value = name;
  node.setDirtyCanvas?.(true, true);
  toast("success", t("presetSaved"), name);
}

async function deletePreset(node) {
  const name = widget(node, "preset")?.value;
  const preset = (await loadPresets()).find((p) => p.name === name);
  if (!preset) return;
  if (preset.builtin && !preset.overridden) {
    return toast("info", t("builtinPreset"), t("builtinCannotDelete", name));
  }
  const question = preset.builtin ? t("discardOverride", name) : t("deleteOwnPreset", name);
  if (!(await confirmBox(question))) return;
  const resp = await api.fetchApi("/grok_prompt_forge/presets/delete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  const data = await resp.json();
  if (!resp.ok) return toast("error", t("presetNotDeleted"), data.error);
  presetsPromise = Promise.resolve(data.presets);
  if (preset.builtin) {
    await applyPreset(node, name);
  } else {
    // keep the values on the node; they are now simply custom values
    widget(node, "preset").value = CUSTOM;
  }
  updatePresetLists(data.presets);
  toast("success", preset.builtin ? t("builtinRestored") : t("presetDeleted"), name);
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
  if (!resp.ok) toast("warn", t("modelsNotRefreshed"), data.error);
  else toast("success", t("modelsRefreshed"), t("nModels", models.length));
}

// textKey: key in STRINGS for the button's label in the current language
function addButton(node, textKey, handler) {
  const w = node.addWidget("button", STRINGS.en[textKey], null, () => {
    handler(node).catch((e) => toast("error", t(textKey), String(e)));
  });
  w.serialize = false;
  w.options = { ...(w.options || {}), serialize: false };
  w._grokText = textKey;
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
    tab: "tabPersons", slots: ["person_1", "person_2", "person_3", "person_4"],
    fields: [
      { key: "trigger", label: "triggerLabel", hint: "triggerHint", rows: 1 },
      { key: "description", label: "descriptionLabel", hint: "descriptionHint", rows: 5 },
      { key: "voice", label: "voiceLabel", hint: "voiceHint", rows: 2 },
    ],
  },
  style: {
    tab: "tabStyles", slots: ["style_1", "style_2"],
    fields: [{ key: "text", label: "textLabel", hint: "textHint", rows: 6 }],
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
  const { body } = modal(t("libTitle"));

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
      button(t(spec.tab), () => { kind = k; selected = null; render(); },
        k === kind ? { borderColor: "var(--p-primary-color, #4a90e2)", fontWeight: "bold" } : {})));
  }

  function renderList() {
    const names = Object.keys(entries()).sort((a, b) => a.localeCompare(b));
    list.replaceChildren(
      button(t("newEntry"), () => { selected = null; renderForm(); }, { textAlign: "left" }),
      ...names.map((n) => button(n, () => { selected = n; renderForm(); }, {
        textAlign: "left", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        ...(n === selected ? { borderColor: "var(--p-primary-color, #4a90e2)" } : {}) })),
      names.length ? "" : el("div", { textContent: t("nothingSaved"), style: HINT_STYLE }));
  }

  function renderForm() {
    renderList();
    const spec = LIBRARY[kind];
    const values = selected ? entries()[selected] : {};
    const isPerson = kind === "person";
    const nameInput = el("input", { value: selected ?? "",
      placeholder: t(isPerson ? "namePlaceholderPerson" : "namePlaceholderStyle"), style: INPUT_STYLE });
    const inputs = {};
    const rows = [el("label", { textContent: t("name") }), nameInput,
      el("div", { textContent: t(isPerson ? "nameHintPerson" : "nameHintStyle"), style: HINT_STYLE })];
    for (const f of spec.fields) {
      const input = f.rows > 1
        ? el("textarea", { value: values[f.key] ?? "", rows: f.rows, style: { ...INPUT_STYLE, resize: "vertical" } })
        : el("input", { value: values[f.key] ?? "", style: INPUT_STYLE });
      input.title = t(f.hint);
      inputs[f.key] = input;
      rows.push(el("label", { textContent: t(f.label) }), input, el("div", { textContent: t(f.hint), style: HINT_STYLE }));
    }
    const save = button(t("save"), async () => {
      try {
        const vals = Object.fromEntries(Object.entries(inputs).map(([k, i]) => [k, i.value]));
        const res = await postJson("/grok_prompt_forge/library",
          { kind, name: nameInput.value, values: vals, old_name: selected });
        const renamed = selected && selected !== res.name ? { from: selected, to: res.name } : null;
        data = res;
        selected = res.name;
        updateLibraryLists(data, kind, renamed);
        toast("success", t("saved"), res.name);
        renderForm();
      } catch (e) { toast("error", t("notSaved"), String(e.message ?? e)); }
    }, { fontWeight: "bold" });
    const del = button(t("delete"), async () => {
      if (!selected || !(await confirmBox(t("confirmDeleteEntry", selected)))) return;
      try {
        data = await postJson("/grok_prompt_forge/library/delete", { kind, name: selected });
        updateLibraryLists(data, kind, { from: selected, to: null });
        toast("success", t("deleted"), selected);
        selected = null;
        renderForm();
      } catch (e) { toast("error", t("notDeleted"), String(e.message ?? e)); }
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
          const shown = clashes.slice(0, 5).join(", ") + (clashes.length > 5 ? ", ..." : "");
          overwrite = await confirmBox(t("importClash", clashes.length, shown));
        }
        const res = await postJson("/grok_prompt_forge/library/import", { data: payload, overwrite });
        data = res;
        updateLibraryLists(data, null);
        toast("success", t("imported"), t("importResult", res.added, res.replaced, res.skipped));
        render();
      } catch (e) { toast("error", t("importFailed"), String(e.message ?? e)); }
    };
    const exportBtn = button(t("exportLibrary"), () => {
      const blob = new Blob([JSON.stringify(data.library, null, 2)], { type: "application/json" });
      const a = el("a", { href: URL.createObjectURL(blob), download: "grok_prompt_forge_library.json" });
      document.body.append(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    });
    exportBtn.title = t("exportTitle");
    const importBtn = button(t("importLibrary"), () => fileInput.click());
    importBtn.title = t("importTitle");
    footer.replaceChildren(exportBtn, importBtn, fileInput,
      el("div", { style: { ...HINT_STYLE, margin: "0 0 0 auto" }, textContent: t("storedIn") }));
  }

  function render() { renderTabs(); renderForm(); renderFooter(); }
  render();
}

// ------------------------------------------------------------------ archive
async function openArchive(node) {
  const { body, close } = modal(t("archiveTitle"), "900px");
  const search = el("input", { placeholder: t("archiveSearch"), style: INPUT_STYLE });
  const results = el("div", { style: { display: "flex", flexDirection: "column", gap: "8px", marginTop: "10px" } });
  body.append(search, el("div", { style: HINT_STYLE, textContent: t("archiveHint") }), results);

  const use = async (entry, recast) => {
    if (recast) {
      widget(node, "preset").value = RECAST;
      await applyPreset(node, RECAST);
      if (entry.negative_prompt) setValue(node, "negative_prompt", entry.negative_prompt);
    }
    setValue(node, "text", entry.prompt);
    node.setDirtyCanvas?.(true, true);
    close();
    toast("success", recast ? t("readyToRecast") : t("loadedIntoText"),
      recast ? t("recastHint") : entry.preset);
  };

  let timer = null;
  const load = async () => {
    const q = encodeURIComponent(search.value.trim());
    const data = await (await api.fetchApi(`/grok_prompt_forge/archive?limit=200&q=${q}`)).json();
    const entries = data.entries || [];
    results.replaceChildren(...(entries.length ? entries.map((e) => {
      const meta = [e.time, e.preset, e.persons?.length ? `${t("persons")}: ${e.persons.join(", ")}` : ""]
        .filter(Boolean).join(" · ");
      return el("div", { style: { border: "1px solid var(--border-color, #555)", borderRadius: "8px", padding: "8px" } },
        el("div", { textContent: meta, style: { fontSize: "12px", opacity: 0.7, marginBottom: "4px" } }),
        el("div", { textContent: e.prompt, title: e.prompt, style: { whiteSpace: "pre-wrap",
          display: "-webkit-box", WebkitLineClamp: "3", WebkitBoxOrient: "vertical", overflow: "hidden" } }),
        el("div", { style: { display: "flex", gap: "8px", marginTop: "6px" } },
          button(t("useAsText"), () => use(e, false)), button(t("recast"), () => use(e, true))));
    }) : [el("div", { style: HINT_STYLE, textContent: search.value ? t("nothingFound") : t("archiveEmpty") })]));
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
      addLanguageSwitch(node);
      addButton(node, "btnSavePreset", savePreset);
      addButton(node, "btnDeletePreset", deletePreset);
      addButton(node, "btnRefreshModels", refreshModels);
      addButton(node, "btnLibrary", openLibrary);
      addButton(node, "btnArchive", openArchive);
      applyLanguage(node);
      return r;
    };

    const onConfigure = nodeType.prototype.onConfigure;
    nodeType.prototype.onConfigure = function () {
      const r = onConfigure?.apply(this, arguments);
      applyLanguage(this); // also refreshes the word hint: a loaded workflow may use another preset
      return r;
    };
  },
});
