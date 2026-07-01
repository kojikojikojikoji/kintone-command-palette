// Minimal type surface for the kintone global used by this plugin. It covers
// only the members this code touches, not the full kintone JS API.

export {};

declare global {
  interface KintoneRecordField {
    type: string;
    value: unknown;
    [extra: string]: unknown;
  }

  type KintoneRecord = Record<string, KintoneRecordField>;

  interface KintoneEvent {
    appId: number;
    viewId?: number | string;
    record?: KintoneRecord;
    [extra: string]: unknown;
  }

  type KintoneEventHandler = (event: KintoneEvent) => KintoneEvent | Promise<KintoneEvent>;

  interface KintoneLoginUser {
    id: string;
    code: string;
    name: string;
    timeZone: string;
    [extra: string]: unknown;
  }

  interface KintoneAppApi {
    getId(): number | null;
  }

  interface KintonePluginApp {
    getConfig(id: string): Record<string, string>;
    setConfig(config: Record<string, string>, callback?: () => void): void;
    getId?(): string;
  }

  interface KintoneNamespace {
    // Injected by kintone into plugin bundles; used to read the plugin config.
    $PLUGIN_ID?: string;
    app: KintoneAppApi;
    events: {
      on(events: string | string[], handler: KintoneEventHandler): void;
    };
    plugin: { app: KintonePluginApp };
    getLoginUser(): KintoneLoginUser;
  }

  const kintone: KintoneNamespace;
}
