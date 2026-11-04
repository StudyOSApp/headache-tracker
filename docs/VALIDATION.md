# Phase 2 validation

Validated with synthetic information only, November 3, 2026. Phase 2 was tested through a local HTTP server; production remains Phase 1.

## Automated checks

`node --test tests/storage.test.mjs`: all 9 original tests and 4 targeted tests pass (13 total). The added tests cover failed-write preservation of the previous entry, malformed and nonexistent local times including a daylight-saving gap, and unfinished entry capture/validation. JavaScript syntax and `git diff --check` pass.

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
- Finish the reset welcome flow with a synthetic name; the user returns to Home with a personalized greeting.
- Change an unfinished entry, refresh, and resume with severity, start time, symptom, and synthetic medication fields intact. Repeat while editing an existing entry; save the edit without duplicating medication.
- Attempt to leave a changed entry; the discard dialog lets the user keep editing or explicitly discard the draft.
- Reject a nonexistent local time and preserve the form for correction.
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

No physical iPhone, VoiceOver session or timed first-time usability study was available. The simple flow targets approximately 10 seconds, and the optional onboarding targets under 30 seconds; those timings are design targets, not measured user-study results. No sophisticated reporting, export/backup, encryption, account system or cross-device sync is included. Browser storage write failure and corruption handling is covered by automated tests; a forced storage failure was not exercised through the browser UI. If sessionStorage is unavailable, unfinished entries cannot survive a refresh and the app warns the user. Duration updates when screens render. Date editing uses the device's current time zone and minute precision; a repeated local hour when daylight saving ends is not disambiguated.
