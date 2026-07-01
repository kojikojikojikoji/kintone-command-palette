import paletteCss from "./palette.css?raw";
import { matchList } from "../core/match";
import { buildLikeQuery } from "../core/query";
import { cycleFilter, moveSelection } from "../core/state";
import type { Settings, SourceFilter, SourceKey } from "../core/types";
import {
  appSettingsUrl,
  appUrl,
  deriveGuestContext,
  newRecordUrl,
  recordUrl,
  viewUrl,
} from "../kintone/url";
import type { GuestContext } from "../kintone/url";
import { fetchApps, fetchViews, searchRecords } from "../kintone/api";
import type { AppEntry, ViewEntry } from "../kintone/api";
import { loadRecent, pushRecent } from "../kintone/storage";

export type ScreenType = "index" | "detail" | "create" | "edit";

interface Candidate {
  type: "action" | "view" | "app" | "record" | "recent";
  id: string;
  label: string;
  subLabel: string;
  url: string;
}

interface Section {
  title: string;
  candidates: Candidate[];
  status?: string; // shown (non-selectable) when there are no candidates
}

const RECORD_DEBOUNCE_MS = 300;
const GROUP_LIMIT_ALL = 5;
const GROUP_LIMIT_SINGLE = 20;

const VIEW_TYPE_LABELS: Record<string, string> = {
  LIST: "一覧",
  CALENDAR: "カレンダー",
  CUSTOM: "カスタマイズ",
};

const MESSAGES = {
  placeholder: "アプリ、ビュー、レコード、アクションを検索",
  footerKeys: "↑↓ 移動　Enter 実行　Tab フィルタ　Esc 閉じる",
  appsLoading: "アプリ一覧を読み込み中...",
  appsError: "アプリ一覧を取得できませんでした",
  appsTruncated: "アプリは先頭1000件のみ表示しています",
  recordSearching: "検索中...",
  recordEmptyQuery: "キーワードを入力するとレコードを検索します",
  recordError: "レコードを検索できませんでした",
  noResults: "該当する項目がありません",
  recentEmpty: "まだ履歴がありません。入力して検索してください",
  recentTitle: "最近使った項目",
};

const FILTER_LABELS: Record<SourceFilter, string> = {
  all: "すべて",
  actions: "アクション",
  views: "ビュー",
  apps: "アプリ",
  records: "レコード",
};

// One palette instance is shared across the record screens of an app.
export class Palette {
  private readonly guest: GuestContext;
  private readonly appId: string;
  private readonly settings: Settings;
  private readonly enabled: Record<SourceKey, boolean>;

  private screen: ScreenType = "index";
  private viewId: string | null = null;

  private overlay!: HTMLDivElement;
  private input!: HTMLInputElement;
  private filterEl!: HTMLDivElement;
  private listEl!: HTMLUListElement;
  private footerNoteEl!: HTMLSpanElement;

  private query = "";
  private filter: SourceFilter = "all";
  private selectedIndex = 0;

  private apps: AppEntry[] = [];
  private views: ViewEntry[] = [];
  private appsLoading = false;
  private appsError = false;
  private appsTruncated = false;
  private dataStarted = false;

  private recordHits: Candidate[] = [];
  private recordsSearching = false;
  private recordsError = false;
  private recordSeq = 0;
  private recordTimer: ReturnType<typeof setTimeout> | null = null;

  private candidates: Candidate[] = [];
  private optionEls: HTMLLIElement[] = [];
  private navigating = false;
  private lastFocused: Element | null = null;

  constructor(appId: string, settings: Settings) {
    this.appId = appId;
    this.settings = settings;
    this.guest = deriveGuestContext(location.pathname);
    this.enabled = {
      apps: settings.sources.apps,
      views: settings.sources.views,
      records: settings.sources.records,
      actions: settings.sources.actions,
    };
    this.injectStyles();
    this.build();
  }

