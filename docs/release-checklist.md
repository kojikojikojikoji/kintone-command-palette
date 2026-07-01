# Release checklist

Run before publishing a new plugin zip. The palette runs on desktop only, so
there is no mobile column.

## Build gates

- [ ] `npm ci`
- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] `npm test`
- [ ] `npm run build` produces `dist/desktop.js` and `dist/config.js`
- [ ] `npm run pack` produces `dist/plugin.zip`

## Browser x screen matrix

Test each cell with the plugin installed on the demo app (see README, demo app
fields). "Open" means press the configured shortcut and confirm the palette
appears; "Run" means select a candidate and confirm the navigation.

| Screen \ Browser | Chrome | Edge | Firefox | Safari |
|---|---|---|---|---|
| List (index) | | | | |
| Record detail | | | | |
| Record create | | | | |
| Record edit | | | | |

## Behavior checks

- [ ] Open with the shortcut on all four screens (Ctrl+K, and Cmd+K on macOS).
- [ ] Ctrl+Shift+K setting: palette opens in Chrome/Edge; Firefox opens dev tools (known, EC-2).
- [ ] Empty query shows recent items; running a candidate adds it to the top.
- [ ] App, view, record, and action candidates each navigate correctly.
- [ ] Record search debounces and shows the latest result under fast typing.
- [ ] Japanese IME: conversion-commit Enter does not run a candidate; conversion-cancel Esc does not close (TC-32, TC-33).
- [ ] Guest space app: all navigation URLs carry the `/k/guest/<spaceId>` prefix (TC-34).
- [ ] Shortcut set to "disabled": nothing opens and the console stays clean (TC-24).
- [ ] Settings: record search on with no field is rejected; duplicate fields are rejected (TC-25, TC-26).
- [ ] A second plugin from this series on the same app does not clash on CSS, DOM ids, or keys (TC-37).
