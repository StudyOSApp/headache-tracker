import {
  STORAGE_KEY,
  emptyState,
  loadState,
  persistState,
  validateEntry,
  localDateTime,
  parseLocalDateTime,
} from "./storage.js";
import { DRAFT_KEY, captureDraft, isDraft } from "./draft.js";

const main = document.querySelector("main");
const nav = document.querySelector("nav");
let state = emptyState(),
  blocked = false,
  page = "home",
  editingId = null;
let dirty = false;
let draft = null;
let draftPersisted = false;
try {
  const raw = sessionStorage.getItem(DRAFT_KEY);
  if (raw) {
    const parsed = JSON.parse(raw);
    if (isDraft(parsed)) draft = parsed;
    draftPersisted = !!draft;
  }
} catch {
  // A private browser may block session storage. The in-memory guard still works.
}
try {
  state = loadState(localStorage);
} catch {
  blocked = true;
}
const escape = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const fmt = (value) =>
  new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
const sorted = () =>
  [...state.entries].sort((a, b) => Date.parse(b.start) - Date.parse(a.start));
function notice(message) {
  const el = document.querySelector("#notice");
  el.textContent = message;
  el.hidden = !message;
}
function formError(message) {
  const el = main.querySelector("#form-error");
  if (!el) return;
  el.textContent = message;
  el.hidden = !message;
  if (message) el.scrollIntoView({ block: "center" });
}
function saveDraft() {
  const form = main.querySelector("#entry-form");
  if (!form) return;
  dirty = true;
  draft = captureDraft(form, editingId);
  draftPersisted = false;
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    draftPersisted = true;
  } catch {
    notice("This browser cannot preserve an unfinished entry after refresh. Keep this tab open until you save.");
  }
}
function clearDraft() {
  dirty = false;
  draft = null;
  draftPersisted = false;
  try {
    sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    // No session storage was available.
  }
}
function commit(next) {
  if (blocked) {
    const message = "Storage is unavailable or changed in another tab. Reload before saving.";
    notice(message);
    formError(message);
    return false;
  }
  try {
    persistState(localStorage, next);
    state = next;
    return true;
  } catch {
    const message = "Could not save in this browser. Your changes are still on screen. Check browser storage permissions or available space and try again.";
    notice(message);
    formError(message);
    return false;
  }
}
const privacy =
  "This prototype stores information only in this browser, not in a secure cloud account or medical-record system. It can be lost when browser data is cleared and may be accessible to others using the same browser profile. Use made-up information for testing.";
const safety = () =>
  `<details class="safety"><summary>When to get urgent help</summary><p>Get emergency help for a sudden, extremely painful headache, a headache after a recent head injury, or headache with new weakness, trouble speaking, confusion, seizures, loss of vision, or high fever and a stiff neck. Seek urgent care for a new or worsening headache that concerns you.</p><p>General education only; this tracker does not diagnose or provide medical advice. Contact local emergency services for an emergency.</p><p><a href="https://www.nhs.uk/symptoms/headaches/" target="_blank" rel="noopener noreferrer">Read NHS headache guidance ↗</a> (opens an external site)</p></details>`;
