import { parseConfig } from "../core/config";
import type { Settings } from "../core/types";
import { Palette, type ScreenType } from "./palette";

// Desktop entry. Registers the four record-screen show events, builds one shared
// palette, and attaches a single capture-phase keydown listener for the
// shortcut. When the plugin is not configured, or the shortcut is disabled,
// nothing is attached (common spec: do nothing, no console error).

(() => {
  const pluginId = kintone.$PLUGIN_ID;
  const rawConfig = pluginId ? kintone.plugin.app.getConfig(pluginId) : undefined;
  const settings: Settings | null = parseConfig(rawConfig ? rawConfig.config : undefined);
  if (!settings || settings.shortcut === "disabled") {
    return;
  }

  let palette: Palette | null = null;
  let keyListenerAttached = false;

  function matchesShortcut(e: KeyboardEvent): boolean {
    if (e.altKey) return false;
    const cmdOrCtrl = e.ctrlKey || e.metaKey;
    if (!cmdOrCtrl) return false;
    if (e.key.toLowerCase() !== "k") return false;
    if (settings!.shortcut === "ctrl-shift-k") {
      return e.shiftKey;
    }
    return !e.shiftKey;
  }

  function attachKeyListener(): void {
    if (keyListenerAttached) return;
    keyListenerAttached = true;
    // Capture phase so the palette wins over the browser and page handlers
    // (FR-1, EC-1, EC-3). IME keys are handled inside the palette input.
    document.addEventListener(
      "keydown",
      (e) => {
        if (e.isComposing || e.keyCode === 229) return;
        if (!matchesShortcut(e)) return;
        e.preventDefault();
        e.stopPropagation();
        palette?.toggle();
      },
      true,
    );
  }

  function ensurePalette(appId: string): Palette {
    if (!palette) {
      palette = new Palette(appId, settings!);
    }
    palette.ensureMounted();
    return palette;
  }

  function onShow(screen: ScreenType) {
    return (event: KintoneEvent): KintoneEvent => {
      const appId = String(event.appId ?? kintone.app.getId() ?? "");
      if (appId === "") return event;
      const viewId = screen === "index" && event.viewId != null ? String(event.viewId) : null;
      const p = ensurePalette(appId);
      p.setScreen(screen, viewId);
      attachKeyListener();
      return event;
    };
  }

  kintone.events.on("app.record.index.show", onShow("index"));
  kintone.events.on("app.record.detail.show", onShow("detail"));
  kintone.events.on("app.record.create.show", onShow("create"));
  kintone.events.on("app.record.edit.show", onShow("edit"));
})();
