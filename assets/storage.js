import { validatePainData, painDataForEntry, HEAD_MODEL_VERSION } from './head-map/data.js';
import { TRACKING_GOALS } from './profile.js';

export const STORAGE_KEY = "headache-tracker.v1";
export const emptyState = () => ({
  version: 1,
  onboardingComplete: false,
  profile: { name: "", age: "", goal: "" },
  entries: [],
});
export function validateEntry(entry, now = Date.now()) {
  if (!entry || typeof entry.id !== "string" || !entry.id)
    throw new Error("This entry needs an identifier.");
  const start = Date.parse(entry.start);
  if (!Number.isFinite(start) || start > now)
    throw new Error("Choose a start date and time that is not in the future.");
  if (
    !Number.isInteger(entry.severity) ||
    entry.severity < 0 ||
    entry.severity > 10
  )
    throw new Error("Choose a pain level from 0 to 10.");
  if (
    entry.end !== null &&
    (!Number.isFinite(Date.parse(entry.end)) ||
      Date.parse(entry.end) < start ||
      Date.parse(entry.end) > now)
  )
    throw new Error(
      "End time must be at or after the start and not in the future.",
    );
  for (const key of ["location", "characteristics", "symptoms", "triggers"]) {
    if (
      !Array.isArray(entry[key]) ||
      entry[key].some((x) => typeof x !== "string" || x.length > 160)
    )
      throw new Error("An optional detail is invalid.");
  }
  if (!Array.isArray(entry.medications))
    throw new Error("Medication details are invalid.");
  for (const med of entry.medications) {
    if (
      typeof med.name !== "string" ||
      !med.name.trim() ||
      med.name.length > 100 ||
      typeof med.dose !== "string" ||
      med.dose.length > 100
    )
      throw new Error(
        "Enter a medication name, or remove the empty medication.",
      );
    if (
      med.time &&
      (!Number.isFinite(Date.parse(med.time)) || Date.parse(med.time) > now)
    )
      throw new Error("Medication time must not be in the future.");
    if (
      ![
        "",
        "Not sure yet",
        "No relief",
        "Some relief",
        "Complete relief",
      ].includes(med.effectiveness)
    )
      throw new Error("Choose a listed effectiveness option.");
  }
  if (entry.painLocations !== undefined || entry.behindEye !== undefined) {
    if ((entry.painLocations !== undefined && !Array.isArray(entry.painLocations)) ||
        (entry.behindEye !== undefined && !Array.isArray(entry.behindEye)) ||
        (entry.painModelVersion !== undefined && entry.painModelVersion !== HEAD_MODEL_VERSION))
      throw new Error('Stored pain-map details are unsupported.');
    validatePainData(painDataForEntry(entry));
  }
  return entry;
}
export function validateState(state) {
  if (
    !state ||
    state.version !== 1 ||
    typeof state.onboardingComplete !== "boolean" ||
    !state.profile ||
    !Array.isArray(state.entries)
  )
    throw new Error("Stored data has an unsupported format.");
  const p = state.profile;
  if (
    typeof p.name !== "string" ||
    p.name.length > 40 ||
    typeof p.goal !== "string" ||
    p.goal.length > 160 ||
    (p.trackingGoals !== undefined && (!Array.isArray(p.trackingGoals) ||
      p.trackingGoals.some(id => !TRACKING_GOALS.some(option => option.id === id)) ||
      new Set(p.trackingGoals).size !== p.trackingGoals.length)) ||
    !(p.age === "" || (Number.isInteger(p.age) && p.age >= 1 && p.age <= 120))
  )
    throw new Error("Stored profile is invalid.");
  state.entries.forEach((e) => validateEntry(e, Infinity));
  if (new Set(state.entries.map((e) => e.id)).size !== state.entries.length)
    throw new Error("Stored entries have duplicate identifiers.");
  return state;
}
export function loadState(storage) {
  const raw = storage.getItem(STORAGE_KEY);
  return raw === null ? emptyState() : validateState(JSON.parse(raw));
}
export function persistState(storage, state) {
  validateState(state);
  storage.setItem(STORAGE_KEY, JSON.stringify(state));
}
export function localDateTime(value = new Date()) {
  const d = new Date(value);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}
export function parseLocalDateTime(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))
    throw new Error("Enter a valid date and time.");
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()) || localDateTime(date) !== value)
    throw new Error("That local time does not exist. Choose another time.");
  return date.toISOString();
}