  /** Update the screen kind and (for index) the current view id per show event. */
  setScreen(screen: ScreenType, viewId: string | null): void {
    this.screen = screen;
    if (screen === "index" && viewId != null) {
      this.viewId = viewId;
    }
  }

  /** Re-attach the overlay if kintone replaced the body between screens. */
  ensureMounted(): void {
    if (!this.overlay.isConnected) {
      document.body.appendChild(this.overlay);
    }
  }

  isOpen(): boolean {
    return this.overlay.classList.contains("kp-cmdp-open");
  }

  toggle(): void {
    if (this.isOpen()) {
      this.close();
    } else {
      this.open();
    }
  }

  open(): void {
    this.ensureMounted();
    this.lastFocused = document.activeElement;
    this.query = "";
    this.filter = "all";
    this.selectedIndex = 0;
    this.recordHits = [];
    this.recordsSearching = false;
    this.recordsError = false;
    this.navigating = false;
    this.input.value = "";
    this.overlay.classList.add("kp-cmdp-open");
    this.input.setAttribute("aria-expanded", "true");
    this.startData();
    this.render();
    this.input.focus();
  }

  close(): void {
    this.overlay.classList.remove("kp-cmdp-open");
    this.input.setAttribute("aria-expanded", "false");
    if (this.recordTimer) {
      clearTimeout(this.recordTimer);
      this.recordTimer = null;
    }
    if (this.lastFocused instanceof HTMLElement) {
      this.lastFocused.focus();
    }
  }

  private injectStyles(): void {
    const style = document.createElement("style");
    style.textContent = paletteCss;
    style.dataset.kpCmdp = "true";
    document.head.appendChild(style);
  }

  private build(): void {
    const overlay = document.createElement("div");
    overlay.className = "kp-cmdp-overlay";
    overlay.addEventListener("mousedown", (e) => {
      if (e.target === overlay) {
        this.close();
      }
    });

    const panel = document.createElement("div");
    panel.className = "kp-cmdp-panel";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-label", "コマンドパレット");

    const search = document.createElement("div");
    search.className = "kp-cmdp-search";
    const icon = document.createElement("span");
    icon.className = "kp-cmdp-search__icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = "⌕"; // magnifying glass approximation
    const input = document.createElement("input");
    input.className = "kp-cmdp-search__input";
    input.type = "text";
    input.placeholder = MESSAGES.placeholder;
    input.setAttribute("role", "combobox");
    input.setAttribute("aria-expanded", "false");
    input.setAttribute("aria-controls", "kp-cmdp-list");
    input.setAttribute("aria-autocomplete", "list");
    input.addEventListener("input", () => this.onInput());
    input.addEventListener("keydown", (e) => this.onKeydown(e));
    search.appendChild(icon);
    search.appendChild(input);

    const filterEl = document.createElement("div");
    filterEl.className = "kp-cmdp-filter";

    const listEl = document.createElement("ul");
    listEl.className = "kp-cmdp-list";
    listEl.id = "kp-cmdp-list";
    listEl.setAttribute("role", "listbox");

    const footer = document.createElement("div");
    footer.className = "kp-cmdp-footer";
    const note = document.createElement("span");
    note.className = "kp-cmdp-footer__note";
    const keys = document.createElement("span");
    keys.textContent = MESSAGES.footerKeys;
    footer.appendChild(note);
    footer.appendChild(keys);

    panel.appendChild(search);
    panel.appendChild(filterEl);
    panel.appendChild(listEl);
    panel.appendChild(footer);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    this.overlay = overlay;
    this.input = input;
    this.filterEl = filterEl;
    this.listEl = listEl;
    this.footerNoteEl = note;
  }

