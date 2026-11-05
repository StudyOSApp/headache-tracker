# Headache Tracker

An experimental, privacy-conscious headache and migraine tracking web app.

## Local logging with 3D pain mapping

Mobile-first local logging: editable start/end times, ongoing entries, a rotatable 3D head with multiple pain locations, compact per-location intensity and coverage controls, behind-the-eye checkboxes, optional characteristics/symptoms/triggers, multiple medication records, and history with view/edit/delete. Skippable onboarding has two short screens: optional name/age, then multiple tracking-goal buttons with a conditional Other field. Settings supports profile editing, clearing, welcome reset and confirmed deletion of all data. Reports remain a placeholder.

This project shares only its GitHub owner with StudyOS. It has no connection to StudyOS.tech, its resources, or its data.

## Development

Serve the repository with `python3 -m http.server 4173 --bind 127.0.0.1` and open http://127.0.0.1:4173. JavaScript modules require an HTTP server, not opening the file directly. No build or dependencies are needed. Run validation with `node --test tests/*.test.mjs` (Node 22+).

`assets/app.js` handles navigation, forms and accessible confirmations; `assets/storage.js` owns versioning, validation and persistence; `assets/draft.js` captures unfinished entry forms. Dates are stored as ISO instants and edited/displayed in the device's current local time zone. Duration is calculated when a screen renders, rather than running a background timer.

See [3D pain-map integration](docs/HEAD_MAP.md) for interaction behavior, saved data, validation and model credits.

## Privacy and limitations

Use synthetic information for prototype testing. All entries and preferences share one versioned localStorage document (`headache-tracker.v1`). Unfinished entry edits are kept in this tab's sessionStorage until saved or explicitly discarded. There is no authentication, cloud sync, encryption, analytics, or medical-data transmission. Browser profiles can be shared and browser storage can be cleared, lost or unavailable. The app reports failed saves and refuses to overwrite unreadable/unsupported data. Other-tab changes block saving until reload. This is a single-device prototype, not a medical-record system. There is no export/backup yet.

The Content Security Policy blocks network connections and form submissions, and all scripts/styles are local. Normal static page/asset requests still go to the host; they contain no stored entries or profile fields. The optional NHS guidance link opens an external site without a referrer. Safety copy is educational and based on https://www.nhs.uk/symptoms/headaches/; no diagnosis or dosing recommendations are generated. Age is optional and does not influence guidance.

## Deployment

Pushes to `main` deploy to GitHub Pages via the existing GitHub Actions workflow. Development branches do not trigger deployment.

No PWA, cloud database, advanced reporting, or automatic headache diagnosis is included. Anatomical mapping is a prototype and has not been clinically validated.