function duration(entry) {
  const minutes = Math.max(
    0,
    Math.floor(
      ((entry.end ? Date.parse(entry.end) : Date.now()) -
        Date.parse(entry.start)) /
        60000,
    ),
  );
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m${entry.end ? "" : " so far"}`;
}
function card(e) {
  return `<article class="card"><div class="entry-top"><span class="badge ${e.end ? "done" : ""}">${e.end ? "Completed" : "Ongoing"}</span><span class="severity">${e.severity}<small> / 10</small></span></div><p class="entry-time">${escape(fmt(e.start))}</p><small>${duration(e)}</small><div class="actions"><button data-view="${escape(e.id)}">View entry</button>${!e.end ? `<button data-end="${escape(e.id)}">End headache</button>` : ""}</div></article>`;
}
function profileFields() {
  const p = state.profile;
  return `<label>Preferred first name <span class="muted">(optional)</span><input name="name" autocomplete="off" maxlength="40" value="${escape(p.name)}" placeholder="What should we call you?"></label><label>Age <span class="muted">(optional)</span><input name="age" type="number" inputmode="numeric" min="1" max="120" step="1" value="${p.age}" placeholder="Leave blank if you prefer"></label><label>What would you like to track? <span class="muted">(optional)</span><input name="goal" maxlength="160" value="${escape(p.goal)}" placeholder="For example, how often headaches happen"></label>`;
}
function render(focus = false) {
  editingId = null;
  if (blocked) page = "settings";
  nav.hidden = !state.onboardingComplete && !blocked;
  nav
    .querySelectorAll("button")
    .forEach((b) =>
      b.dataset.page === page
        ? b.setAttribute("aria-current", "page")
        : b.removeAttribute("aria-current"),
    );
  if (!state.onboardingComplete && !blocked) {
    main.innerHTML = `<section class="welcome"><div class="welcome-icon" aria-hidden="true">◒</div><p class="eyebrow">A small start</p><h1>Make space for<br>a little clarity.</h1><p class="muted">A quick note now. A clearer picture later. Let's make this feel like yours.</p><button class="text-button" data-action="skip">Skip for now</button><form id="profile-form">${profileFields()}<p class="hint">Age is only kept in your profile; it does not change advice.</p><div class="local-note">${privacy}</div><button class="primary wide">Let's get started</button></form>${safety()}</section>`;
  } else if (page === "home") {
    const hour = new Date().getHours();
    const greeting =
      hour < 12
        ? "Good morning"
        : hour < 18
          ? "Good afternoon"
          : "Good evening";
    main.innerHTML = `<div class="intro"><p class="eyebrow">Your daily check-in</p><h1>${greeting}${state.profile.name ? ", " + escape(state.profile.name) : ""}.</h1><p>Keep a note. Take it one moment at a time.</p></div>${draft ? '<div class="card"><h2>Unfinished entry</h2><p>Your changes are still here.</p><div class="actions"><button class="primary" data-action="resume">Resume entry</button><button data-action="discard-draft">Discard draft</button></div></div>' : ''}<section class="hero"><h2>How is your head feeling?</h2><p>Choose a pain level and save. Add details whenever you're ready.</p><button class="primary wide" data-action="log">＋ Log Headache</button></section><div class="section-title"><h2>Ongoing</h2><span class="badge">${state.entries.filter((e) => !e.end).length}</span></div>${
      sorted()
        .filter((e) => !e.end)
        .map(card)
        .join("") || '<p class="empty">No ongoing headaches logged.</p>'
    }<div class="section-title"><h2>Recent activity</h2><button class="text-button" data-page="history">View all</button></div>${sorted().slice(0, 3).map(card).join("") || '<p class="empty">Your first entry starts here. Nothing to fill out in advance.</p>'}${safety()}`;
  } else if (page === "history") {
    main.innerHTML = `<div class="intro"><p class="eyebrow">One entry at a time</p><h1>History</h1><p>Most recent start time first · ${state.entries.length} ${state.entries.length === 1 ? "entry" : "entries"}</p></div><button class="primary wide" data-action="log">＋ Log Headache</button>${sorted().map(card).join("") || '<p class="empty">No entries yet. Log a headache to start your history.</p>'}`;
  } else if (page === "reports") {
    main.innerHTML = `<p class="eyebrow">The bigger picture</p><h1>Reports</h1><div class="card"><h2>Start with a simple record.</h2><p>Reports will come in a later phase. For now, you can review each entry in History. This prototype does not infer patterns or diagnoses.</p><button class="text-button" data-page="history">Open history</button></div>`;
  } else {
    main.innerHTML = `<p class="eyebrow">Make it yours</p><h1>Settings</h1>${blocked ? '<p class="error">Stored data could not be read, its version is unsupported, or another tab changed it. It has not been overwritten. Reload to retry, or explicitly delete this prototype’s data below.</p>' : `<form id="profile-form" class="card"><h2>Your profile</h2>${profileFields()}<button class="primary wide" type="submit">Save profile</button></form><div class="actions"><button data-action="clear-profile">Clear profile</button><button data-action="reset-onboarding">Reset welcome</button></div>`}<div class="local-note">${privacy}</div><button class="danger wide" data-action="delete-all">Delete All Data</button><p class="hint">Deletes this prototype's entries and profile, and shows the welcome screen again.</p>${safety()}`;
  }
  if (focus) {
    main.focus();
    window.scrollTo(0, 0);
  }
}
const groups = {
  location: [
    "Front / forehead",
    "Back of head",
    "Left side",
    "Right side",
    "Around eyes",
    "Neck",
    "All over",
  ],
  characteristics: [
    "Throbbing",
    "Pressure / tightness",
    "Sharp",
    "Dull",
    "Burning",
  ],
  symptoms: [
    "Nausea",
    "Light sensitivity",
    "Sound sensitivity",
    "Visual disturbances",
    "Dizziness",
  ],
  triggers: [
    "Stress",
    "Poor sleep",
    "Skipped meal",
    "Dehydration",
    "Menstruation",
    "Alcohol",
    "Screen time",
  ],
};
function checks(key, values) {
  return `<fieldset><legend>${{ location: "Where does it hurt?", characteristics: "What does it feel like?", symptoms: "Associated symptoms", triggers: "Possible triggers (your observations)" }[key]}</legend><div class="choices">${groups[key].map((v) => `<label class="choice"><input type="checkbox" name="${key}" value="${escape(v)}" ${values.includes(v) ? "checked" : ""}>${v}</label>`).join("")}</div><label>Other <span class="muted">(optional)</span><input name="${key}-other" maxlength="160" value="${escape(values.filter((v) => !groups[key].includes(v)).join(", "))}"></label></fieldset>`;
}
function medication(m = {}) {
  return `<section class="medication"><h3>Medication taken</h3><label>Name<input data-med="name" maxlength="100" value="${escape(m.name)}" placeholder="Medication name"></label><label>Dose as taken <span class="muted">(optional)</span><input data-med="dose" maxlength="100" value="${escape(m.dose)}" placeholder="Include units, if known"></label><label>Time taken <span class="muted">(optional)</span><input data-med="time" type="datetime-local" value="${m.time ? localDateTime(m.time) : ""}"></label><label>Perceived effectiveness<select data-med="effectiveness">${["", "Not sure yet", "No relief", "Some relief", "Complete relief"].map((v) => `<option ${m.effectiveness === v ? "selected" : ""} value="${v}">${v || "Not recorded"}</option>`).join("")}</select></label><button type="button" class="text-button" data-action="remove-med">Remove medication</button></section>`;
}
function editor(id = null, ending = false) {
  const e = state.entries.find((x) => x.id === id) || {
    start: new Date().toISOString(),
    end: null,
    severity: 5,
    location: [],
    characteristics: [],
    symptoms: [],
    triggers: [],
    medications: [],
  };
  editingId = id;
  notice("");
  main.innerHTML = `<button class="back text-button" data-action="cancel">← Back</button><p class="eyebrow">${id ? "Your entry" : "A quick check-in"}</p><h1>${ending ? "End headache" : id ? "Edit headache" : "Log Headache"}</h1><p class="hint">Pain level and start time are all you need.</p><form id="entry-form"><p id="form-error" class="error" role="alert" hidden></p><fieldset><legend>Pain severity</legend><output class="pain-output" for="severity" id="pain-output">${e.severity}<small> / 10</small></output><input aria-label="Pain severity, 0 no pain to 10 worst imaginable" id="severity" name="severity" type="range" min="0" max="10" step="1" value="${e.severity}"><div class="range-labels"><span>0 · No pain</span><span>10 · Worst imaginable</span></div></fieldset><label>Started<input name="start" type="datetime-local" required value="${localDateTime(e.start)}"></label><label class="choice"><input type="checkbox" name="ongoing" ${!e.end && !ending ? "checked" : ""}>Still ongoing</label><label id="end-label" ${!e.end && !ending ? "hidden" : ""}>Ended<input name="end" type="datetime-local" ${!e.end && !ending ? "disabled" : "required"} value="${localDateTime(e.end || new Date())}"></label><div class="actions"><button class="primary" type="submit">${id ? "Save changes" : "Save headache"}</button><button type="button" data-action="cancel">Cancel</button></div><details><summary>Add optional details</summary><p class="hint">Choose anything useful. Symptoms are observations, not a diagnosis.</p>${Object.keys(
    groups,
  )
    .map((k) => checks(k, e[k]))
    .join(
      "",
    )}</details><details><summary>Medication <span class="muted">(optional)</span></summary><p class="hint">Record what you took. This app does not recommend medications or doses.</p><div id="medications">${e.medications.map(medication).join("")}</div><button type="button" data-action="add-med">＋ Add medication</button></details><div class="actions"><button class="primary" type="submit">${id ? "Save changes" : "Save headache"}</button></div></form>`;
  main.focus();
  window.scrollTo(0, 0);
}
function resumeDraft() {
  if (!isDraft(draft)) return;
  const saved = draft;
  if (saved.editingId && !state.entries.some((e) => e.id === saved.editingId)) {
    notice("The entry being edited no longer exists. Your unfinished changes were not applied.");
    return;
  }
  editor(saved.editingId);
  const form = main.querySelector("#entry-form");
  const container = form.querySelector("#medications");
  container.innerHTML = "";
  for (let i = 0; i < saved.medicationCount; i++)
    container.insertAdjacentHTML("beforeend", medication());
  const controls = [...form.elements].filter((el) => el.name || el.dataset.med);
  const incompatible =
    controls.length !== saved.fields.length ||
    controls.some(
      (el, i) =>
        saved.fields[i].type !== el.type ||
        saved.fields[i].name !== (el.name || null) ||
        saved.fields[i].med !== (el.dataset.med || null),
    );
  if (incompatible) {
    page = "home";
    render(true);
    notice("This unfinished entry is from an incompatible form version. Its saved data was not changed.");
    return;
  }
  controls.forEach((el, i) => {
    const field = saved.fields[i];
    if (el.type === "checkbox") el.checked = field.checked;
    else el.value = field.value;
  });
  const ongoing = form.elements.namedItem("ongoing").checked;
  form.querySelector("#end-label").hidden = ongoing;
  form.elements.namedItem("end").disabled = ongoing;
  form.querySelector("#pain-output").innerHTML = `${Number(form.elements.namedItem("severity").value)}<small> / 10</small>`;
  [...form.querySelectorAll("details")].forEach((el, i) => {
    el.open = saved.detailSections[i];
  });
  dirty = true;
  draft = saved;
  draftPersisted = true;
  notice("Unfinished entry restored. Save it when ready.");
}
function view(id) {
  const e = state.entries.find((x) => x.id === id);
  if (!e) return;
  main.innerHTML = `<button class="back text-button" data-page="history">← History</button><p class="eyebrow">Headache entry</p><h1>${escape(fmt(e.start))}</h1><div class="card"><div class="entry-top"><span class="badge ${e.end ? "done" : ""}">${e.end ? "Completed" : "Ongoing"}</span><span class="severity">${e.severity}<small> / 10</small></span></div><dl class="detail-grid"><dt>Started</dt><dd>${escape(fmt(e.start))}</dd><dt>Ended</dt><dd>${e.end ? escape(fmt(e.end)) : "Still ongoing"}</dd><dt>Duration</dt><dd>${duration(e)}</dd>${Object.keys(
    groups,
  )
    .map(
      (k) =>
        `<dt>${k[0].toUpperCase() + k.slice(1)}</dt><dd>${escape(e[k].join(", ") || "Not recorded")}</dd>`,
    )
    .join(
      "",
    )}<dt>Medication</dt><dd>${e.medications.map((m) => `${escape(m.name)}${m.dose ? " · " + escape(m.dose) : ""}${m.time ? " · " + escape(fmt(m.time)) : ""}${m.effectiveness ? " · " + escape(m.effectiveness) : ""}`).join("<br>") || "Not recorded"}</dd></dl></div><div class="actions"><button class="primary" data-edit="${escape(id)}">Edit entry</button>${!e.end ? `<button data-end="${escape(id)}">End headache</button>` : ""}</div><button class="text-button danger wide" data-delete="${escape(id)}">Delete entry</button>`;
  main.focus();
  window.scrollTo(0, 0);
}
let confirmAction;
function confirmDelete(title, copy, action, label = "Delete") {
  document.querySelector("#confirm-title").textContent = title;
  document.querySelector("#confirm-copy").textContent = copy;
  confirmAction = action;
  document.querySelector("#confirm-delete").textContent = label;
  document.querySelector("#confirmation").showModal();
}
document.querySelector("#confirm-cancel").onclick = () =>
  document.querySelector("#confirmation").close();