  private startData(): void {
    if (this.dataStarted) return;
    this.dataStarted = true;

    if (this.enabled.apps) {
      this.appsLoading = true;
      fetchApps(this.guest.spaceId, Date.now())
        .then((res) => {
          this.apps = res.apps.slice().sort((a, b) => a.name.localeCompare(b.name, "ja"));
          this.appsTruncated = res.truncated;
          this.appsLoading = false;
          if (this.isOpen()) this.render();
        })
        .catch(() => {
          this.appsLoading = false;
          this.appsError = true;
          if (this.isOpen()) this.render();
        });
    }

    if (this.enabled.views) {
      fetchViews(this.guest.spaceId, this.appId)
        .then((views) => {
          this.views = views;
          if (this.isOpen()) this.render();
        })
        .catch(() => {
          // A missing view list just hides that group (EC-20). No error row.
          this.views = [];
        });
    }
  }

  private onInput(): void {
    this.query = this.input.value;
    this.selectedIndex = 0;
    this.scheduleRecordSearch();
    this.render();
  }

  private onKeydown(e: KeyboardEvent): void {
    // Ignore keys during IME composition so a conversion-commit Enter does not
    // run a candidate and a conversion-cancel Esc does not close (EC-4, EC-5).
    if (e.isComposing || e.keyCode === 229) {
      return;
    }
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        this.moveSelection(1);
        break;
      case "ArrowUp":
        e.preventDefault();
        this.moveSelection(-1);
        break;
      case "Enter":
        e.preventDefault();
        this.executeSelected();
        break;
      case "Escape":
        e.preventDefault();
        this.close();
        break;
      case "Tab":
        e.preventDefault();
        this.filter = cycleFilter(this.filter, this.enabled, e.shiftKey ? -1 : 1);
        this.selectedIndex = 0;
        this.render();
        break;
      default:
        break;
    }
  }

  private moveSelection(delta: number): void {
    const next = moveSelection(this.selectedIndex, this.candidates.length, delta);
    if (next < 0) return;
    this.selectedIndex = next;
    this.applySelection();
    const el = this.optionEls[next];
    if (el) el.scrollIntoView({ block: "nearest" });
  }

  private executeSelected(): void {
    const candidate = this.candidates[this.selectedIndex];
    if (!candidate) return;
    this.run(candidate);
  }

  private run(candidate: Candidate): void {
    if (this.navigating) return; // ignore repeated Enter (EC-19)
    this.navigating = true;
    pushRecent(
      this.appId,
      {
        type: candidate.type,
        id: candidate.id,
        label: candidate.label,
        subLabel: candidate.subLabel,
        url: candidate.url,
      },
      Date.now(),
    );
    location.href = candidate.url;
  }

  // TODO(spec EC-9/EC-10): when a configured field is deleted or changes type,
  // kintone rejects the query for the unknown field and this shows the generic
  // "search failed" row. The spec asks to instead drop the missing field and
  // continue (EC-9), or disable the record source with a one-time admin notice
  // when all fields are gone (EC-10). Detect the field error and adjust.
  private scheduleRecordSearch(): void {
    if (this.recordTimer) {
      clearTimeout(this.recordTimer);
      this.recordTimer = null;
    }
    // Invalidate any in-flight request right away. Bumping only when the next
    // request starts would let a stale response land during the debounce
    // window and overwrite the newer query's view (EC-13).
    this.recordSeq += 1;
    if (!this.enabled.records || this.query.trim() === "") {
      this.recordHits = [];
      this.recordsSearching = false;
      this.recordsError = false;
      return;
    }
    this.recordsSearching = true;
    this.recordsError = false;
    const q = this.query;
    this.recordTimer = setTimeout(() => this.runRecordSearch(q), RECORD_DEBOUNCE_MS);
  }

  private runRecordSearch(raw: string): void {
    const fields = this.settings.recordSearchFields;
    const query = buildLikeQuery(raw, fields);
    if (query === "") {
      this.recordsSearching = false;
      return;
    }
    const seq = ++this.recordSeq;
    searchRecords(this.guest.spaceId, this.appId, query, fields)
      .then((hits) => {
        if (seq !== this.recordSeq) return; // a newer query won (EC-13)
        this.recordHits = hits.map((hit) => this.toRecordCandidate(hit, raw, fields));
        this.recordsSearching = false;
        this.recordsError = false;
        if (this.isOpen()) this.render();
      })
      .catch(() => {
        if (seq !== this.recordSeq) return;
        this.recordsSearching = false;
        this.recordsError = true;
        if (this.isOpen()) this.render();
      });
  }

  private toRecordCandidate(
    hit: { id: string; fields: Record<string, string> },
    raw: string,
    fields: string[],
  ): Candidate {
    const primary = fields[0] ? hit.fields[fields[0]] : "";
    const label = primary && primary.trim() !== "" ? primary : `レコード ${hit.id}`;
    const terms = raw
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length > 0);
    let sub = "";
    for (const code of fields) {
      const value = hit.fields[code] ?? "";
      if (value && terms.some((t) => value.toLowerCase().includes(t))) {
        sub = value;
        break;
      }
    }
    if (sub === "") {
      const firstNonEmpty = fields.map((c) => hit.fields[c]).find((v) => v && v.trim() !== "");
      sub = firstNonEmpty ?? "";
    }
    return {
      type: "record",
      id: hit.id,
      label,
      subLabel: sub.slice(0, 40),
      url: recordUrl(this.guest, this.appId, hit.id),
    };
  }

  // --- candidate builders ---------------------------------------------------

  private buildActions(): Candidate[] {
    const actions: Candidate[] = [];
    const add = (id: string, label: string, url: string): void => {
      actions.push({ type: "action", id, label, subLabel: "", url });
    };
    if (this.screen === "index" || this.screen === "detail") {
      add("new-record", "新規レコードを作成", newRecordUrl(this.guest, this.appId));
    }
    add("app-settings", "アプリの設定を開く", appSettingsUrl(this.guest, this.appId));
    if (this.screen === "index" && this.viewId != null) {
      add("clear-filter", "検索条件をクリア", viewUrl(this.guest, this.appId, this.viewId));
    }
    if (this.screen !== "index") {
      add("back-to-list", "レコード一覧に戻る", appUrl(this.guest, this.appId));
    }
    return actions;
  }

  private appCandidates(): Candidate[] {
    return this.apps.map((app) => ({
      type: "app" as const,
      id: app.appId,
      label: app.name,
      subLabel: `アプリ ID: ${app.appId}`,
      url: appUrl(this.guest, app.appId),
    }));
  }

  private viewCandidates(): Candidate[] {
    return this.views.map((view) => ({
      type: "view" as const,
      id: view.id,
      label: view.name,
      subLabel: VIEW_TYPE_LABELS[view.type] ?? view.type,
      url: viewUrl(this.guest, this.appId, view.id),
    }));
  }

  private recentCandidates(): Candidate[] {
    return loadRecent(this.appId).map((item) => ({
      type: "recent" as const,
      id: item.id,
      label: item.label,
      subLabel: item.subLabel,
      url: item.url,
    }));
  }

  // --- rendering ------------------------------------------------------------

  private computeSections(): Section[] {
    const limit = this.filter === "all" ? GROUP_LIMIT_ALL : GROUP_LIMIT_SINGLE;
    const q = this.query;
    const emptyQuery = q.trim() === "";

    if (this.filter === "all" && emptyQuery) {
      const recent = this.recentCandidates();
      return [
        {
          title: MESSAGES.recentTitle,
          candidates: recent,
          status: recent.length === 0 ? MESSAGES.recentEmpty : undefined,
        },
      ];
    }

    const sections: Section[] = [];
    const wants = (source: SourceKey): boolean =>
      this.enabled[source] && (this.filter === "all" || this.filter === source);

    if (wants("actions")) {
      sections.push({
        title: FILTER_LABELS.actions,
        candidates: matchList(q, this.buildActions(), (c) => c.label).slice(0, limit),
      });
    }
    if (wants("views")) {
      sections.push({
        title: FILTER_LABELS.views,
        candidates: matchList(q, this.viewCandidates(), (c) => c.label).slice(0, limit),
      });
    }
    if (wants("apps")) {
      const section: Section = { title: FILTER_LABELS.apps, candidates: [] };
      if (this.appsError) {
        section.status = MESSAGES.appsError;
      } else if (this.appsLoading) {
        section.status = MESSAGES.appsLoading;
      } else {
        section.candidates = matchList(q, this.appCandidates(), (c) => c.label).slice(0, limit);
      }
      sections.push(section);
    }
    if (wants("records")) {
      const section: Section = { title: FILTER_LABELS.records, candidates: [] };
      if (emptyQuery) {
        section.status = MESSAGES.recordEmptyQuery;
      } else if (this.recordsError) {
        section.status = MESSAGES.recordError;
      } else if (this.recordsSearching) {
        section.status = MESSAGES.recordSearching;
      } else {
        section.candidates = this.recordHits.slice(0, limit);
      }
      sections.push(section);
    }

    return sections;
  }

  private render(): void {
    this.filterEl.textContent = FILTER_LABELS[this.filter];
    this.footerNoteEl.textContent = this.appsTruncated ? MESSAGES.appsTruncated : "";

    const sections = this.computeSections();
    this.listEl.textContent = "";
    this.candidates = [];
    this.optionEls = [];

    let renderedAnything = false;
    for (const section of sections) {
      if (section.candidates.length === 0 && !section.status) {
        continue;
      }
      const header = document.createElement("li");
      header.className = "kp-cmdp-group";
      header.setAttribute("role", "presentation");
      header.textContent = section.title;
      this.listEl.appendChild(header);
      renderedAnything = true;

      if (section.candidates.length === 0 && section.status) {
        const status = document.createElement("li");
        status.className = "kp-cmdp-hint";
        status.setAttribute("role", "presentation");
        status.textContent = section.status;
        this.listEl.appendChild(status);
        continue;
      }

      for (const candidate of section.candidates) {
        const index = this.candidates.length;
        const option = document.createElement("li");
        option.className = "kp-cmdp-option";
        option.id = `kp-cmdp-opt-${index}`;
        option.setAttribute("role", "option");
        const label = document.createElement("div");
        label.className = "kp-cmdp-option__label";
        label.textContent = candidate.label;
        option.appendChild(label);
        if (candidate.subLabel) {
          const sub = document.createElement("div");
          sub.className = "kp-cmdp-option__sub";
          sub.textContent = candidate.subLabel;
          option.appendChild(sub);
        }
        option.addEventListener("mousemove", () => {
          if (this.selectedIndex !== index) {
            this.selectedIndex = index;
            this.applySelection();
          }
        });
        option.addEventListener("click", () => this.run(candidate));
        this.listEl.appendChild(option);
        this.candidates.push(candidate);
        this.optionEls.push(option);
      }
    }

    if (!renderedAnything) {
      const empty = document.createElement("li");
      empty.className = "kp-cmdp-empty";
      empty.setAttribute("role", "presentation");
      empty.textContent = MESSAGES.noResults;
      this.listEl.appendChild(empty);
    }

    if (this.selectedIndex >= this.candidates.length) {
      this.selectedIndex = 0;
    }
    this.applySelection();
  }

  private applySelection(): void {
    this.optionEls.forEach((el, i) => {
      if (i === this.selectedIndex) {
        el.classList.add("kp-cmdp-selected");
        el.setAttribute("aria-selected", "true");
      } else {
        el.classList.remove("kp-cmdp-selected");
        el.removeAttribute("aria-selected");
      }
    });
    const selected = this.optionEls[this.selectedIndex];
    if (selected) {
      this.input.setAttribute("aria-activedescendant", selected.id);
    } else {
      this.input.removeAttribute("aria-activedescendant");
    }
  }
}
