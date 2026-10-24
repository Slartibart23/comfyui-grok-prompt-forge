// Texts of the Grok Prompt Forge node for its language switch (English / Deutsch).
// English widget labels and tooltips come from the node definition (Python);
// this file holds the German ones plus every text of the buttons, dialogs and
// notifications in both languages. Display only: widget names, saved values,
// preset names and the prompts sent to Grok never change with the language.

export const LANGUAGES = { en: "English", de: "Deutsch" };

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

const IMAGE_DE = (n) =>
  `Optionales Referenzbild ${n} von 3. Grok sieht es als 'Image ${n}'. Ein einzelnes Bild ` +
  "anschließen, keinen Batch (von einem Batch wird nur das erste Bild genutzt).\n" +
  "So nutzen die Auswahlen die Bilder:\n" +
  "- Caption > Describe image: image_1 ist das zu beschreibende Bild.\n" +
  "- Qwen-Image-Edit: image_1..3 sind die Eingangsbilder des Edits, in derselben " +
  "Reihenfolge wie im Edit-Workflow.\n" +
  "- MiniMax H3 FL2VA: image_1 = Startbild, image_2 = Endbild.\n" +
  "- MiniMax H3 REF2VA: image_1..3 = Referenzbilder (Personen, Orte, Objekte, Stil).\n" +
  "- Wan Bild-zu-Video: image_1 = Startbild.\n" +
  "- Alle anderen Auswahlen: optionaler visueller Kontext, aus dem Grok Details übernimmt.\n" +
  `- Mit gesetzter person_${n} und 'Bild N = Person N' an: image_${n} ist ein Foto dieser Person.\n` +
  "Bilder kosten zusätzliche Tokens; max. Bildseite steuert die Upload-Größe.";

const PERSON_DE = (n) =>
  `Person ${n} aus deiner Bibliothek (Button '👤 Personen & Stile...'). Name, LoRA-Trigger, ` +
  "Beschreibung und Stimme kommen in den Prompt und sind verbindlich; der Name erscheint " +
  "immer, damit jede Pose und Handlung eindeutig dieser Person zugeordnet ist. Im Text " +
  `sprichst du die Person mit Namen oder als 'Person ${n}' an. (none) = keine Person.`;

const STYLE_DE = (n) =>
  `Stil-Baustein ${n} aus deiner Bibliothek (Button '👤 Personen & Stile...'): ein ` +
  "gespeicherter Text wie ein Kameralook, eine Lichtstimmung oder eine Verbotsliste. Er wird " +
  "auf jedes Ergebnis angewendet und ist verbindlich. (none) = aus.";

const WORDS_DE =
  "Optionale Länge des erzeugten Prompts in Wörtern: min. Wörter / max. Wörter. 0 = aus " +
  "(dann gilt die Längenvorgabe der Auswahl). Gesetzt ist die Spanne für jede Auswahl " +
  "verbindlich, auch für eigene Systemprompts. In Tag-Listen zählt jeder Tag als ein Wort; " +
  "mehrteilige Formate (MiniMax H3) wenden sie auf die Hauptbeschreibung an.";