document.querySelector("#confirm-delete").onclick = () => {
  document.querySelector("#confirmation").close();
  confirmAction?.();
};
document.addEventListener("click", (event) => {
  const b = event.target.closest("button");
  if (!b) return;
  if (dirty && (b.dataset.page || b.dataset.action === "cancel" || b.dataset.action === "log")) {
    confirmDelete(
      "Discard unfinished changes?",
      "Your unsaved entry changes will be removed from this browser.",
      () => {
        clearDraft();
        b.click();
      },
      "Discard",
    );
    return;
  }
  if (draft && !dirty && b.dataset.action === "log") {
    resumeDraft();
    return;
  }
  if (b.dataset.page) {
    page = b.dataset.page;
    notice("");
    render(true);
  }
  if (b.dataset.view) view(b.dataset.view);
  if (b.dataset.edit) editor(b.dataset.edit);
  if (b.dataset.end) editor(b.dataset.end, true);
  if (b.dataset.delete)
    confirmDelete(
      "Delete this entry?",
      "This permanently removes this headache and its medication details from this browser.",
      () => {
        if (
          commit({
            ...state,
            entries: state.entries.filter((e) => e.id !== b.dataset.delete),
          })
        ) {
          page = "history";
          render(true);
          notice("Entry deleted.");
        }
      },
    );
  switch (b.dataset.action) {
    case "log":
      editor();
      break;
    case "resume":
      resumeDraft();
      break;
    case "discard-draft":
      confirmDelete(
        "Discard unfinished entry?",
        "This removes the saved draft from this browser. Saved headache entries stay.",
        () => {
          clearDraft();
          render(true);
        },
        "Discard",
      );
      break;
    case "cancel":
      render(true);
      break;
    case "skip":
      if (commit({ ...state, onboardingComplete: true })) {
        page = "home";
        render(true);
      }
      break;
    case "add-med":
      document
        .querySelector("#medications")
        .insertAdjacentHTML("beforeend", medication());
      document
        .querySelector("#medications .medication:last-child input")
        .focus();
      saveDraft();
      break;
    case "remove-med":
      b.closest(".medication").remove();
      saveDraft();
      break;
    case "clear-profile":
      confirmDelete(
        "Clear your profile?",
        "Your name, age and tracking goal will be removed. Headache entries stay.",
        () => {
          if (commit({ ...state, profile: emptyState().profile })) render(true);
        },
      );
      break;
    case "reset-onboarding":
      if (commit({ ...state, onboardingComplete: false })) render(true);
      break;
    case "delete-all":
      confirmDelete(
        "Delete all prototype data?",
        "All headache entries, medication records and profile information in this browser will be permanently removed. This cannot be undone.",
        () => {
          try {
            localStorage.removeItem(STORAGE_KEY);
            clearDraft();
            state = emptyState();
            blocked = false;
            page = "home";
            render(true);
            notice("All prototype data deleted.");
          } catch {
            notice(
              "Unable to delete browser data. Check your browser storage settings.",
            );
          }
        },
      );
      break;
  }
});
main.addEventListener("input", (event) => {
  if (event.target.closest("#entry-form")) formError("");
  if (event.target.name === "severity")
    document.querySelector("#pain-output").innerHTML =
      `${Number(event.target.value)}<small> / 10</small>`;
  if (event.target.closest("#entry-form")) saveDraft();
});
main.addEventListener("change", (event) => {
  if (event.target.closest("#entry-form")) formError("");
  if (event.target.name === "ongoing") {
    const ongoing = event.target.checked;
    document.querySelector("#end-label").hidden = ongoing;
    const input = main.querySelector("[name=end]");
    input.disabled = ongoing;
    input.required = !ongoing;
  }
  if (event.target.closest("#entry-form")) saveDraft();
});
main.addEventListener("toggle", (event) => {
  if (event.target.closest("#entry-form")) saveDraft();
}, true);
window.addEventListener("beforeunload", (event) => {
  if (dirty && !draftPersisted) event.preventDefault();
});
main.addEventListener("submit", (event) => {
  event.preventDefault();
  const form = event.target;
  const data = new FormData(form);
  if (form.id === "profile-form") {
    const finishingWelcome = !state.onboardingComplete;
    const profile = {
      name: data.get("name").trim(),
      age: data.get("age") === "" ? "" : Number(data.get("age")),
      goal: data.get("goal").trim(),
    };
    if (commit({ ...state, profile, onboardingComplete: true })) {
      if (finishingWelcome) page = "home";
      render(true);
      notice("Profile saved in this browser.");
    }
    return;
  }
  if (form.id !== "entry-form") return;
  saveDraft();
  try {
    const entry = {
      id: editingId || crypto.randomUUID(),
      start: parseLocalDateTime(data.get("start")),
      end: data.has("ongoing") ? null : parseLocalDateTime(data.get("end")),
      severity: Number(data.get("severity")),
      medications: [],
    };
    for (const key of Object.keys(groups))
      entry[key] = [
        ...data.getAll(key),
        ...(data.get(key + "-other").trim()
          ? [data.get(key + "-other").trim()]
          : []),
      ];
    entry.medications = [...form.querySelectorAll(".medication")].map((el) => {
      const v = (k) => el.querySelector(`[data-med="${k}"]`).value.trim();
      return {
        name: v("name"),
        dose: v("dose"),
        time: v("time") ? parseLocalDateTime(v("time")) : null,
        effectiveness: v("effectiveness"),
      };
    });
    validateEntry(entry);
    if (
      commit({
        ...state,
        entries: [...state.entries.filter((e) => e.id !== entry.id), entry],
      })
    ) {
      clearDraft();
      page = "home";
      render(true);
      notice("Headache saved. You can add or edit details anytime.");
    }
  } catch (error) {
    formError(
      error.message === "Invalid time value"
        ? "Enter a valid date and time."
        : error.message,
    );
  }
});
// Stop stale tabs from silently overwriting another tab's edits.
window.addEventListener("storage", (event) => {
  if (event.key === STORAGE_KEY || event.key === null) {
    blocked = true;
    notice(
      "Data changed in another tab. Reload this page before making more changes.",
    );
  }
});
render();
