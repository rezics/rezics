# Foundation Package Publish Plan

把 rezics 的「設計/合約地基」做成可發佈到公開 npm 的包，讓其他 rezics-scope
的 repo 能直接 `npm install` 使用，但**完全不動**現有 monorepo 內「raw TS +
`workspace:*`」的直接導入習慣。

---

## 1. 問題與目標

### 現狀
- 所有 `package/*` 都 `export "./src/index.ts"` (raw TS) + `workspace:*`。
  典型的 Turborepo「internal packages」模式，repo 內零編譯、改完即生效。
- 但這使得包**天生不可發佈**：raw TS 不該丟 npm；`workspace:*` 雖然 publish
  時會自動改寫成版本號，可是若依賴目標本身是 `private`（contract/i18n
  目前都是），改寫後仍然裝不到。

### 目標
1. **保留 monorepo 內 raw TS 直接導入**——dev 端零改動，沒有 build watch。
2. **`@rezics/ui` 必須可發佈到公開 npm**——它是 rezics design 的基礎設施。
3. **發佈出去的包之間不會撞 runtime singleton**——尤其是 i18n locale
   state、contract 的 effect Context、`t()` 之類。
4. **新增的發佈/版本流程不要侵入日常開發**——只在 publish 那一刻發生。

### 非目標
- 不打算發佈 `server` / `auth` / `admin` / `app` / `utils` / `job*` 這類產品
  與內部工具包，這些永遠 `private`。
- 不打算「吃自己狗糧」（admin/app 走 npm 版 ui）——維持 monorepo 內 raw
  source 直連，迭代優先。CI 可加 smoke test 驗證發佈版可裝。

---

## 2. 業界 prior art（簡短）

| 公司 / 庫 | 規模 | 模式 |
|---|---|---|
| Shopify Polaris | 3 包 | 一個 monorepo 發 `polaris` / `polaris-tokens` / `polaris-icons`，被另外的 admin/merchant repo 用 |
| Stripe (`stripe-js`, `react-stripe-js`) | 2-3 包 | 小規模、嚴格 peerDep |
| MUI | 幾十包 | 兄弟之間嚴格 externalize，型別/runtime 同一份 |
| Vercel `next.js` repo | 10+ 包 | 內部 raw TS、外部走編譯，同 repo 共存——跟我們要做的事 1:1 |

**全業界都做的 7 件事**：編譯後才上 npm；發佈兄弟之間 externalize；
react/react-dom 走 peerDep；CI 自動 publish；版本協調工具；
「平台層發佈 / 產品層私有」兩層拆分；平台層內部 dev 還是 raw source。

我們的決策完全照搬這條路線，**沒有捷徑可走**。

---

## 3. 決策：發佈哪幾個包

| 包 | 動作 | 理由 |
|---|---|---|
| `@rezics/ui` | **發佈** | 入口目標包，rezics design 基礎設施 |
| `@rezics/contract` | **發佈**（拿掉 `private`） | ui 內 8 處 runtime + 型別使用；contract 是「合約」，多 repo 必須共享同一份 runtime（effect Context 不能分裂） |
| `@rezics/i18n` | **發佈**（拿掉 `private`） | i18n 有「當前 locale」runtime 狀態；inline 進 ui 會跟 consumer 自己的 i18n 完全隔離，切語言不會同步 |
| `@rezics/editor` | 暫**不發**，inline 進 ui | ui 內只 re-export `type ViewMode` + 4 處 runtime，無 cross-instance state，inline 安全。未來若 consumer 直接要 editor 再升級為發佈。 |
| `@rezics/api` | 暫**不發** | 用戶說「除了 ui，其他都 optional」。若未來其他 repo 要呼叫同 server，再升級。 |
| `@rezics/storybook-config` | **保留 private**，從 ui 的 `dependencies` 改到 `devDependencies` | 純 dev 工具，不該進 runtime |
| 其他全部 | 維持 `private` | 產品代碼、內部工具，不發 |

**起手集合：3 個包**（ui / contract / i18n）。

---

## 4. 架構：dev vs publish 兩面

