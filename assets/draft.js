export const DRAFT_KEY = "headache-tracker.draft.v1";
export function captureDraft(form, editingId) {
  return {
    version: 1,
    editingId,
    fields: [...form.elements]
      .filter((el) => el.name || el.dataset.med)
      .map((el) => ({
        name: el.name || null,
        med: el.dataset.med || null,
        type: el.type,
        value: el.value,
        checked: el.type === "checkbox" ? el.checked : null,
      })),
    medicationCount: form.querySelectorAll(".medication").length,
    detailSections: [...form.querySelectorAll("details")].map((el) => el.open),
  };
}
export function isDraft(value) {
  return (
    value?.version === 1 &&
    (value.editingId === null || typeof value.editingId === "string") &&
    Array.isArray(value.fields) &&
    value.fields.length < 100 &&
    value.fields.every(
      (field) =>
        field &&
        (field.name === null || typeof field.name === "string") &&
        (field.med === null || typeof field.med === "string") &&
        typeof field.type === "string" &&
        typeof field.value === "string" &&
        (field.checked === null || typeof field.checked === "boolean"),
    ) &&
    Number.isInteger(value.medicationCount) &&
    value.medicationCount >= 0 &&
    value.medicationCount <= 20 &&
    Array.isArray(value.detailSections) &&
    value.detailSections.length === 2 &&
    value.detailSections.every((open) => typeof open === "boolean")
  );
}
