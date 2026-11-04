# Phase 2 validation

Validated with synthetic information only, November 3, 2026. Phase 2 was tested through a local HTTP server; production remains Phase 1.

## Automated checks

`node --test tests/storage.test.mjs`: 9 passing tests. Covers empty/versioned state, full entry and profile persistence, all severity values and invalid severities, invalid/future/reversed dates, medication validation, unknown schema/corrupt data preservation, profile limits, duplicate IDs, failed storage writes, and local time formatting. JavaScript syntax and `git diff --check` pass.

## Browser checks

- Complete onboarding with a synthetic name, age and goal; personalized greeting appears.
- Skip onboarding; no mandatory profile information needed.
- Quick save with optional sections closed; range responds to keyboard arrows.
- Save severity 0 and 10; create both ongoing and already-completed entries.
- Refresh; profile and entries persist.
- View and edit an existing entry; record location, characteristics, symptoms, triggers and a synthetic medication with dose, time and effectiveness.
- Empty medication name produces a visible error without saving.
- Future start and end-before-start produce a visible error without saving.
- End an ongoing headache at an edited time; verify completed status, 2h 30m duration and preserved optional details.
- History sorts by start time, newest first, and distinguishes completed from ongoing.
- Cancel entry deletion, then confirm deletion; only the selected entry is removed.
- Edit profile; greeting changes. Confirm clear profile; headache history remains.
- Reset welcome and skip it again; entries remain.
- Cancel Delete All Data, then confirm; refresh returns to an empty welcome flow.
- All four navigation sections work. Browser console had no errors or warnings in the final smoke check.
- Layout checks at 320×568, 375×667, 393×852, 430×932 and desktop 1280×900: no horizontal overflow; navigation buttons measure 48px tall; desktop shell is 460px wide.

## Privacy verification

Source inspection found no fetch, XHR, WebSocket, beacon, analytics, remote scripts or server submission code. Persistence is exclusively localStorage. CSP explicitly sets `connect-src 'none'` and `form-action 'none'`. Static server traffic during testing consisted of page and local asset requests. The NHS education link is an explicit external navigation with no referrer and does not contain entry/profile values. These checks establish the application's data flow, not a security audit of the browser or hosting provider.

## Screenshots

Captured in the local preview at an iPhone-sized viewport with synthetic data:

- [Welcome](screenshots/welcome.jpg)
- [Quick log](screenshots/quick-log.jpg)
- [Home](screenshots/home.jpg)
- [History](screenshots/history.jpg)
- [Completed entry](screenshots/entry.jpg)

## Limits of validation

No physical iPhone, VoiceOver session or timed first-time usability study was available. The simple flow targets approximately 10 seconds, and the optional onboarding targets under 30 seconds; those timings are design targets, not measured user-study results. No sophisticated reporting, export/backup, encryption, account system or cross-device sync is included. Browser storage error/corruption handling is covered by automated tests; the happy-path browser checks use real local browser storage. Duration updates when screens render. Date editing uses the device's current time zone and minute precision.
