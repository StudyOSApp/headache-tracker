# Headache Tracker

An experimental, privacy-conscious headache and migraine tracking web app.

## Phase 2 — review branch

Mobile-first local logging: editable start/end times, ongoing entries, 0–10 pain severity, optional location/characteristics/symptoms/triggers, multiple medication records, and history with view/edit/delete. Skippable onboarding asks for a preferred name, optional age and tracking goal. Settings supports profile editing, clearing, welcome reset and confirmed deletion of all data. Reports remain a placeholder.

This project shares only its GitHub owner with StudyOS. It has no connection to StudyOS.tech, its resources, or its data.

## Development

Serve the repository with `python3 -m http.server 4173 --bind 127.0.0.1` and open http://127.0.0.1:4173. JavaScript modules require an HTTP server, not opening the file directly. No build or dependencies are needed. Run validation with `node --test tests/storage.test.mjs` (Node 22+).

`assets/app.js` handles navigation, forms and accessible confirmations; `assets/storage.js` owns versioning, validation and persistence. Dates are stored as ISO instants and edited/displayed in the device's current local time zone. Duration is calculated when a screen renders, rather than running a background timer.

## Privacy and limitations

Use synthetic information for prototype testing. All entries and preferences share one versioned localStorage document (`headache-tracker.v1`). There is no authentication, cloud sync, encryption, analytics, or medical-data transmission. Browser profiles can be shared and browser storage can be cleared, lost or unavailable. The app reports failed saves and refuses to overwrite unreadable/unsupported data. Other-tab changes block saving until reload. This is a single-device prototype, not a medical-record system. There is no export/backup yet, and unsaved form changes are discarded when navigating away.

The Content Security Policy blocks network connections and form submissions, and all scripts/styles are local. Normal static page/asset requests still go to the host; they contain no stored entries or profile fields. The optional NHS guidance link opens an external site without a referrer. Safety copy is educational and based on https://www.nhs.uk/symptoms/headaches/; no diagnosis or dosing recommendations are generated. Age is optional and does not influence guidance.

## Deployment

Pushes to `main` deploy to GitHub Pages via the existing GitHub Actions workflow. The Phase 2 branch does not trigger deployment. Review and explicit approval are required before merging Phase 2. Do not manually dispatch deployment for the development branch.

The live Phase 1 site stays unchanged until approval. No PWA, cloud database, head map, advanced reporting, or automatic headache classification is included.
