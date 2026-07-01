import { KintoneRestAPIClient } from "@kintone/rest-api-client";
import themeCss from "./theme.css?raw";
import { DEFAULT_SETTINGS, parseConfig, serializeConfig } from "../core/config";
import type { Settings, ShortcutKey } from "../core/types";

// Settings screen (section 5, CF-1..CF-6). Values are stored as one JSON string
// under the "config" key. Record search target fields are limited to text-like
// types read from the form fields API.

const TITLE = "コマンドパレット設定";
const LEAD = "Ctrl+K でアプリ・ビュー・レコードを検索するコマンドパレットを追加します。";

const TEXT_FIELD_TYPES = new Set(["SINGLE_LINE_TEXT", "MULTI_LINE_TEXT", "LINK"]);
const SELECT_COUNT = 3;
const UNSELECTED = "";

const SHORTCUT_CHOICES: { value: ShortcutKey; label: string; desc?: string }[] = [
  { value: "ctrl-k", label: "Ctrl+K（Mac: ⌘K）" },
  {
    value: "ctrl-shift-k",
    label: "Ctrl+Shift+K（Mac: ⌘⇧K）",
    desc: "Firefox では開発ツールが優先されるため、Firefox 利用者には Ctrl+K を推奨します",
  },
  {
    value: "disabled",
    label: "無効",
    desc: "ブラウザや他のツールとキーが衝突する場合に選択してください",
  },
];

interface FieldOption {
  code: string;
  label: string;
}

function injectStyles(): void {
  const style = document.createElement("style");
  style.textContent = themeCss;
  document.head.appendChild(style);
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}

function pluginId(): string {
  return kintone.$PLUGIN_ID ?? "";
}

function loadSettings(): Settings {
  const raw = kintone.plugin.app.getConfig(pluginId());
  return parseConfig(raw ? raw.config : undefined) ?? { ...DEFAULT_SETTINGS };
}

async function loadFields(): Promise<FieldOption[]> {
  const appId = kintone.app.getId();
  if (appId == null) return [];
  const client = new KintoneRestAPIClient();
  const res = await client.app.getFormFields({ app: appId, preview: true });
  const options: FieldOption[] = [];
  for (const property of Object.values(res.properties)) {
    if (TEXT_FIELD_TYPES.has(property.type)) {
      options.push({ code: property.code, label: property.label });
    }
  }
  options.sort((a, b) => a.label.localeCompare(b.label, "ja"));
  return options;
}

