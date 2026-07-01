# kintone-command-palette

Press Ctrl+K (Cmd+K on macOS) on a kintone app screen to open a search box that
finds apps, views, records, and actions as you type, and jump to the selected
one with Enter. It works like the command palette in Linear or VS Code. Moving
between apps in kintone otherwise means returning to the portal or using browser
bookmarks, and switching views means opening a dropdown with the mouse. This
plugin keeps your hands on the keyboard for those jumps. Nothing is sent to an
external server; all work happens in the browser and through the kintone REST
API.

## What it does

- Opens on the list, record detail, create, and edit screens of the app the
  plugin is added to.
- Searches four sources: apps you can view, the current app's views, records in
  the current app, and a fixed set of actions (new record, open app settings,
  clear filter, back to list).
- Matches app, view, and action names with a fuzzy match that normalizes
  full-width and half-width characters and katakana/hiragana, so typing
  `kintone` finds `Ｋｉｎｔｏｎｅ` and `かたかな` finds `カタカナ`.
- Searches records with a `like` query over up to three text fields you choose
  in the settings.
- Shows recently used items when the query is empty, so common jumps are one key
  away.
- Moves the selection with the arrow keys, runs it with Enter, switches the
  source filter with Tab, and closes with Esc. During Japanese IME composition,
  the commit Enter and cancel Esc do not run or close the palette.

## Limitations

- The palette runs only inside apps where the plugin is installed. kintone
  plugins cannot run on the portal or in spaces, so there is no global launcher
  across all apps. This is a kintone platform constraint, not a setting.
- Record search uses kintone's `like` operator, which matches alphanumeric text
  by word units. Searching `abc` does not match inside `abcdef`. Japanese text
  does not have this restriction.
- Mobile is not supported. The palette depends on a physical keyboard for the
  shortcut and arrow navigation, which a software keyboard cannot provide. No
  mobile bundle ships with the plugin.
- In Firefox, Ctrl+Shift+K opens the developer tools before the page can react.
  Firefox users should keep the default Ctrl+K.

## Install

1. Build the plugin zip:
   ```
   npm install
   npm run build
   npm run pack
   ```
   `npm run pack` writes `dist/plugin.zip`. On the first run it also generates
   `private.ppk` in the project root and keeps it out of git. Reuse the same
   `private.ppk` for later builds so the plugin id stays stable.
2. In kintone, open the app settings, go to Plugins, add `dist/plugin.zip`, then
   add the plugin to the app.
3. Update the app to apply.

## Settings

- Shortcut key: Ctrl+K (default), Ctrl+Shift+K, or disabled. Disabled attaches
  no key listener.
- Source toggles: turn app search, view switching, record search, and actions on
  or off. A disabled source is left out of the results, the Tab filter cycle, and
  any REST request.
- Record search fields: choose up to three fields to search. Only single-line
  text, multi-line text, and link fields appear in the list. When record search
  is on, at least one field is required. Duplicate fields are rejected on save.
  Fields are stored by field code, so renaming a field keeps the setting valid;
  deleting a field or changing its type marks the setting for reselection.

## Data and privacy

The plugin sends nothing to any external server. It uses two browser storage
areas:

- `sessionStorage` under `kp-cmdp-apps-<domain>-<userCode>` caches the app list
  for 10 minutes to avoid refetching on every open. Clearing it: close the tab,
  or delete the key from the browser dev tools.
- `localStorage` under `kp-cmdp-recent-<domain>-<appId>-<userCode>` keeps up to
  20 recently used items per app and user. To clear the history, delete that key
  from the browser dev tools (Application, Local Storage).

If storage is blocked (private mode or quota), the history and cache turn
themselves off and the palette keeps working.

## Development

```
npm install
npm run typecheck   # tsc --noEmit
npm test            # vitest, core logic
npm run build       # dist/desktop.js and dist/config.js
npm run pack        # dist/plugin.zip
npm run lint        # eslint
```

The kintone-independent logic lives in `src/core` (fuzzy match, like query,
recent items, filter state, config schema, cache TTL) and is covered by unit
tests. `src/kintone` isolates REST calls and URL building. `src/desktop` builds
the palette DOM. E2E specs in `test/e2e` describe the main flows and run against
a development environment with connection details from environment variables.

## TODO

- Match highlighting inside candidate rows is not implemented (FR-3 defers it).
- E2E specs (`test/e2e`) are written but need a prepared kintone app to run.
- The plugin icon in `plugin/icon.png` is generated from `plugin/icon.svg`; swap
  in a final rendering before release if a rasterizer is not available at build
  time.

## License

MIT. See [LICENSE](./LICENSE).
