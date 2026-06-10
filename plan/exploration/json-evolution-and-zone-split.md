---
title: JSON 演進策略與 Zone 拆分
status: draft
created: 2026-06-10
completed:
supersededBy:
tags: [contract, schema, versioning, migration, zone, page, editor, ui, theme]
---

## 背景

Zone 剛完成信封化重建(`rezics/zone-config` v1,单一 `Zone.config` jsonb 列,
commit 7dd83dda8 起三連)。本探索回答四個問題:

1. 存儲 JSON 的長期演進策略(版本、遷移、兼容)應當是什麼?
2. 全倉 35+ 個 jsonb 列(絕大多數無 contract schema、無信封)如何治理?
3. Zone 怎麼拆?zone page 的本體是什麼?
4. Zone 管理編輯器(JSON 編輯、調色板、圖片)怎麼做?

結論已收斂,review 通過後拆成四份 proposal(見文末)。

## 行業案例(長壽系統如何處理存儲數據演進)

| 系統 | 機制 | 對我們的教訓 |
|---|---|---|
| Kubernetes | hub-and-spoke:所有版本進內存先轉 hub 版本,業務只見 hub;etcd 混版本常態;`kube-storage-version-migrator` 後台改寫 | 「讀寬寫窄、邊界歸一化」正確;官方警告:不回填就退役版本 = 舊轉換代碼成為無限期依賴 |
| Minecraft DFU | 每 chunk 帶 `DataVersion`,加載時純規則升級,隨自然存檔落盤;另有一次性「優化世界」批量升級 | 懶升級 + update 自然落盤 + 按需批量回填,三者共用同一套變換規則 |
| MongoDB Schema Versioning Pattern | 文檔帶 `schemaVersion`,應用按版本歸一化;回填可選;**無 version 字段的文檔視為第一版** | absence-as-v1 退路:無信封列可事後加裝信封 |
| Avro + Confluent Registry | 數據不帶邏輯版本;兼容模式(BACKWARD/FORWARD/FULL)在 schema 發佈時由工具強制 | 加性演進紀律可以工具化,執行在 CI/發佈時而非運行時 |
| Protobuf (Google) | 無版本字段;字段號永不復用、只加 optional、容忍未知字段(tolerant reader) | 兼容性建構:多數演進根本不需要版本機制 |

共識:① 沒有任何一家在讀路徑寫回;② 混版本共存是常態,清理靠顯式回填工具;
③ 默認姿態是加性演進不跳版本,版本機制是破壞性變更的破玻璃手段。

