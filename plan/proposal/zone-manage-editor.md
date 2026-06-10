---
title: Zone 管理編輯器 — JSON tab、ColorField 調色板、圖片 URL 流
status: active
created: 2026-06-10
completed:
supersededBy:
tags: [zone, app, ui, editor, theme, design]
---

## Why

Zone manage 目前只有結構化表單:配置無法整體查看/粘貼/批改;顏色 token 是
裸文本輸入 + 色樣,無取色器無預設;圖片字段靠手貼 unit id(拆表後改 URL,
無上傳入口)。本提案補齊三件:每個信封 draft 的語法高亮 JSON 編輯視圖
(`RezicsJsonEditor` 已存在且 `BookExtraEditor` 在用)、`@rezics/ui` 的
ColorField(react-colorful + hex 輸入 + 自建 palette)、theme 圖片的
上傳出 URL 流。依賴 `zone-shell-page-split.md` 落地後的形態。UI 工作須
加載 `rezics-design` skill。

## Durable constraints & decisions

- JSON 編輯對象是 **draft**(信封去掉 `schema`/`version` 頭),信封頭由
  系統在寫入邊界加——版本政策的執行權不交給人手。(comment + test)
- 同一 draft 雙視圖同步:JSON 視圖與結構化表單編輯同一份 draft;JSON 暫時
  非法(parse/校驗失敗)時**鎖結構化視圖**,直到修復或撤銷,防止半壞狀態
  互相覆蓋。(comment + test)
- 客戶端校驗即契約校驗:typebox 同構,保存前 `Value.Check` 對應信封
  schema,錯誤餵 CodeMirror lint 行內展示;服務端校驗仍是最終權威。
  (comment)
- ColorField 取色面板用 react-colorful(2.8KB、零依賴、`.react-colorful__*`
  類 UnoCSS 覆寫,與 Base UI 棧無依賴交集);**palette 層(預設色塊、主題
  套裝)自建**,不引入帶皮膚的庫(@uiw/react-color、react-aria 已排除)。
  (comment → ColorField 組件)
- hex 直接輸入用內建 `HexColorInput`;**保留裸文本輸入逃生口**——zone token
  是任意 CSS 顏色字符串(經 `--zone-color-*` 變量渲染,非設計 token),
  非 hex 值(rgb()/oklch() 等)依然合法,沿襲 `ZoneManageThemeTab` 既有
  「誠實編輯器」立場。(comment + test:非 hex 值可保存)
- theme 圖片上傳復用既有 `uploadApi.uploadImage` provider 出 URL(markdown
  編輯器同款管道),不建 IMAGE unit、不做 IMAGE picker。(comment)
- ColorField 與 palette 屬通用組件,落 `@rezics/ui` 並配 Storybook story,
  不困在 zone feature 內。(type)

## Tasks

## 1. ColorField(@rezics/ui)

- [ ] 1.1 `package/ui` 加依賴 react-colorful;新建
      `src/color/ColorField.tsx`:`HexColorPicker` 面板(popover 內)+
      `HexColorInput` + 裸文本輸入 + 實時色樣;UnoCSS 覆寫
      `.react-colorful__*` 對齊設計 token。
- [ ] 1.2 `src/color/ColorPalette.tsx`:預設色塊網格 + 主題套裝(整組
      token 一鍵應用)的展示與選取;與 ColorField 組合導出。
- [ ] 1.3 Storybook story(`task ui:storybook` 驗證):單色選取、套裝應用、
      非 hex 值輸入三個場景。

## 2. Theme tab 接入(package/app)

- [ ] 2.1 `ZoneManageThemeTab` 顏色字段換 ColorField(含 palette);更新
      組件頭部「誠實編輯器」註釋以反映新形態。
- [ ] 2.2 theme 圖片字段(URL)加上傳按鈕:走
      `createRezicsUploadProvider`/`uploadApi.uploadImage` 得 URL 回填;
      保留手貼 URL。

## 3. JSON 視圖(package/app)

- [ ] 3.1 zone manage 加 JSON 視圖切換:當前編輯面(page sections draft、
      boundary/nav/theme 殼 draft)→ `RezicsJsonEditor`;雙視圖同 draft,
      JSON 非法鎖結構化視圖。
- [ ] 3.2 保存前 `Value.Check` 對應信封 schema(去頭 draft),typebox 錯誤
      映射為 CodeMirror lint diagnostics 行內展示。
- [ ] 3.3 draft 層測試:JSON 視圖往返(serialize → edit → parse)不丟字段、
      非法 JSON 鎖定行為、信封頭不可經 JSON 注入(`schema`/`version` 鍵
      被剝離)。

## Out of scope

- 結構化表單本身的重設計(沿用 zone-shell-page-split 後的 tab 結構)。
- IMAGE unit 作品庫、媒體管理器、圖片裁剪。
- ColorField 在 zone 之外的推廣替換(可後續自然採用)。
- JSON 編輯器的 schema 感知自動補全(lint 行內報錯已夠;補全另議)。
