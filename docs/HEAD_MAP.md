# 3D pain mapping in headache entries

The existing neutral head and connected-surface coverage renderer are integrated into the entry form. This does not embed the standalone preview or use its separate storage. All model and rendering assets are served locally under the existing Content Security Policy.

## Interaction

- Tap the head to add a location; drag to rotate. Vertical rotation is limited to 10° below and 45° above the frontal view.
- Tap another existing hotspot to edit it. Tap the active hotspot again, or use Remove, to remove it.
- Intensity and coverage sliders follow the active hotspot. A new point inherits the last values used within that entry. A new entry starts at intensity 5 and coverage 50.
- With no hotspot selected, intensity is the entry's overall severity and coverage sets the next point's spread. Existing entries without map data remain editable.
- Separate left/right “Behind the eye” checkboxes record depth that cannot be selected on the skin surface.
- Point lists, anatomical point names, preset views and affected-area counts are hidden. Read-only entry views show the saved head and behind-eye selections.

Coverage spreads along connected mesh edges rather than through the skull. Its 0–100 scale controls a continuous radius, independent of intensity; Focused/Broad are qualitative labels, not physical measurements. Provisional anatomical region IDs and coverage analysis remain in saved records for future review and do not generate diagnoses.

## Persistence

Head-map fields are optional additions to each existing `headache-tracker.v1` entry: `painModelVersion`, `painLocations`, `behindEye`, `lastUsedIntensity`, `lastUsedCoverage`, and `activePainPointId`. Points retain IDs, the stable parent entry ID, local 3D position/normal, mesh triangle and barycentric coordinates, intensity, coverage and derived region analysis. The original entry fields and medication records are preserved.

The history card's overall severity is the maximum point intensity when points exist. The slider always shows the active point's intensity. With no points, a general 0–10 severity remains available. Exact points and the active selection also persist in the existing session draft. Old entries and old drafts remain readable. Invalid or unsupported records are rejected by the existing storage validation instead of being overwritten.

## Validation

`node --test tests/*.test.mjs` covers existing storage behavior plus map round-trips, corrupt records, stable entry IDs and legacy drafts. `tests/head-map.browser.cjs` exercises real WebGL selection, sliders, behind-eye choices, draft restoration, saved-entry editing, fresh defaults, phone widths and browser/CSP errors. The browser harness uses the local Codex Playwright runtime and installed Chrome; adjust those two paths for other machines. Serve the repository on port 4173 before running it, or set `APP_URL`.

## Credits and review limits

Head adapted from “Infinite, 3D Head Scan” by Lee Perry-Smith, based on work at www.triplegangers.com, under [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/). Adaptations include neutral rendering, neck/upper shoulders, and pain mapping. Original attribution is preserved in `assets/head-map/LICENSE-head.txt` and available in Settings. Three.js is bundled under its MIT license in `assets/head-map/vendor/LICENSE-three.txt`.

Region taxonomy, coverage thresholds and history severity aggregation are product assumptions requiring review. The model is not a validated measurement tool. This integration does not infer headache diagnoses or add cloud transmission. Review the integration branch before merging to `main`, which deploys automatically.