```
            ┌──────── monorepo dev 端（零改動）────────┐
            │  exports → "./src/index.ts"  (raw TS)    │
            │  deps    → "workspace:*"                 │
            │  bun run dev / vite 直接吃 source         │
            └───────────────────┬──────────────────────┘
                                │ bun publish + changesets
                                ▼
   ┌──────── 公開 npm（地基層 3 包）─────────────┐
   │                                            │
   │   @rezics/contract  ──┐                    │
   │   @rezics/i18n      ──┤ 兄弟互相 externalize│
   │   @rezics/ui        ──┘ workspace:* → ^x.y.z│
   │      └─ editor / storybook-config 不發      │
   │         editor → ui 的 build inline       │
   │         storybook-config → devDep         │
   │                                            │
   │  publishConfig.exports → dist/*.js + *.d.ts│
   │  peerDeps: react, react-dom                │
   └────────────────────────────────────────────┘
                                │
                                ▼
   ┌──────── 其他 rezics-scope repo ────────┐
   │  npm install @rezics/ui                │
   │    自動帶 @rezics/contract, @rezics/i18n│
   │    react 自己提供                       │
   └────────────────────────────────────────┘
```

---

## 5. 要改什麼（具體變更清單）

### 5.1 `package/contract`
- [ ] 從 `package.json` 移除 `"private": true`。
- [ ] 先過一遍 `src/index.ts` 公開 API，標記任何不該對外的 internal helper。
- [ ] 新增 `tsup.config.ts` (見 §6.2)。
- [ ] `package.json` 新增 `publishConfig` 雙導出區塊 (見 §6.1)。
- [ ] 新增 `"build": "tsup"`、`"prepublishOnly": "bun run build"` scripts。
- [ ] `.gitignore` / `.npmignore`：忽略 `dist/`；發佈時 `files: ["dist"]`。

### 5.2 `package/i18n`
- [ ] 從 `package.json` 移除 `"private": true`。
- [ ] 確認 paraglide compile 在 `prepublishOnly` 中先跑：`"prepublishOnly": "bun run compile && bun run build"`。
- [ ] 新增 `tsup.config.ts`，把 `react` 列 external、`@rezics/contract` 列 external。
- [ ] paraglide 產物 (`src/paraglide/*.js`、`.d.ts`) 視為 build 來源，build
      後一起進 `dist/`。
- [ ] `publishConfig` 雙導出，`exports` 對齊現有四個入口（`.` / `messages`
      / `runtime` / `react`）。

### 5.3 `package/ui`
- [ ] 保持非 `private`（已是）。
- [ ] `@rezics/storybook-config` 從 `dependencies` 移到 `devDependencies`。
- [ ] `@rezics/contract`、`@rezics/i18n` 留在 `dependencies`（publish 時自動 → `^x.y.z`）。
- [ ] `@rezics/editor` 留在 `dependencies`，但 build 時 `noExternal` 把它打進去。
- [ ] 新增 `tsup.config.ts`：
  - external：所有第三方 npm 依賴 + `@rezics/contract` + `@rezics/i18n`。
  - noExternal：`@rezics/editor`。
  - peer：`react`、`react-dom`。
  - entry 對齊現有 `exports` 列表的每個入口（`.` / `shadcn` / `shadcn/sections`
    / `editor` / `i18n` / `primitive/link`）。
  - CSS 入口 (`config/base.css`) 與 `uno.config.ts` 用 copy 處理，不過 tsup。
- [ ] `publishConfig.exports` 鏡像現有 `exports`，但把每個目標從 `./src/*`
      換成 `./dist/*.js` + 對應 `.d.ts`。
- [ ] i18n 相關 export (`./i18n/messages`、`./i18n/runtime`) 在發佈版直接
      re-export `@rezics/i18n`，**不要**把 paraglide 產物複製進 ui。

### 5.4 根 `package.json`
- [ ] 新增 dev dependency：`@changesets/cli`。
- [ ] 新增 scripts：
  ```jsonc
  {
    "changeset": "changeset",
    "version-packages": "changeset version",
    "release": "bun run build:packages && changeset publish",
    "build:packages": "bun --filter=@rezics/contract --filter=@rezics/i18n --filter=@rezics/ui run build"
  }
  ```
