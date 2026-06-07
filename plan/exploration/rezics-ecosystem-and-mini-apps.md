---
title: Folio 獨立發行與 rezics mini-app 生態
status: draft
created: 2026-06-07
completed:
supersededBy:
tags: [folio, desktop, electron, pwa, mini-app, app, architecture, exploration]
---

## Why

兩個起始問題：
1. rezics 構想的「桌面端 + 一堆類小程序」生態能不能做到？
2. folio 閱讀器要能獨立發行（web app / PWA），該怎麼組織？

探索過程中模型被修正了兩次，最終收斂成一個比原問題大得多、但更乾淨的架構。
本文記錄收斂後的模型與待啃的點，**是 draft 思考，不是契約**。

## 收斂後的核心模型

rezics 是**一張 feature mesh**；對外發行的每一個「app」都是一個
**composition root**——選 mesh 的一片 + 一套 chrome + 一套 routes + 一個發行目標。
不靠拆 package 實現，靠多個 entry 共用同一張 mesh。

```
            ┌──────── 同一張 feature mesh（不拆 package）────────┐
            │ book-library · game-library · review · shelf ·   │
            │ tag · search · realm · discussion · folio · …    │
            └──┬────────────┬────────────┬───────────────┬─────┘
   composition │            │            │               │
   roots ↓     │            │            │               │
        ┌──────▼───┐ ┌──────▼────┐ ┌─────▼──────┐ ┌──────▼──────┐
        │ 統一 rezics│ │ 書庫 app  │ │ 遊戲庫=Steam │ │ folio-app    │
        │ (全 mesh) │ │(書相關全集)│ │(遊戲相關全集) │ │(葉子+adapter)│
        │ = 最大組合 │ │ 可獨立發行 │ │ 可獨立發行   │ │ 獨立 PWA     │
        └──────────┘ └───────────┘ └────────────┘ └─────────────┘
              ↑ 全是「entry + routes 組合 + chrome」，不是新 package
   desktop = 一個 host：能跑統一 rezics、能跑各庫、能給葉子原生能力
```

### mini-app 有兩種（關鍵區分）

```
Kind 1：葉子 runtime（輕）          Kind 2：庫 / 完整 app（重）
  folio = 讀某本書                    書庫 = 完整的書生態
  遊戲 runtime = 玩某個遊戲            遊戲庫 = Steam（完整遊戲生態）
  沙箱、跨 host、碰本地檔案            完整關聯 feature 全在裡面
  需要能力協商 + 權限協議             它「就是」平台，自己人不協商
  可獨立發行成 PWA                    可獨立發行成一個完整 app
  ↑ 被庫啟動                          ↓ 啟動葉子
```

遞迴關係（之前最容易看漏的一點）：

```
   書庫 (Kind 2) ──啟動──▶ folio (Kind 1)            讀書
   遊戲庫=Steam (Kind 2) ──啟動──▶ 遊戲 runtime (Kind 1)  玩遊戲

   folio 之於書庫  ==  跑起來的遊戲之於 Steam
```

folio 不是「書庫的一個 feature」，是**書庫啟動的閱讀 runtime**；
正如跑起來的遊戲不是 Steam 的 feature，是 Steam 啟動的東西。

### desktop 的定位

desktop = rezics 的桌面端（Electron），性質同 Notion/Discord 桌面版——把整個
rezics 裝進桌面殼。**它不是 meta-platform，也不是 Steam**；真正的 Steam 是
「遊戲庫」這個 Kind 2 mini-app。desktop 額外做的是：(a) 用自己的 routes/chrome
重排頂層呈現、(b) 透過 preload bridge 給葉子 runtime 原生能力。

## 平台決策（已拍板）

- **走 Electron（桌面）+ PWA（含行動端），不做 Tauri。**
  理由：Electron 自帶 Chromium + 完整 Node，原生模組/IPC/生態成熟度更適合大型
  super-app 殼；Tauri 的 Rust IPC/plugin 對重殼是約束。
- **代價（睜眼接受）**：砍 Tauri = 行動端只剩 PWA。iOS PWA 的離線儲存會被系統
  回收、且不易上架。對「隨開隨讀、雲端進度為準」沒問題；對「離線書架長期駐留」
  是硬傷。暫不解，記著。
- **獨立發行的 package 命名為 `folio-app`**（folio 就是 reader 的名字，不另造
  `@rezics/reader`）。folio-app 是第一個 Kind 1 葉子的獨立發行載體。

```
@rezics/folio       閱讀器「組件」(能力)      ← 已存在，不動
@rezics/folio-app   閱讀器「應用」(葉子載體)   ← 新建，depend on folio
@rezics/app         統一 rezics（最大 composition root，web host）
@rezics/desktop     Electron 殼（host）       ← 新建
```

## 為什麼這條路可行：薄路由層是現成的縫