// German label and tooltip per widget, input socket and output of the node.
export const NODE_TEXT_DE = {
  preset: { label: "Aufgabe", tooltip:
    "Die Aufgabe. Eine Auswahl füllt Systemprompt, Negativprompt, Temperatur, top_p und " +
    "max. Tokens mit passenden Werten. Ändere sie frei und speichere sie mit 'Auswahl " +
    "speichern als...' unter eigenem Namen.\n" +
    "Idea > ...: eine kurze Idee zu einem vollständigen Prompt für dieses Modell ausbauen.\n" +
    "Caption > ...: eine vorhandene Caption treu (ohne neue Inhalte) in den Prompt-Stil " +
    "dieses Modells umschreiben.\n" +
    "Die Eingabe darf in jeder Sprache sein; die Ausgabe ist immer Englisch." },
  text: { label: "Eingabe", tooltip:
    "Deine Eingabe, in jeder Sprache: eine kurze Idee, eine vorhandene Caption oder ein " +
    "Bearbeitungswunsch. Du kannst auch einen Text-Ausgang (z. B. JoyCaption oder den Text " +
    "File Loader) an dieses Feld anschließen." },
  system_prompt: { label: "Systemprompt", tooltip:
    "Anweisungen, die festlegen, was Grok tut. Wird von der Auswahl gefüllt; frei " +
    "bearbeitbar. Wird ignoriert, wenn custom_system_prompt angeschlossen ist." },
  negative_prompt: { label: "Negativprompt", tooltip:
    "Standard-Negativprompt des Zielmodells; geht direkt an den Ausgang negative_prompt " +
    "(wird nicht an Grok geschickt). Leer bei Modellen, die Negativprompts bei CFG 1 " +
    "ignorieren (FLUX, Krea 2, Z-Image Turbo, Qwen mit Lightning-LoRAs ...)." },
  model: { label: "Modell", tooltip:
    "xAI-Grok-Modell. Standard: grok-4.20-0309-reasoning - es akzeptiert Temperatur und " +
    "top_p. 'Modell-Liste aktualisieren' lädt die aktuelle Liste aus dem API." },
  temperature: { label: "Temperatur", tooltip:
    "Kreativitätsregler. Niedrig (0,2-0,4) = treu und wiederholbar - für Caption-" +
    "Umschreibungen und Edit-Anweisungen. Hoch (0,8-1,0) = abwechslungsreich - zum " +
    "Ausbauen von Ideen. Über ~1,3 zerfällt die Grammatik." },
  top_p: { label: "top_p", tooltip:
    "Abschneidefilter: verwirft vor der Wortwahl die unwahrscheinlichsten Wörter. 1,0 = aus " +
    "(wird nicht gesendet). Hoch lassen (0,9-1,0) und mit der Temperatur steuern." },
  max_tokens: { label: "max. Tokens", tooltip:
    "Obergrenze für die Antwort EINSCHLIESSLICH des versteckten Nachdenkens des Modells. " +
    "Reasoning-Modelle verbrauchen zuerst einige hundert bis einige tausend Tokens zum " +
    "Nachdenken - zu niedrig ergibt leere oder abgeschnittene Antworten." },
  seed: { label: "Seed", tooltip:
    "Cache-Brecher, wird NICHT an das API geschickt. 'randomize' = bei jedem Lauf ein " +
    "frischer Prompt. 'fixed' = gleiche Eingabe nutzt das zwischengespeicherte Ergebnis " +
    "(spart Geld beim Umschreiben von Captions)." },
  control_after_generate: { label: "Seed nach dem Lauf", tooltip:
    "Was nach jedem Lauf mit dem Seed passiert: fixed = bleibt gleich, increment = +1, " +
    "decrement = -1, randomize = zufällig (für jeden Lauf ein frischer Prompt)." },
  custom_system_prompt: { label: "eigener Systemprompt", tooltip:
    "Einen Text hier anschließen, um ihn STATT des Feldes Systemprompt zu verwenden - er " +
    "hat immer Vorrang vor der Auswahl. Nicht angeschlossen (oder leer) = Auswahl gilt." },
  image_1: { label: "Bild 1", tooltip: IMAGE_DE(1) },
  image_2: { label: "Bild 2", tooltip: IMAGE_DE(2) },
  image_3: { label: "Bild 3", tooltip: IMAGE_DE(3) },
  trigger_word: { label: "Trigger-Wort", tooltip:
    "Nur für 'Caption > LoRA training caption': der Trigger des LoRAs für das Hauptmotiv " +
    "(ersetzt {trigger} im Systemprompt). Leer lassen für Captions ohne Trigger." },
  max_side: { label: "max. Bildseite", tooltip:
    "Verkleinert die längste Bildseite vor dem Upload (spart Tokens; Prompts und Captions " +
    "brauchen keine volle Auflösung)." },
  api_key: { label: "API-Key", tooltip:
    "Dein xAI-API-Key. Möglichst LEER lassen - hier eingetragene Keys landen in " +
    "exportierten Workflows! Besser die Umgebungsvariable XAI_API_KEY oder die Key-Datei " +
    "unten verwenden." },
  api_key_file: { label: "API-Key-Datei", tooltip:
    "Pfad zu einer Textdatei, die nur deinen xAI-API-Key enthält. Relative Pfade werden im " +
    "ComfyUI-Hauptordner, im Portable-Hauptordner und im Ordner dieses Node-Pakets gesucht." },
  base_url: { label: "API-Adresse", tooltip:
    "API-Endpunkt. Nur ändern, wenn Anfragen über einen Proxy oder einen anderen " +
    "OpenAI-kompatiblen Server laufen sollen." },
  fallback_to_input: { label: "bei Fehler Eingabe durchreichen", tooltip:
    "Schlägt der API-Aufruf fehl (kein Key, Netzwerkfehler, Ablehnung ...), wird die " +
    "Eingabe unverändert durchgereicht, statt die Warteschlange anzuhalten. Hält lange " +
    "Batch-Läufe am Laufen." },
  timeout_seconds: { label: "Timeout (Sek.)", tooltip:
    "Wie lange auf das API gewartet wird, bevor neu versucht wird (insgesamt 3 Versuche). " +
    "Reasoning-Modelle denken vor der Antwort nach - großzügig einstellen." },
  min_words: { label: "min. Wörter", tooltip: WORDS_DE },
  max_words: { label: "max. Wörter", tooltip: WORDS_DE },
  person_1: { label: "Person 1", tooltip: PERSON_DE(1) },
  person_2: { label: "Person 2", tooltip: PERSON_DE(2) },
  person_3: { label: "Person 3", tooltip: PERSON_DE(3) },
  person_4: { label: "Person 4", tooltip: PERSON_DE(4) },
  image_n_is_person_n: { label: "Bild N = Person N", tooltip:
    "Koppelt jede Person mit dem Bild-Eingang derselben Nummer: person_1 = image_1, " +
    "person_2 = image_2, person_3 = image_3 (person_4 hat keinen Bild-Eingang).\n" +
    "An: Lädst du ein Foto der Person in den passenden Bild-Eingang, erfährt Grok 'dieses " +
    "Bild zeigt diese Person' und übernimmt das Aussehen aus dem Foto. Bei Qwen-Image-Edit, " +
    "MiniMax H3 REF2VA, Wan 2.7/3.0 und FLUX.2 verweist der Prompt auf das Bild (z. B. " +
    "<image1>), statt das Gesicht zu beschreiben.\n" +
    "Aus: Bilder und Personen haben nichts miteinander zu tun - z. B. wenn die Bilder " +
    "Start- und Endbild für MiniMax H3 FL2VA sind." },
  style_1: { label: "Stil 1", tooltip: STYLE_DE(1) },
  style_2: { label: "Stil 2", tooltip: STYLE_DE(2) },
  archive: { label: "archivieren", tooltip:
    "An: jedes Ergebnis wird mit Eingabe, Auswahl, Personen und Einstellungen an " +
    "ComfyUI/user/grok_prompt_forge/archive.jsonl angehängt. '📜 Aus Archiv laden...' holt " +
    "einen archivierten Prompt zurück ins Eingabefeld, z. B. um ihn mit einer anderen " +
    "Person neu zu besetzen ('Recast ▸ Swap persons')." },
  // outputs
  "output:prompt": { label: "Prompt" },
  "output:negative_prompt": { label: "Negativprompt" },
};

