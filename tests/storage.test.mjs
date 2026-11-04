import test from "node:test";
import assert from "node:assert/strict";
import {
  emptyState,
  validateEntry,
  loadState,
  persistState,
  STORAGE_KEY,
  localDateTime,
  parseLocalDateTime,
} from "../assets/storage.js";
import { captureDraft, isDraft } from "../assets/draft.js";

const example = () => ({
  id: "synthetic-1",
  start: "2020-01-01T10:00:00Z",
  end: null,
  severity: 6,
  location: [],
  characteristics: [],
  symptoms: [],
  triggers: [],
  medications: [],
});
const memory = () => {
  const map = new Map();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => map.set(k, v),
  };
};
test("new storage is versioned and has no seeded health or personal data", () =>
  assert.deepEqual(loadState(memory()), emptyState()));
test("synthetic profile and full entry survive a storage round trip", () => {
  const storage = memory(),
    state = emptyState();
  state.profile = { name: "Test <script>", age: 30, goal: "Testing" };
  state.onboardingComplete = true;
  state.entries = [
    {
      ...example(),
      end: "2020-01-01T12:00:00Z",
      symptoms: ["Nausea"],
      medications: [
        {
          name: "Synthetic medication",
          dose: "Test dose",
          time: "2020-01-01T10:30:00Z",
          effectiveness: "Some relief",
        },
      ],
    },
  ];
  persistState(storage, state);
  assert.deepEqual(loadState(storage), state);
});
test("all pain values 0–10 are valid; out of range and fractions fail", () => {
  for (let i = 0; i <= 10; i++)
    assert.doesNotThrow(() => validateEntry({ ...example(), severity: i }));
  for (const severity of [-1, 11, 1.5, NaN, "5"])
    assert.throws(() => validateEntry({ ...example(), severity }));
});
test("future starts, future ends and reversed intervals fail", () => {
  assert.throws(() =>
    validateEntry({ ...example(), start: "2099-01-01T00:00:00Z" }),
  );
  assert.throws(() =>
    validateEntry({ ...example(), end: "2099-01-01T00:00:00Z" }),
  );
  assert.throws(() =>
    validateEntry({ ...example(), end: "2019-01-01T00:00:00Z" }),
  );
  assert.throws(() => validateEntry({ ...example(), start: "invalid" }));
});
test("optional medication permits unknown time and dose but requires name", () => {
  const valid = { name: "Synthetic", dose: "", time: null, effectiveness: "" };
  assert.doesNotThrow(() =>
    validateEntry({ ...example(), medications: [valid] }),
  );
  assert.throws(() =>
    validateEntry({ ...example(), medications: [{ ...valid, name: "" }] }),
  );
  assert.throws(() =>
    validateEntry({
      ...example(),
      medications: [{ ...valid, time: "2099-01-01" }],
    }),
  );
});
test("corrupt data and unknown versions are preserved, not silently reset", () => {
  for (const raw of ["{bad", JSON.stringify({ ...emptyState(), version: 2 })]) {
    const storage = memory();
    storage.setItem(STORAGE_KEY, raw);
    assert.throws(() => loadState(storage));
    assert.equal(storage.getItem(STORAGE_KEY), raw);
  }
});
test("profile limits and duplicate entry ids are rejected", () => {
  assert.throws(() =>
    persistState(memory(), {
      ...emptyState(),
      profile: { name: "Test", age: 121, goal: "" },
    }),
  );
  assert.throws(() =>
    persistState(memory(), {
      ...emptyState(),
      entries: [example(), example()],
    }),
  );
});
test("storage write errors propagate instead of pretending a save succeeded", () => {
  assert.throws(
    () =>
      persistState(
        {
          setItem() {
            throw new Error("QuotaExceededError");
          },
        },
        emptyState(),
      ),
    /QuotaExceededError/,
  );
});
test("a failed write leaves the last saved entry intact", () => {
  const map = new Map();
  let fail = false;
  const storage = {
    getItem: (key) => map.get(key) ?? null,
    setItem(key, value) {
      if (fail) throw new Error("QuotaExceededError");
      map.set(key, value);
    },
  };
  const saved = { ...emptyState(), entries: [example()] };
  persistState(storage, saved);
  fail = true;
  assert.throws(() => persistState(storage, { ...saved, entries: [] }), /QuotaExceededError/);
  assert.deepEqual(loadState(storage), saved);
});
test("local date-time representation preserves the local wall-clock minute", () => {
  const input = new Date(2020, 0, 1, 10, 15);
  assert.equal(localDateTime(input), "2020-01-01T10:15");
});
test("local time parsing rejects malformed and nonexistent wall-clock times", () => {
  assert.equal(parseLocalDateTime("2020-01-01T10:15"), new Date(2020, 0, 1, 10, 15).toISOString());
  for (const value of ["", "2020-01-01T10:15Z", "2020-02-30T10:15", "2020-13-01T10:15"])
    assert.throws(() => parseLocalDateTime(value));
});
test("spring daylight-saving gap is rejected in a local timezone", async () => {
  const { spawnSync } = await import("node:child_process");
  const result = spawnSync(process.execPath, ["--input-type=module", "-e", `import {parseLocalDateTime} from './assets/storage.js'; try { parseLocalDateTime('2026-03-08T02:30'); process.exit(1); } catch { process.exit(0); }`], {
    cwd: process.cwd(), env: { ...process.env, TZ: "America/Chicago" }, encoding: "utf8"
  });
  assert.equal(result.status, 0, result.stderr);
});
test("unfinished entry captures medication and rejects malformed draft data", () => {
  const form = {
    elements: [
      { name: "severity", dataset: {}, type: "range", value: "7" },
      { name: "ongoing", dataset: {}, type: "checkbox", value: "on", checked: true },
      { name: "", dataset: { med: "name" }, type: "text", value: "Synthetic medication" },
    ],
    querySelectorAll(selector) {
      return selector === ".medication" ? [{}] : [{ open: true }, { open: false }];
    },
  };
  const draft = captureDraft(form, "synthetic-1");
  assert.equal(isDraft(draft), true);
  assert.equal(draft.fields[2].value, "Synthetic medication");
  assert.equal(draft.fields[1].checked, true);
  assert.deepEqual(draft.detailSections, [true, false]);
  assert.equal(isDraft({ ...draft, fields: [null] }), false);
  assert.equal(isDraft({ ...draft, medicationCount: -1 }), false);
});