- [ ] 把 `bun run i18n:compile` 已存在的 postinstall 改為也 build：實際上
      `prepublishOnly` 已涵蓋，postinstall 維持原狀即可，避免 dev 端被迫
      build。

### 5.5 Changesets 初始化
- [ ] `bunx changeset init` 建立 `.changeset/config.json`。
- [ ] config 設定：
  - `baseBranch: "dev"`。
  - `access: "public"`。
  - `linked: [["@rezics/ui", "@rezics/contract", "@rezics/i18n"]]`（起步用
    linked，3 包共版號最省心；之後若分裂自然成 independent 再改）。
  - `ignore`: 全部 `private` 包（contract/i18n 拿掉 private 後不要列）。
- [ ] 新增 `.changeset/README.md` 給協作者指引。

### 5.6 CI（新增 workflow）
- [ ] `.github/workflows/release.yml`：
  - 觸發：push 到 `dev`。
  - 步驟：checkout → setup bun → install → 跑 `changesets/action`：
    - 若有未消化的 changeset → 自動開「Version Packages」PR。
    - 若是合併「Version Packages」PR 進來 → 跑 `bun run release` 實際發佈。
  - secrets：`NPM_TOKEN`（npm automation token）、`GITHUB_TOKEN`。
- [ ] Smoke test workflow（可選，後續加）：發佈成功後在 sandbox 跑
      `npm install @rezics/ui` + 一個極簡 import 測試。

### 5.7 文件
- [ ] `AGENTS.md` 新增「發佈流程」段：寫 changeset → 合 Version Packages
      PR → CI 自動 publish 三步。
- [ ] `package/ui/README.md`、`package/contract/README.md`、`package/i18n/README.md`
      補上 install / 基本 usage，因為要對外。

---

## 6. 共用機制細節

### 6.1 `publishConfig` 雙導出模式

每個發佈包都長這樣（以 contract 為例）：

```jsonc
{
  "name": "@rezics/contract",
  "version": "0.1.0",
  "type": "module",
  // ↓ dev 端：repo 內 import 走 raw TS
  "exports": {
    ".": { "types": "./src/index.ts", "default": "./src/index.ts" }
  },
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  // ↓ publish 端：bun publish 時這塊會覆蓋上面
  "publishConfig": {
    "exports": {
      ".": {
        "types": "./dist/index.d.ts",
        "import": "./dist/index.js"
      }
    },
    "main": "./dist/index.js",
    "types": "./dist/index.d.ts",
    "access": "public"
  },
  "files": ["dist", "README.md"],
  "scripts": {
    "build": "tsup",
    "prepublishOnly": "bun run build"
  }
}
```

**關鍵**：`publishConfig` 是 npm/bun 標準特性，`publish` 時把頂層欄位**整段
取代**。所以「dev 指 src、發佈指 dist」可以同包共存，互不干擾。

### 6.2 tsup 配置模板

```ts
// package/contract/tsup.config.ts
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/language-core.ts", "src/reaction/index.ts"],
  format: ["esm"],
  dts: true,                  // d.ts bundle 一併產出，型別 leak 自動處理
  clean: true,
  sourcemap: true,
  target: "es2022",
  treeshake: true,
  external: [/^@rezics\//, "react", "react-dom"], // 兄弟發佈包與 peer 一律 external
});
```

`ui` 的 tsup config 多一條 `noExternal: ["@rezics/editor"]`，把 editor 整個
打進 ui bundle。

### 6.3 版本協調：changesets

- 改了某包後：`bun changeset` → CLI 問你動了哪些包、bump 等級 (patch/minor/major)
  → 寫一句變更說明 → 存成 `.changeset/*.md` commit 進去。
- changesets 自動偵測：若 contract bump，依賴 contract 的 ui 也會在「Version
  Packages」PR 中被 bump（linked 策略下 3 個包共版本）。
- 合併 Version Packages PR → CI 自動 `changeset publish`。