來源:[K8s Storage Versions](https://kubernetes.io/docs/concepts/overview/working-with-objects/storage-version/) ·
[kube-storage-version-migrator](https://github.com/kubernetes-sigs/kube-storage-version-migrator) ·
[Mojang/DataFixerUpper](https://github.com/Mojang/DataFixerUpper) ·
[MongoDB Schema Versioning](https://www.mongodb.com/docs/manual/data-modeling/design-patterns/data-versioning/schema-versioning/) ·
[Confluent Schema Evolution](https://docs.confluent.io/platform/current/schema-registry/fundamentals/schema-evolution.html)

## 最佳策略

### 兩類劃分

分類軸是**後端是否消費**與**演進預期**,不是表大小:

| 類 | 成員 | 特徵 | 策略 |
|---|---|---|---|
| **信封類**(配置/文檔) | zone-config(將來 zone-shell 各列、zone-page)、content doc | 結構複雜、必然重構(「可能會有更好的設計出來」無法預知);zone 類後端深度消費(boundary 交集、查詢編譯),doc 類後端只取寫入時投影 | 自描述信封 `{schema, version, ...}` + 升級鏈 |
| **兼容類**(extra/普通 JSON) | 各表 `extra`、`settings`、`metadata`、`fields` 等 | 後端幾乎不消費,形狀簡單 | 無信封;強制加性兼容紀律 |
| **豁免** | JWK(`Jwks.publicJwk/privateJwk`)、OAuth client metadata | 外部標準格式,包裝即破壞格式 | 顯式豁免清單 + 註釋 |

無條件的底線:**每個 `jsonData()` 列必須有 contract schema**。現狀 30 個列連
類型形狀都沒有(唯一例外 `bookExtraSchema` 只有一個字段)——沒有已知形狀,
將來連 absence-as-v1 退路都用不了。schema 補課先於一切。

### 信封類:唯一策略(無檔位、無分叉)

```
升級鏈常駐(純變換) + 讀歸一化 + 寫落最新 + 退役前必跑回填
```

發佈時間線(與表大小無關):

```
發佈 N:   上線 vN+1 schema + 升級鏈(讀寬寫窄)
窗口期:   讀 → 鏈內存歸一化(最新版走恆等快路徑,零成本)
          update → 自然落盤最新版
          回填工具 → 批量節流改寫舊行
驗證:     SELECT count(*) WHERE version < N+1 → 0
發佈 N+k: 從 union 刪掉 vN;升級鏈縮短;客戶端 bundle 同步瘦身
```

推導要點(為什麼沒有「靜態 migration vs 動態遷移」的二選一):

- 只要不停機,回填窗口期讀路徑必碰到舊行 → **升級鏈無條件存在於代碼**,
  「完整 migration」省不掉它。
- 要刪除舊版本升級代碼(K8s 無限期依賴警告)→ **回填遲早無條件要跑**。
- 升級函數 = 回填腳本體 = 客戶端轉換器,同一個純函數三個角色。
- 表大小只決定回填時長與節流參數(10⁶ 行分鐘級,10⁸ 行小時級),是 ops
  配置項,**不參與設計決策**。是否阻塞部署等回填跑完,只是把窗口壓成零的
  特例。

#### Schema migration、data backfill、stream task 的切分

「migration 帶不帶數據變化」不是二選一。Rezics 的基線是:

```
Drizzle migration: 讓新 schema 存在,且對舊/新代碼都安全
過渡期代碼:       讀寬寫窄,同時兼容舊資料與新字段
stream task:       處理發布後的新變更,維持下游投影/索引/派生字段
backfill job:      分批搬遷已存在的歷史資料,可重跑、可觀測、可限速
contract migration:驗證完成後再收緊約束/刪舊字段/移除兼容讀
```

例如 `extra.avatar` 提升為 `User.avatar`:

1. **migration A**:Drizzle schema 加 nullable/defaulted `avatar` 字段,必要時加
   index;不掃全表、不立刻 `NOT NULL`、不刪 `extra.avatar`。
2. **code A**:讀 `avatar ?? extra.avatar`;寫入新字段,必要時雙寫舊 JSON 以兼容
   尚未切完的讀者。
3. **stream task**:CDC/隊列只處理發布後的新增/更新行,用當前行狀態重算目標,
   保證新資料不再產生漂移。
4. **backfill job**:按穩定 cursor 分批 `extra.avatar -> avatar`,條件為
   `avatar IS NULL AND extra ? 'avatar'`;每批提交、記錄進度、可中斷重跑。
5. **verification**:`SELECT count(*) ...` 確認舊形狀存量歸零或低於明確豁免。
6. **migration B**:若產品語義需要,再設 `NOT NULL`、清理 JSON key、刪兼容讀。

因此被「跳過」的不是 schema migration。schema migration 仍是 Drizzle
事實源,必須跑;被移出 migration 的是高成本/長時間/需重試的 data backfill。
小且固定的 DML 可以留在 migration;全表 JSON 拆列、投影重建、Meili/ranking
同步等應進 backfill/maintenance job。

規則:

1. **純變換約束**:升級函數不查庫、不做 IO、不依賴環境(現有
   `upgradeZoneConfig` 滿足)。做不到純 = 該變更必須拆成兩步加性演進
   (先加新字段回填共存,下一版再收),或接受一次顯式的阻斷性遷移事件。
2. **trust-on-read**:寫路徑嚴格校驗最新版(`additionalProperties: false`);
   讀路徑只看 `version` 判別字段分發,不跑全量 `Value.Check`(開發模式可保留
   讀校驗抓 bug)。穩態讀成本歸零,回應「熱讀冷寫行每讀做 TS map 浪費」。
3. **禁止讀路徑寫回**:GET 寫庫破壞讀副本路由/冪等性,驚群寫放大,污染
   `updatedAt`。行業零先例。
4. **禁止庫內原地修改**(`jsonb_set` 等):所有寫走
   parse → upgrade → mutate → validate → persist 全鏈。
5. **版本只在 parse 邊界存在**:出了 `parseXxx` 業務代碼只見最新類型,
   絕不在 service 層按版本分發業務邏輯。
6. **客戶端轉換**:後端不消費的列(content doc 已是事實:服務端不透明存儲,
   只在寫入時取 `mainMarkdownSource` 投影),升級鏈跑在前端;鏈長進 bundle,
   回填→退役同時給 bundle 瘦身。純變換約束在此為硬條件。
7. 開發階段現狀不變:校驗失敗 → factory reseed,升級鏈空轉(破壞性變更直接
   改 v1 + reseed)。版本紀律從生產化、不能 reseed 的那一刻開始計息;信封
   是為那一刻鋪的地基。

### 兼容類:強制加性紀律(protobuf 式)

schema JSDoc 標 `@compat additive-only`,變更必須兼容。紀律六條:

1. **tolerant reader**:讀/解析側不得 `additionalProperties: false`(嚴格
   留給寫 DTO)。注意這與 house style 相反,是審計 proposal 的第一決策。
2. 新字段必須 optional + 定義默認;必填字段是永久承諾,可選永不改必填。
3. 封閉 discriminated union 必須有未知 `kind` 兜底(舊讀者降級,不崩潰)。
4. 默認值即契約,與字段同樣不可變。
5. 不改字段類型/語義;不復用已刪字段名;要變就加新字段。
6. 用字符串枚舉起步,不用 boolean(三態死路)。

退路:兼容類列哪天真需要破壞性重構,按 MongoDB 慣例定義「無 version ≡ v1」,
從 v2 起加裝信封,零提前成本。

### 執行機制

- `check:convention` 新規則:每個 `jsonData()` 列必須(a)信封類——contract
  schema 為帶 `schema`+`version` 字面量的 union;或(b)兼容類——schema 帶
  `@compat additive-only` 標記;或(c)在豁免清單(附理由註釋)。對 (b) 機檢
  可檢項(讀側無嚴格 additionalProperties、union 有兜底)。
- 回填工具進 `tool/` CLI + task 表面(批量、節流、按 schema 名 + 目標版本)。
- DB schema 註釋(JSDoc 雙語慣例,落點 `package/server/src/db/schema/unit.ts`
  的 UnitType 枚舉與 contract `unit.ts`):IMAGE unit 服務於作為目錄作品的
  藝術圖像(pixiv 式作品庫語義:歸屬、標籤、討論);普通/裝飾性圖片一律純
  URL 字符串。

## Zone 拆分

### 原則與目標形態

沿**加載/更新邊界**拆,不沿 schema 結構拆。Portal 渲染天然分兩塊:殼(每頁
都要)與當前頁(一次一個);manage 按 tab 編輯。對應:

```
Zone(殼,1 行/zone)                      ZonePage(N 行/zone)
├─ unitId          PK → Unit              ├─ id          PK (uuid)
├─ ownerRealmUnitId                       ├─ zoneUnitId  FK → Zone
├─ boundary  jsonb  rezics/zone-boundary  ├─ slug        unique(zoneUnitId, slug)
│            (context + filters)          ├─ config      jsonb  rezics/zone-page
├─ nav       jsonb  rezics/zone-nav       │              { sections: [...] }
│            (menus + header)             └─ position
├─ theme     jsonb  rezics/zone-theme
└─ startsAt / endsAt / ...                查詢形態:zoneId + slug → config
```

- 殼拆三列:對應三個 manage tab,列級 UPDATE 消除跨 tab lost-update;每列
  獨立信封、獨立版本演進(sections 破壞性變更只動 `rezics/zone-page`)。
- **nav 是 jsonb 列,不是關係表**:菜單 ≤3 層遞歸樹、整樹加載、從不按節點
  查詢;`header.menuId` 與 menus 同住一列,引用校驗仍是信封內部事務。
- **section 不拆行**:tabs/columns 使 sections 為樹,永遠隨頁整載,拆行是
  過度規範化。
- page 行代理 id 做 PK、slug 做 URL 鍵;menu 的 `{kind: "zonePage"}` target
  改按 pageId 引用,slug 改名不斷鏈。
- 固定 `{home, search?, feed?}` → 開放 slug 集合(任意自定義頁面)。
- Zone 表規模假設:subreddit 量級(10⁵–10⁶),**不做小表假設**;按上文策略,
  規模不影響設計。
- 遷移為開發期乾淨 cutover(無舊形態兼容,factory reseed),需同步:seed
  factory、toaru-wiki factory、zoneDTO(portal 響應 = 殼 + 單頁)、section
  data API 加 page 參數。

### 不變量遷移(原 schema 兜底、拆後換家)

1. 「home 必須存在」:傾向 `Zone.homePageId` FK(改名安全、語義顯式);
   備選保留字 slug + service 禁刪。**review 拍板**。
2. menu → page 引用跨表:刪 page 時校驗阻止,或渲染時降級隱藏。**review 拍板**。
3. section id 唯一性從全局收窄到頁內;section 執行 API 帶 page 參數(簡化)。
4. search/feed 特殊性:feed 本是 section kind 可消解;search 頁有特殊路由,
   可能需要 page `kind` 字段。**review 拍板**。

### zone page 的本體

page = 佈局容器,讓社區內容沿「全編輯文本 ↔ 全數據驅動」光譜**漸進遷移**。
「單 richText section 指向 wiki post」(B)是「section 聚合」(A)的退化情形,
A ⊃ B,schema 不需二選一;起步貼 wiki 內容即用,隨目錄關係補全逐 section
替換為 query/collection。

依據:`.temp/example/huiji-characters`(灰機 wiki 分类:角色頁)解剖——

| 區塊 | 本質 | Rezics 形態 |
|---|---|---|
| 簡介段 | 編輯文字 | richText |
| 主要角色頭像牆 | 人工策展列表 | collection(缺頭像牆 display 變體) |
| 角色初登場索引(系列→卷→人名,數百行) | 手工維護的目錄事實表 | 今天 richText;終態 grouped query(「初登場於 X 卷」應為 ENTITY↔BOOK 目錄關係) |
| 分類成員列表 | tag 成員枚舉 | query(已支持) |

wiki 表格複製目錄事實 → 退化為查詢,正是統一 Unit 模型的存在理由。

### entity ↔ wiki page ↔ ref 機制

頭像來自 entity、點擊鏈到 wiki page、wiki page 通過 ref 指回 entity:

| 環節 | 現狀 |
|---|---|
| entity 頭像送達前端 | ✅ `ZoneRefUnitSummary.imageUrl`(contract `zone/zone.ts:103`)已在 refUnits 管道 |
| wiki page ref 指向 entity | ✅ ContentDoc v1 `beforeMain`/`afterMain` 的 `unit-ref` block(`content/doc-v1.ts:37-58`);先渲染在底部 = afterMain entity 卡片 |
| Wikipedia 式側欄 infobox | 🔮 doc-v2 草案的動態佈局/插槽方向,不新造 |
| 展示 entity、鏈向 wiki page | ❌ `ZoneCollectionItem` 加可選 `displayUnitId`(渲染該 unit 頭像/標題,點擊走 `target`)——加性可選字段,兼容紀律的第一個示範案例 |
| 頭像牆排版 | ❌ 新增 collection display 變體 |

### 圖片全 URL 化

theme 的 `logoUnitId/bannerUnitId/backgroundUnitId`、hero 的
`bannerImageUnitId/logoImageUnitId`、header 的 `logoImageUnitId` **全部**改純
URL(裝飾圖,非目錄作品)。連帶:`ZoneManageThemeTab` 註明的「無 IMAGE picker
API」邊界消失——復用 `uploadApi.uploadImage` 上傳得 URL。URL 約束(僅 https?
僅本站上傳域?)**review 拍板**。

### section 詞彙缺口(記賬,不阻塞拆表)

grouped query(按關係/屬性分組展示)、collection 頭像牆 display、可摺疊
section、頁內 TOC/錨點。

## Zone 管理編輯器

- **JSON tab**:`RezicsJsonEditor` 已存在(`@rezics/ui`,CodeMirror 6 +
  `@codemirror/lang-json` + jsonLint,`BookExtraEditor` 在用)。編輯對象為
  draft(`Omit<config, "schema" | "version">`),信封頭由系統在寫入邊界加。
  typebox 同構 → 客戶端 `Value.Check` 餵 CodeMirror lint 行內報錯。與結構化
  tab 的同步模式(同一 draft 雙視圖 / JSON 非法時鎖其他 tab)**review 拍板**。
- **ColorField**(放 `@rezics/ui`):react-colorful(2.8KB、零依賴、5.7.0
  仍維護、`.react-colorful__*` 類 UnoCSS 覆寫,與 Base UI 棧無衝突)——
  `HexColorPicker` 面板 + 內建 `HexColorInput`(hex 直接輸入)+ 自建預設
  色塊/主題 palette 層;保留裸文本輸入作非 hex CSS 值逃生口。
  排除:@uiw/react-color(自帶皮膚)、react-aria(棧外重依賴)。

## Proposal 劃分(已切出,2026-06-10)

1. **JSON 演進政策** → `plan/proposal/json-evolution-policy.md`
2. **強制兼容 schema 設計審計** → `plan/proposal/compat-schema-audit.md`(依賴 1)
3. **Zone 拆表** → `plan/proposal/zone-shell-page-split.md`(引用 1)
4. **Zone 管理編輯器** → `plan/proposal/zone-manage-editor.md`(依賴 3)

## Review 拍板結果(2026-06-10,按最佳實踐決定)

1. home 不變量:**`homePageId` FK**(改名安全、語義顯式)。
2. 刪 page 的懸掛 menu 引用:**刪除時校驗阻止 + 渲染降級雙保險**。
3. search/feed 特殊性:**消解**——page 一律純 section 容器,feed 走 section
   kind,search 走殼級內建路由;將來如需以加性 `kind` 字段演進。
4. 主題圖片 URL 約束:**僅 https,不限域**(社區可外鏈;CSP 另議)。
5. JSON tab 同步模式:**同 draft 雙視圖,JSON 非法時鎖結構化視圖**。
6. 豁免清單邊界:**確認**——僅外部標準格式(JWK、OAuth metadata)與有意
   無類型的 `EchoKV.value`;內部數組類歸兼容類不豁免。