grep 證據（`package/app/src`）：

```
routes/_mainLayout/book/$bookId/route.tsx → import("@/book-library")
```

`routes/` 只是「URL → feature page」的接線，feature 自己不定義路由。
→ 一個「app / 庫」= 一套 routes 組合 + chrome + entry，全 import 同一張 mesh。
→ 多 composition root 共用 mesh 在機制上成立，**無需拆 package**。

反面證據同樣重要：book-library 對外伸手到 ~10 個 sibling feature
（search/review/shelf/tag/realm/discussion/engagement/user/remark/progress-status…），
sections 內直接 `useParams({bookId})` / `useNavigate`。
→ **這張「密網」不是要切斷的耦合，而是「完整生態」的本體**。書庫之所以完整，
正因為它包含這些關聯 feature。試圖把 book-library 抽成獨立 package 是錯的方向。

## 權限 / 授權 / 協議：只在葉子邊界

協商只發生在**跨沙箱的葉子邊界**（Kind 1 ↔ host）。庫內部的 feature 之間
（Kind 2 自己人）共用同一 auth/session，不需要能力協商。

```
   庫內部（Kind 2 feature 之間）           葉子邊界（Kind 1 ↔ host）
   ──────────────────────              ──────────────────────
   書庫 ↔ review ↔ shelf ↔ tag          書庫 ──啟動──▶ folio
   同 auth、同 session                   folio 問 host：能讀本地檔案?能綁定?能拿書架?
   ❌ 不需要能力協商                       ✅ 這裡才需要協商
```

葉子協議是**兩條正交的閘**（不可混為一談）：

```
mini-app 呼叫能力 (e.g. fs.bindLocalFile)
   ├─ Gate 1：HOST 能力天花板（環境決定、靜態）
   │     bare PWA < web+auth < desktop(Electron)
   │     ❌→ 降級 / 不可用
   └─ Gate 2：USER 授權（用戶同意、動態、可撤銷）
         「允許存取書架」「綁定這個檔案」
         ❌→ 拒絕 / 引導授權
   ▼ granted handle | degraded fallback | denied
```

能力是「協商」不是「布林」（PWA 檔案能力本就殘缺）：

```
能力                       bare PWA              web+auth   desktop(Electron)
本地檔案選取(picker)        ✓Chromium / ✗Safari    同左       ✓ 完整
本地檔案「綁定」持久化       △ FS Access API 殘缺    △         ✓ 真實路徑+SQLite
讀 user 書架                ✗ 無 auth              ✓         ✓
rezics:// 協議處理          ✗                     △ web 內    ✓ OS 級註冊
進度同步                   只本地                 雲端        雲端+本地
```

mini-app 程式碼只認 port 介面、問 host 實際 runtime → 一份碼、三種 host、優雅降級。
這是「PWA 能力不完整」的正解：不是寫兩份，是寫一份 + 能力協商 + 降級。

## 待啃 / spikes（尚未決定）

1. **composition root 機制**：一張 mesh 怎麼長出 N 個可獨立發行的 entry？
   - Vite 多 entry / 多 route tree 的具體形狀
   - 各 app build 如何 tree-shake 到只含自己那片 feature
   - desktop 如何把這些 composition root 收進自己的 routes/chrome
   - 「app / 庫」要不要一個顯式 manifest（id/icon/route 片/chrome）作為註冊單位
2. **folio-app 作為第一個葉子**（最小可交付）：
   - 先當純 PWA 跑通（本地 epub + localStorage 進度），完全不碰 Electron
   - adapter 注入點：`SourceProvider` / `ProgressStore` 兩個 port 起步
   - 跑通即證明 adapter 邊界正確；之後 desktop 只是再加一個 host + bridge 實作
3. **葉子宿主協議**：preload bridge 的 TS interface 形狀（只定形狀、先不寫實作），
   Gate 1 / Gate 2 的落地點。
4. **session 共享**：跨 composition root / 跨 host 的 auth/主題/進度同步。
   app 已裝 `query-broadcast-client-experimental` + `query-sync-storage-persister`，
   跨分頁同步有底子；跨 host（Electron ↔ web）是否要顯式 bridge 待定。

## 暫不處理

- 主站 `@rezics/app` 直接調用 `@rezics/folio` 組件（非嵌入 folio-app）——形態清楚，
  非當前重點。
- 行動端原生殼（已決定靠 PWA，不做 Tauri）。

## 下一步（若 graduate）

機制成形後，候選的第一份 proposal：
- `folio-app` 最小 PWA 發行（葉子 + 兩個 port adapter），作為整個 mini-app 範式的
  第一塊試金石。

---

_探索態文件。若此方向死掉 → `status: abandoned` 移入 `plan/graveyard/`；
若 graduate → 於 `plan/proposal/` 另開 proposal，本文可廢或留作背景。_