### 6.4 兄弟之間的 `workspace:*`

publish 時 bun/pnpm 自動把 `"@rezics/contract": "workspace:*"` 改寫成
`"@rezics/contract": "^x.y.z"`。**不需要手動處理**，這是 workspace 協議的
標準行為。

---

## 7. 風險與邊界

| 風險 | 緩解 |
|---|---|
| ui 的公開 `.d.ts` 漏出 contract / editor 的 internal 型別 | tsup `--dts` 預設 bundle d.ts；publish 前用 `attw`（Are The Types Wrong）跑一次驗證 |
| editor inline 進 ui，未來 consumer 也想直接用 editor | 升級 editor 為發佈包，ui 的 noExternal 移除 editor，發 ui 新 minor。one-way migration，可控 |
| contract 公開後內部 API 變動就是 breaking change | 引入「公開 API surface」概念：發佈前過一遍 `index.ts` 公開出口；CI 用 `api-extractor` 或 `arethetypeswrong` 偵測 surface 變化 |
| paraglide 產物 commit 進 repo vs build 時生成 | i18n 的 `prepublishOnly` 先跑 `compile` 再 `build`；CI 也跑 compile；產物不需 commit |
| storybook-config 仍被 ui devDep 引用，外部安裝 ui 時不會帶（OK）| 確認移到 `devDependencies` 後 storybook 仍能在 monorepo 內跑（dev 環境 `workspace:*` 仍可解析） |
| 多 repo 拿 ui 時版本漂移 | changesets 強制每次變更都寫 changeset；CI 加 `changeset status` 檢查 PR 必須帶 changeset |
| CSS / UnoCSS preset 對外散播 | `ui/config/base.css` 和 `uno.config.ts` 用 tsup `publicDir` 或單獨 copy script 進 dist；README 明確說明 consumer 需要的 unocss preset 整合方式 |

---

## 8. 階段性 rollout

```
階段 0：先準備，不動公開狀態
  ├── 引入 tsup + 三個包的 tsup.config（但維持 private）
  ├── 跑通 `bun run build:packages`，驗證 dist 產物可被 node 直接 import
  └── attw 跑通，確認 d.ts 沒有 leak

階段 1：接 changesets，但不發
  ├── 初始化 changesets，配 linked
  ├── 寫第一個 changeset，跑 `changeset version` 看 PR 長相
  └── 確認 workspace:* 改寫行為符合預期

階段 2：第一次 publish
  ├── contract / i18n 移除 private
  ├── CI release.yml 上線
  ├── 手動觸發第一次 publish 到 npm（0.1.0 → 0.1.1 試水）
  └── 在 sandbox repo `npm install @rezics/ui` 驗證

階段 3：對外宣告 + 補文件
  ├── README、AGENTS.md 更新
  └── 通知其他 rezics-scope repo 可以開始用

階段 4（未來）：依需求擴包
  └── editor / api 任一被外部要 → 升級為發佈包，重複階段 0-3
```

---

## 9. 開放議題（之後決）

- 版號從 `0.1.0` 起手還是 `0.0.1`？三包是否一律 fixed 同號？
- 是否引入 `arethetypeswrong` 與 `publint` 加入 prepublish 檢查？
- React 19 在 peerDep 範圍寫 `^19` 還是 `>=18 <20`？
- changesets 的 `commit` 模式（自動 commit version 變更 vs PR-only）？
- 是否設一個 `canary` channel（在 PR 上自動發 `0.0.0-pr-123-{sha}` 預覽版）？
- 文件站點：要不要單獨開 storybook static deploy 給對外 consumer 看？

---

## 10. 下一步

如果這份計畫方向 OK，下一步是：

1. 把這份 plan 升級成正式 OpenSpec change（`publish-foundation-packages`），
   產出 `proposal.md` / `design.md` / `tasks.md`，把上面 §5 的清單變成
   trackable tasks。
2. 階段 0 開工：引入 tsup、寫三份 tsup config、跑通 build。

階段 0 是純加法，不破壞任何現有行為——可以早動。