function main(): void {
  injectStyles();
  const settings = loadSettings();

  document.body.className = "kp-cmdp-config";
  const inner = el("div", "kp-cmdp-config__inner");
  document.body.appendChild(inner);

  const h1 = el("h1");
  h1.textContent = TITLE;
  const lead = el("p", "kp-cmdp-config__lead");
  lead.textContent = LEAD;
  inner.appendChild(h1);
  inner.appendChild(lead);

  // --- Shortcut card --------------------------------------------------------
  const shortcutCard = el("div", "kp-cmdp-card");
  const shortcutTitle = el("div", "kp-cmdp-card__title");
  shortcutTitle.textContent = "ショートカットキー";
  shortcutCard.appendChild(shortcutTitle);
  for (const choice of SHORTCUT_CHOICES) {
    const row = el("label", "kp-cmdp-radio");
    const input = el("input");
    input.type = "radio";
    input.name = "kp-cmdp-shortcut";
    input.value = choice.value;
    input.checked = settings.shortcut === choice.value;
    const body = el("span", "kp-cmdp-radio__body");
    const label = el("span");
    label.textContent = choice.label;
    body.appendChild(label);
    if (choice.desc) {
      const desc = el("span", "kp-cmdp-radio__desc");
      desc.textContent = choice.desc;
      body.appendChild(desc);
    }
    row.appendChild(input);
    row.appendChild(body);
    shortcutCard.appendChild(row);
  }
  inner.appendChild(shortcutCard);

  // --- Sources card ---------------------------------------------------------
  const sourcesCard = el("div", "kp-cmdp-card");
  const sourcesTitle = el("div", "kp-cmdp-card__title");
  sourcesTitle.textContent = "検索対象";
  sourcesCard.appendChild(sourcesTitle);

  const checkbox = (
    name: string,
    labelText: string,
    descText: string,
    checked: boolean,
  ): { row: HTMLElement; input: HTMLInputElement } => {
    const row = el("label", "kp-cmdp-check");
    const input = el("input");
    input.type = "checkbox";
    input.name = name;
    input.checked = checked;
    const body = el("span", "kp-cmdp-check__body");
    const label = el("span");
    label.textContent = labelText;
    body.appendChild(label);
    if (descText) {
      const desc = el("span", "kp-cmdp-radio__desc");
      desc.textContent = descText;
      body.appendChild(desc);
    }
    row.appendChild(input);
    row.appendChild(body);
    return { row, input };
  };

  const apps = checkbox(
    "kp-cmdp-apps",
    "アプリ検索を有効にする",
    "参加しているスペースのアプリ一覧から検索します",
    settings.sources.apps,
  );
  const views = checkbox("kp-cmdp-views", "ビュー切替を有効にする", "", settings.sources.views);
  const records = checkbox(
    "kp-cmdp-records",
    "レコード検索を有効にする",
    "対象フィールド（最大3つ。文字列1行・文字列複数行・リンクのみ選択できます）",
    settings.sources.records,
  );
  const actions = checkbox(
    "kp-cmdp-actions",
    "アクションを有効にする",
    "新規作成・アプリ設定などの固定コマンドです",
    settings.sources.actions,
  );

  sourcesCard.appendChild(apps.row);
  sourcesCard.appendChild(views.row);
  sourcesCard.appendChild(records.row);

  // Field selects live under the records checkbox.
  const selectsWrap = el("div", "kp-cmdp-field");
  const selectsRow = el("div", "kp-cmdp-selects");
  const selects: HTMLSelectElement[] = [];
  const selectWarnings: HTMLDivElement[] = [];
  for (let i = 0; i < SELECT_COUNT; i += 1) {
    const select = el("select", "kp-cmdp-select");
    select.setAttribute("aria-label", `レコード検索の対象フィールド ${i + 1}`);
    selects.push(select);
    selectsRow.appendChild(select);
    const warn = el("div", "kp-cmdp-error");
    warn.style.display = "none";
    selectWarnings.push(warn);
  }
  selectsWrap.appendChild(selectsRow);
  for (const warn of selectWarnings) selectsWrap.appendChild(warn);
  const recordsError = el("div", "kp-cmdp-error");
  recordsError.style.display = "none";
  selectsWrap.appendChild(recordsError);
  sourcesCard.appendChild(selectsWrap);

  sourcesCard.appendChild(actions.row);
  inner.appendChild(sourcesCard);

  // Populate selects once fields are loaded.
  loadFields()
    .then((fields) => {
      const known = new Set(fields.map((f) => f.code));
      selects.forEach((select, i) => {
        select.textContent = "";
        const empty = el("option");
        empty.value = UNSELECTED;
        empty.textContent = "（未選択）";
        select.appendChild(empty);
        for (const field of fields) {
          const option = el("option");
          option.value = field.code;
          option.textContent = `${field.label}（${field.code}）`;
          select.appendChild(option);
        }
        const saved = settings.recordSearchFields[i];
        if (saved && known.has(saved)) {
          select.value = saved;
        } else if (saved && !known.has(saved)) {
          select.value = UNSELECTED;
          const warn = selectWarnings[i];
          warn.textContent = `フィールド ${saved} は存在しないか対象外の型に変更されています。選び直してください`;
          warn.style.display = "block";
        }
      });
    })
    .catch(() => {
      recordsError.textContent =
        "フィールド一覧を取得できませんでした。時間をおいて開き直してください";
      recordsError.style.display = "block";
    });

  // --- Save bar -------------------------------------------------------------
  const bar = el("div", "kp-cmdp-bar");
  const cancel = el("button", "kp-cmdp-btn-text");
  cancel.type = "button";
  cancel.textContent = "キャンセル";
  cancel.addEventListener("click", () => {
    history.back();
  });
  const save = el("button", "kp-cmdp-btn-primary");
  save.type = "button";
  save.textContent = "保存する";
  save.addEventListener("click", () => onSave());
  bar.appendChild(cancel);
  bar.appendChild(save);
  inner.appendChild(bar);

  function selectedShortcut(): ShortcutKey {
    const checked = document.querySelector<HTMLInputElement>(
      'input[name="kp-cmdp-shortcut"]:checked',
    );
    return (checked?.value as ShortcutKey) ?? "ctrl-k";
  }

  function onSave(): void {
    for (const warn of selectWarnings) warn.style.display = "none";
    recordsError.style.display = "none";

    const chosen = selects.map((s) => s.value).filter((v) => v !== UNSELECTED);
    const recordsOn = records.input.checked;

    if (new Set(chosen).size !== chosen.length) {
      recordsError.textContent = "同じフィールドが複数選択されています。重複を解消してください";
      recordsError.style.display = "block";
      return;
    }
    if (recordsOn && chosen.length === 0) {
      recordsError.textContent =
        "レコード検索を有効にする場合は、対象フィールドを1つ以上選択してください";
      recordsError.style.display = "block";
      return;
    }

    const next: Settings = {
      shortcut: selectedShortcut(),
      sources: {
        apps: apps.input.checked,
        views: views.input.checked,
        records: recordsOn,
        actions: actions.input.checked,
      },
      recordSearchFields: chosen,
    };
    kintone.plugin.app.setConfig({ config: serializeConfig(next) });
  }
}

main();
