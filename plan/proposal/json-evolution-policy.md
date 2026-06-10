---
title: JSON 演進政策 — 信封、兼容紀律與遷移機制
status: active
created: 2026-06-10
completed:
supersededBy:
tags: [contract, schema, versioning, migration, convention, tool]
---

## Why

全倉 35+ 個 jsonb 列中只有兩個信封家族(`rezics/zone-config`、`rezics.content`),
其餘列大多連 contract schema 都沒有。生產化後存儲 JSON 的演進將不可避免,而
「怎麼演進」必須在第一次破壞性變更發生**之前**成為代碼裡可執行的政策。本提案
把 `plan/exploration/json-evolution-and-zone-split.md` 收斂的策略落進代碼:
信封基礎設施、convention 檢查、回填工具骨架與政策註釋。開發階段無舊數據負擔,
全部乾淨落地。

## Durable constraints & decisions

- 三類劃分:**信封類**(配置/文檔,自描述 `{schema, version, ...}` + 升級鏈)、
  **兼容類**(extra/普通 JSON,無信封,`@compat additive-only` 加性紀律)、
  **豁免**(外部標準格式:JWK、OAuth client metadata;通用 KV)。分類軸是
  後端是否消費與演進預期,**表大小不參與設計決策**。(comment → envelope 模塊
  JSDoc;check 規則本身是政策的執行態)
- 信封類唯一策略:升級鏈常駐 + 讀歸一化 + 寫落最新 + 退役版本前必跑回填
  (K8s「無限期依賴」教訓)。發佈時間線:上線 vN+1 與升級鏈 → 窗口期混版本
  共存 → 回填 → 驗證存量歸零 → 下版刪 vN。(comment)
- **純變換約束**:升級函數不查庫、不做 IO、不依賴環境;同一個純函數兼任
  讀歸一化、回填腳本體、客戶端轉換器三個角色。做不到純 = 變更必須拆成兩步
  加性演進。(comment + test:升級函數簽名不接受任何 context 參數)
- **trust-on-read**:寫路徑嚴格校驗最新版(`additionalProperties: false`);
  讀路徑只按 `version` 判別字段分發,不跑全量 `Value.Check`;完整讀校驗僅
  開發模式啟用。(comment + test)
- **禁止讀路徑寫回**(讀副本/冪等/驚群/updatedAt 污染)與**禁止庫內原地
  修改**(`jsonb_set` 等;所有寫走 parse → upgrade → mutate → validate →
  persist)。(comment + check 規則)
- **版本只在 parse 邊界存在**:出了 `parseXxx` 業務代碼只見最新類型,絕不在
  service 層按版本分發業務邏輯。(comment,現 `upgrade.ts` 已表述,遷入通用
  模塊後保留)
- 後端不消費的信封列(content doc)升級鏈跑在前端;鏈長進 bundle,回填→退役
  同時瘦身。(comment → doc-v1.ts)
- 兼容類破壞性重構的退路:「無 version ≡ v1」,從 v2 起加裝信封,零提前
  成本(MongoDB 慣例)。(comment → envelope 模塊 JSDoc)
- 高成本數據搬遷不進 Drizzle migration:schema migration 仍是事實源必須跑;
  移出去的是可重跑/可觀測/可限速的 backfill 與 stream task(下游投影用
  `HistoryOutbox`)。小且固定的 DML 可留在 migration。(comment → 回填工具
  入口 JSDoc)
- 開發階段現狀不變:校驗失敗 → factory reseed;升級鏈空轉(破壞性變更直接改
  v1 + reseed)。版本紀律從不能 reseed 那一刻計息。(comment)
- IMAGE unit 語義:服務於作為目錄作品的藝術圖像(pixiv 式:歸屬、標籤、
  討論);普通/裝飾性圖片一律純 URL 字符串。(comment → db schema 與 contract
  的 UnitType)

## Tasks

## 1. 信封基礎設施(@rezics/contract)

- [ ] 1.1 新建 `package/contract/src/envelope/envelope.ts`:自描述信封的通用
      類型與輔助(schema/version 字面量類型、升級鏈簽名、判別字段分發的
      parse 工廠,含 dev-only 全量校驗開關)。模塊 JSDoc(雙語)承載三類劃分、
      發佈時間線、純變換約束、absence-as-v1 退路。
- [ ] 1.2 用 1.1 重表述 `package/contract/src/zone/upgrade.ts`(行為不變,
      讀路徑改判別分發 + dev 全量校驗);`content/doc-v1.ts` 加註釋引用
      envelope 模塊並標明「客戶端轉換」定位。
- [ ] 1.3 測試:升級鏈純度(類型層面簽名鎖定)+ trust-on-read 行為(舊版本
      進判別分發、未知 version 拒絕、dev 模式全量校驗生效)。

## 2. convention 檢查(tool)

- [ ] 2.1 `tool/src/commands/convention/rules/` 新增 jsonb 列三分規則:掃描
      `package/server/src/db/schema/*` 與 auth schema 的 jsonb 列,要求
      (a) 對應 contract schema 為帶 `schema`+`version` 字面量的 union,或
      (b) schema JSDoc 帶 `@compat additive-only` 標記,或 (c) 列入規則內
      顯式豁免清單(附理由)。初始豁免:`Jwks.publicJwk/privateJwk`(server
      與 auth)、auth `OAuthClient.metadata`、`EchoKV.value`。
- [ ] 2.2 同規則組加 `jsonb_set` 等庫內 JSON 原地修改的禁用檢查
      (server src 範圍 grep 級即可)。
- [ ] 2.3 過渡:現存未補課列暫掛規則內 TODO 清單(指向
      `plan/proposal/compat-schema-audit.md`),逐列銷賬,新增列即刻受檢。

## 3. 回填工具骨架(tool)

- [ ] 3.1 `tool/src/commands/backfill/` CLI 骨架:按信封 schema 名 + 目標
      版本,穩定 cursor 分批、每批提交、進度記錄、限速參數、可中斷重跑;
      復用 contract 升級鏈做變換體。入口 JSDoc 承載
      migration/backfill/stream-task 切分政策(exploration「切分」一節)。
- [ ] 3.2 根 `Taskfile.yml` 暴露 `task backfill`;驗證查詢(按 version 統計
      存量)作為子命令。

## 4. 政策註釋落點

- [ ] 4.1 `package/server/src/db/schema/columns.ts` 的 `jsonData()` JSDoc:
      三類劃分一句話 + 指向 envelope 模塊與 convention 規則。
- [ ] 4.2 `package/server/src/db/schema/unit.ts` UnitType 枚舉與
      `package/contract/src/unit/unit.ts`:IMAGE unit 藝術作品語義 vs 普通
      圖片純 URL(雙語 JSDoc)。

## Out of scope

- 兼容類六條紀律的定稿與 30 個無 schema 列的逐列補課
  (`compat-schema-audit.md`)。
- zone 的拆表與信封重構(`zone-shell-page-split.md`)。
- 真實的 v2 升級函數(尚無破壞性變更;開發期走 reseed)。
- 讀路徑緩存、TypeCompiler 預編譯等性能優化(trust-on-read 已消除主要成本)。