// German texts of the Grok Show Prompt node (separate: "text" means something else there).
export const SHOW_TEXT_DE = {
  text: { label: "Text", tooltip:
    "Beliebiger Text, z. B. der Prompt-Ausgang von Grok Prompt Forge. Er wird am Node " +
    "angezeigt und unverändert weitergegeben - das Zählen ändert ihn nie und startet nie " +
    "einen neuen Lauf." },
  "output:text": { label: "Text" },
};

export const STRINGS = {
  en: {
    language: "🌐 Language / Sprache",
    btnSavePreset: "💾 Save preset as...",
    btnDeletePreset: "🗑 Delete preset",
    btnRefreshModels: "🔄 Refresh model list",
    btnLibrary: "👤 Persons & styles...",
    btnArchive: "📜 Load from archive...",
    recommended: (name, words) => `Recommended for "${name}": ${words}.`,
    noLength: "This preset has no recommended length.",
    length: "Length",
    savePresetTitle: "Save preset as...",
    presetName: "Name of the preset:",
    overwriteBuiltin: (n) => `"${n}" is a built-in preset. Save your values in its place? (Delete brings the built-in values back.)`,
    overwriteOwn: (n) => `Overwrite your preset "${n}"?`,
    presetNotSaved: "Preset not saved",
    presetSaved: "Preset saved",
    builtinPreset: "Built-in preset",
    builtinCannotDelete: (n) => `"${n}" ships with the node pack and cannot be deleted.`,
    discardOverride: (n) => `Discard your saved values for "${n}" and go back to the built-in values?`,
    deleteOwnPreset: (n) => `Delete your preset "${n}"?`,
    presetNotDeleted: "Preset not deleted",
    builtinRestored: "Built-in values restored",
    presetDeleted: "Preset deleted",
    modelsNotRefreshed: "Model list not refreshed",
    modelsRefreshed: "Model list refreshed",
    nModels: (n) => `${n} models`,
    libTitle: "Grok Prompt Forge · persons & style blocks",
    tabPersons: "👤 Persons",
    tabStyles: "🎨 Style blocks",
    newEntry: "＋ New",
    nothingSaved: "Nothing saved yet.",
    name: "Name",
    namePlaceholderPerson: "Name of the person (appears in every prompt)",
    namePlaceholderStyle: "Name shown in the selection box",
    nameHintPerson: "Shown in the selection box AND written into every prompt exactly like this, so poses and actions are clearly assigned. It can also act as the trigger.",
    nameHintStyle: "Only a label for the selection box - it is never written into the prompt.",
    triggerLabel: "Trigger",
    triggerHint: "The LoRA's trigger token, written into the prompt exactly like this right after the name. Leave empty if the name itself is the trigger or there is no LoRA.",
    descriptionLabel: "Description",
    descriptionHint: "Appearance and fixed traits (face, hair, body, age, typical look). Binding in every prompt; tag models get it as tags.",
    voiceLabel: "Voice",
    voiceHint: "Timbre, pitch, pace, accent, e.g. 'deep raspy male voice, slow, northern German accent'. Used only by models with audio: MiniMax H3 FL2VA / REF2VA, Wan 2.7, Wan 3.0. Ignored by Wan 2.2 and all image models.",
    textLabel: "Text",
    textHint: "Applied to every result while selected, e.g. a camera look ('shot on 35mm film, grain, muted colours'), a lighting mood or a ban list ('never: golden hour, neon lights').",
    save: "💾 Save",
    delete: "🗑 Delete",
    saved: "Saved",
    notSaved: "Not saved",
    confirmDeleteEntry: (n) => `Delete "${n}" from your library?`,
    deleted: "Deleted",
    notDeleted: "Not deleted",
    importClash: (count, names) => `${count} name(s) already exist in your library (${names}). Replace them with the imported ones? Cancel keeps yours and imports only the new names.`,
    imported: "Imported",
    importResult: (a, r, s) => `${a} added, ${r} replaced, ${s} skipped`,
    importFailed: "Import failed",
    exportLibrary: "⬇ Export library",
    exportTitle: "Download all persons and style blocks as one JSON file, e.g. to move them to another ComfyUI install.",
    importLibrary: "⬆ Import...",
    importTitle: "Add persons and style blocks from an exported JSON file.",
    storedIn: "Stored in ComfyUI/user/grok_prompt_forge/library.json",
    archiveTitle: "Grok Prompt Forge · load from archive",
    archiveSearch: "Search prompts, inputs, presets, persons...",
    archiveHint: "'Use as text' puts the prompt into the text field. 'Recast' also selects the preset 'Recast ▸ Swap persons' and the archived negative prompt - then choose person_1..4 and add an instruction such as 'replace the man with Person 1'.",
    persons: "persons",
    useAsText: "Use as text",
    recast: "Recast",
    readyToRecast: "Ready to recast",
    recastHint: "Choose person_1..4 and say whom to replace in the text.",
    loadedIntoText: "Loaded into text",
    nothingFound: "Nothing found.",
    archiveEmpty: "The archive is empty. Results are archived while 'archive' is on.",
    showCounts: "show counts",
    showCountsTip: "Shows the number of words, tags (comma-separated parts), sentences and characters below the text. Display only: switching it never starts a new run.",
    shownText: "Shown text",
    notRunYet: "Not run yet - the text appears here after the next run.",
    stats: (w, tg, s, c) => [plural(w, "word", "words"), plural(tg, "tag", "tags"),
      plural(s, "sentence", "sentences"), plural(c, "character", "characters")].join(" · "),
  },
  de: {
    language: "🌐 Language / Sprache",
    btnSavePreset: "💾 Auswahl speichern als...",
    btnDeletePreset: "🗑 Auswahl löschen",
    btnRefreshModels: "🔄 Modell-Liste aktualisieren",
    btnLibrary: "👤 Personen & Stile...",
    btnArchive: "📜 Aus Archiv laden...",
    recommended: (name, words) => `Empfohlen für "${name}": ${words}.`,
    noLength: "Für diese Auswahl gibt es keine Längenempfehlung.",
    length: "Länge",
    savePresetTitle: "Auswahl speichern als...",
    presetName: "Name der Auswahl:",
    overwriteBuiltin: (n) => `"${n}" ist eine mitgelieferte Auswahl. Deine Werte an ihrer Stelle speichern? (Löschen holt die mitgelieferten Werte zurück.)`,
    overwriteOwn: (n) => `Deine Auswahl "${n}" überschreiben?`,
    presetNotSaved: "Auswahl nicht gespeichert",
    presetSaved: "Auswahl gespeichert",
    builtinPreset: "Mitgelieferte Auswahl",
    builtinCannotDelete: (n) => `"${n}" gehört zum Node-Paket und kann nicht gelöscht werden.`,
    discardOverride: (n) => `Deine gespeicherten Werte für "${n}" verwerfen und zu den mitgelieferten Werten zurückkehren?`,
    deleteOwnPreset: (n) => `Deine Auswahl "${n}" löschen?`,
    presetNotDeleted: "Auswahl nicht gelöscht",
    builtinRestored: "Mitgelieferte Werte wiederhergestellt",
    presetDeleted: "Auswahl gelöscht",
    modelsNotRefreshed: "Modell-Liste nicht aktualisiert",
    modelsRefreshed: "Modell-Liste aktualisiert",
    nModels: (n) => `${n} Modelle`,
    libTitle: "Grok Prompt Forge · Personen & Stil-Bausteine",
    tabPersons: "👤 Personen",
    tabStyles: "🎨 Stil-Bausteine",
    newEntry: "＋ Neu",
    nothingSaved: "Noch nichts gespeichert.",
    name: "Name",
    namePlaceholderPerson: "Name der Person (erscheint in jedem Prompt)",
    namePlaceholderStyle: "Name in der Auswahlbox",
    nameHintPerson: "Erscheint in der Auswahlbox UND genau so in jedem Prompt, damit Posen und Handlungen eindeutig zugeordnet sind. Kann auch als Trigger dienen.",
    nameHintStyle: "Nur eine Beschriftung für die Auswahlbox - wird nie in den Prompt geschrieben.",
    triggerLabel: "Trigger",
    triggerHint: "Der Trigger des LoRAs, genau so direkt nach dem Namen in den Prompt geschrieben. Leer lassen, wenn der Name selbst der Trigger ist oder es kein LoRA gibt.",
    descriptionLabel: "Beschreibung",
    descriptionHint: "Aussehen und feste Merkmale (Gesicht, Haare, Körper, Alter, typischer Look). In jedem Prompt verbindlich; Tag-Modelle bekommen sie als Tags.",
    voiceLabel: "Stimme",
    voiceHint: "Klangfarbe, Tonhöhe, Tempo, Akzent, z. B. 'tiefe, raue Männerstimme, langsam, norddeutscher Akzent'. Nur für Modelle mit Ton: MiniMax H3 FL2VA / REF2VA, Wan 2.7, Wan 3.0. Wan 2.2 und alle Bildmodelle ignorieren sie.",
    textLabel: "Text",
    textHint: "Wird auf jedes Ergebnis angewendet, solange gewählt, z. B. ein Kameralook ('shot on 35mm film, grain, muted colours'), eine Lichtstimmung oder eine Verbotsliste ('never: golden hour, neon lights').",
    save: "💾 Speichern",
    delete: "🗑 Löschen",
    saved: "Gespeichert",
    notSaved: "Nicht gespeichert",
    confirmDeleteEntry: (n) => `"${n}" aus deiner Bibliothek löschen?`,
    deleted: "Gelöscht",
    notDeleted: "Nicht gelöscht",
    importClash: (count, names) => `${count} Name(n) gibt es schon in deiner Bibliothek (${names}). Durch die importierten ersetzen? Abbrechen behält deine und importiert nur die neuen Namen.`,
    imported: "Importiert",
    importResult: (a, r, s) => `${a} hinzugefügt, ${r} ersetzt, ${s} übersprungen`,
    importFailed: "Import fehlgeschlagen",
    exportLibrary: "⬇ Bibliothek exportieren",
    exportTitle: "Alle Personen und Stil-Bausteine als eine JSON-Datei herunterladen, z. B. für eine andere ComfyUI-Installation.",
    importLibrary: "⬆ Importieren...",
    importTitle: "Personen und Stil-Bausteine aus einer exportierten JSON-Datei hinzufügen.",
    storedIn: "Gespeichert in ComfyUI/user/grok_prompt_forge/library.json",
    archiveTitle: "Grok Prompt Forge · aus Archiv laden",
    archiveSearch: "Prompts, Eingaben, Auswahlen, Personen durchsuchen...",
    archiveHint: "'Als Eingabe' setzt den Prompt ins Eingabefeld. 'Recast' wählt zusätzlich die Auswahl 'Recast ▸ Swap persons' und den archivierten Negativprompt - dann person_1..4 wählen und eine Anweisung ergänzen wie 'ersetze den Mann durch Person 1'.",
    persons: "Personen",
    useAsText: "Als Eingabe",
    recast: "Recast",
    readyToRecast: "Bereit zum Neubesetzen",
    recastHint: "person_1..4 wählen und im Text sagen, wer ersetzt wird.",
    loadedIntoText: "In die Eingabe geladen",
    nothingFound: "Nichts gefunden.",
    archiveEmpty: "Das Archiv ist leer. Ergebnisse werden archiviert, solange 'archivieren' an ist.",
    showCounts: "Zählung anzeigen",
    showCountsTip: "Zeigt unter dem Text die Anzahl der Wörter, Tags (durch Kommas getrennte Teile), Sätze und Zeichen. Nur Anzeige: das Umschalten startet nie einen neuen Lauf.",
    shownText: "Angezeigter Text",
    notRunYet: "Noch nicht gelaufen - der Text erscheint hier nach dem nächsten Lauf.",
    stats: (w, tg, s, c) => [plural(w, "Wort", "Wörter"), plural(tg, "Tag", "Tags"),
      plural(s, "Satz", "Sätze"), plural(c, "Zeichen", "Zeichen")].join(" · "),
  },
};
