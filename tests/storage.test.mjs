import test from "node:test";
import assert from "node:assert/strict";
import {
  emptyState,
  validateEntry,
  loadState,
  persistState,
  STORAGE_KEY,
  localDateTime,
} from "../assets/storage.js";

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
test("local date-time representation preserves the local wall-clock minute", () => {
  const input = new Date(2020, 0, 1, 10, 15);
  assert.equal(localDateTime(input), "2020-01-01T10:15");
});
