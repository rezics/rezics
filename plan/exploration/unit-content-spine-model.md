---
title: Unit Content Spine Model — 魔禁為核心的跨版本聚合建模
status: draft
created: 2026-05-31
tags: [unit, catalog, content, version, review, shelf, tag, rating, search, frbr]
---

> 探索文檔。基於 FRBR/LRM、Tillett 書目關係七分法、Winston-Chaffin-Herrmann
> 部分-整體分類、Kiryakos & Sugimoto (2018) superwork 研究綜合而來。
> 不是契約。畢業後轉為 `/rezics-propose` 的正式 plan。

# 0. 一句話

把**內容身份**（社群聚合的錨）、**包裝**（用戶買/讀的東西）、**分組**（系列/franchise）、
**默認呈現**（main 版本，UX 路由）這四件原本被 `Series`/`Work`/`mainUnitId`
混在一起的事**徹底拆開**，用一條 packaging-free 的**內容脊椎 (ContentNode)** 做
跨版本聚合錨，所有 review/shelf/score 在寫入時把自己解析成一個物化的
**anchorClosure** 數組，讀取永遠是 O(log n + k) 的扁平索引查找。

---

# 1. 四個正交概念（這是整個模型的地基）

| 概念 | 是什麼 | 承擔什麼 | 不變性 |
|---|---|---|---|
| **內容身份 ContentNode** | 跟賣法無關的"那份故事" | review/comment/score/閱讀狀態的**聚合錨** | 跨所有版本不變 |
| **包裝 Unit(BOOK)** | 用戶實際買/讀的一本 | 獨立評分、獨立閱讀狀態、ISBN/出版社/語言 | 每個版本各異 |
| **分組 Unit(GROUPING)** | 系列/franchise，重疊的集合 | 發現、shelf 搜索、社群歸屬 | 一個內容可屬多個 |
| **默認呈現 mainUnitId** | 一個純指針 | 用戶點"魔禁2"默認打開哪一版 + 默認交互目標 | flag，無結構權威 |

**反割裂的核心機制**：大多數用戶的交互（讀/評分/評論/收藏）默認落在**內容身份**上
（經由 main 版本路由）；只有主動下鑽到具體版本時才落在**包裝**上。前者保證 95% 聚合，
後者的非默認交互由 anchorClosure 安全網兜回 lib 頁。

---

# 2. 數據結構（具體到表與字段）

## 2.1 既有（保留）

```prisma
model Unit {            // 一切皆 Unit
  id              String   @id @default(uuid())
  type            UnitType // BOOK | GROUPING | POST | SHELF | ...
  status          UnitStatus
  visibility      UnitVisibility
  defaultLanguage String?
  // —— 新增：默認呈現角色（不是結構父子）——
  catalogEntryKind CatalogEntryKind @default(NONE) // MAIN | VARIANT | NONE
  mainUnitId       String?          // 僅 VARIANT 用：指向同卷的 MAIN 包裝
}

model Book {            // Unit 的 1:1 擴展（包裝層元數據）
  unitId          String  @id
  isbn            String?
  publisherKey    String?
  publicationDate DateTime?
  language        String?   // 該包裝的語言（日文原版/英譯/繁中）
  formatKey       String?   // 文庫本 / 電子書 / 精裝 / 合本
  isLicensed      Boolean
  isAggregate     Boolean @default(false) // 合本標記
}
```

## 2.2 新增：內容脊椎

```prisma
model ContentNode {              // packaging-free 的內容身份（輕量，非 Unit）
  id            String  @id @default(uuid())
  kind          String  // volume | arc | chapter | wholeWork
  title         String?
  // 默認呈現：點這個內容身份默認打開哪一個包裝
  defaultUnitId String?          // → Unit(BOOK)，可按 locale 覆寫
  // 序列導航（非聚合用）
  prevNodeId    String?
  nextNodeId    String?
  @@index([defaultUnitId])
}
```

> 為什麼 ContentNode **不是** Unit：它是聚合錨，不是用戶直接 CRUD 的對象，
> 不需要 status/visibility/權限/Post 線程。做成輕量行避免 Unit 膨脹。
> （可選的折中：把它收進現有 `ContentStructureNode`，但必須去掉 `ownerUnitId`
> 的獨佔語義，讓多個包裝共享同一節點——見 §10 待決策。）

## 2.3 新增：兩類邊

**(a) EMBODIES — 包裝 → 內容（解決粒度錯配的橋）**

```prisma
model UnitContentEmbodiment {
  unitId        String  // Unit(BOOK)
  contentNodeId String  // ContentNode
  ordinal       Int      // 在該包裝內的次序（合本的"卷N"）
  @@id([unitId, contentNodeId])
  @@index([contentNodeId])  // 反查：誰 embody 了這個內容
}
```

- 標準單卷書：1 行（`B-v2-ja → CN-v2`）
- 文庫合本：22 行（`B-bunko → CN-v1 … CN-v22`）= aggregating manifestation
- web novel：N 行（`B-webnovel → 全部 CN`）

**(b) UnitRelation — 類型化 Unit↔Unit 邊（DAG），含社群治理**

```prisma
model UnitRelation {
  fromUnitId  String
  toUnitId    String
  type        RelationType // 見下表
  ordinal     Int?         // SEQUEL 序號等
  // —— 社群治理（僅 MEMBER_OF / ADAPTATION_OF 等"流動邊界"用）——
  proposedBy  String?
  score       Int  @default(0)
  voteCount   Int  @default(0)
  status      RelationStatus @default(ACTIVE) // PROPOSED | ACTIVE | REJECTED
  @@id([fromUnitId, toUnitId, type])
  @@index([toUnitId, type])   // 反查：誰是我的成員 / 誰指向我
  @@index([fromUnitId, type])
}
```

| RelationType | 語義（Tillett / WCH） | 例 | 進入發現閉包？ |
|---|---|---|---|
| `VARIANT_OF` | Equivalence | 英譯v2 → 日版v2(MAIN) | ✅ 向上吸收 MAIN 身份 |
| `MEMBER_OF` | Whole-part: **member-collection** | CN-v2 → 舊約grouping | ✅ 社群可治理 |
| `PART_OF` | Whole-part: collection 嵌套 | 舊約 → 本篇 → franchise | ✅ |
| `ADAPTATION_OF` | Derivative | 動畫 → 小說 | ⚠️ 只閉到共享 grouping，**不**閉到源內容節點 |
| `SEQUEL_OF` | Sequential | CN-v2 → CN-v1 | ❌ 僅導航 |
| `DESCRIBES` | Descriptive (aboutness) | review → CN-v2 | ❌ **嚴格隔離**，獨立索引 |

> 文獻硬約束：①`MEMBER_OF` 用 member-collection 而非 component-part
> （WCH＋Kiryakos 雙重印證：franchise 成員無"一體消費"意圖）。
> ②`DESCRIBES`（評論某物）**不等於** `MEMBER_OF`（屬於某物）——
> superwork 論文 "Superworks versus Subjects" 整節論證；閉包絕不可串接。

## 2.4 新增：物化閉包（讀路徑唯一依賴）

```prisma
model UnitAnchor {            // 每個可被發現的 subject 的祖先身份集合
  subjectId   String  // review / shelfItem / unit / contentNode
  anchorId    String  // 它所屬的某個身份（contentNode / grouping / mainUnit）
  via         RelationType
  depth       Int
  @@id([subjectId, anchorId])
  @@index([anchorId])   // 正查：anchorId 之下所有 subject
}
```

> 搜索文檔（Meilisearch / Post 索引）冗餘一個 `anchorClosure: string[]`（filterable，
> 非 searchable）。`UnitAnchor` 是 canonical 派生表；`anchorClosure` 是其投影。
> 二者都**異步可重建、冪等**（沿用 graveyard plan 的結論）。

## 2.5 評分 / 閱讀狀態 / 標籤

```prisma
model UnitRating {            // 既可評包裝，也可評內容身份
  userId       String
  targetId     String   // Unit(BOOK 具體版本) 或 ContentNode(內容身份)
  targetKind   RatingTargetKind  // MANIFESTATION | CONTENT
  score        Int
  @@id([userId, targetId])
}

model ContentScoreAgg {       // 物化聚合分（反割裂的展示分）
  contentNodeId String  @id
  avgScore      Float
  ratingCount   Int     // = CONTENT 級 + 所有版本 MANIFESTATION 級 rollup
}

model UserReadingState {      // 閱讀狀態：每包裝獨立
  userId  String
  unitId  String   // 具體讀的那一版
  status  ReadingStatus // WANT | READING | DONE | DROPPED
  progress Int?
  @@id([userId, unitId])
}
// "讀過 魔禁2 嗎" = 存在任一 unitId∈embodiers(CN-v2) 的 DONE 記錄（rollup）
```

標籤沿用既有 `UnitTag`(全局,可投票) / `RealmTagApplication`(realm 範圍) /
`UserTagApplication`(用戶私有,見 simplify-shelf plan)，但**附著層分兩種**：

- **內容級標籤**（題材/世界觀/角色/CP）→ 貼在 `ContentNode`（或其 MAIN 包裝）。
  跨所有版本共享，由 §3.6 的閉包對所有版本可見。**這是絕大多數標籤。**
- **載體級標籤**（"翻譯優秀"/"封面好看"/"廉價版"）→ 貼在具體 `Unit(BOOK)`。

---

# 3. 魔禁 第2巻：完整實例與每個場景

## 3.1 實例圖

```
GROUPING 層（polyhierarchy，"不止本篇"）
  G-toaru「とある」franchise (Superwork)
    ▲ PART_OF              ▲ PART_OF
  G-honpen「本篇」         G-railgun「超電磁砲」
    ▲ PART_OF
  G-old「舊約」
    ▲ MEMBER_OF (社群可治理、可投票)
─────────────────────────────────────────────────
內容脊椎 ContentNode（packaging-free）
  CN-v1 ──SEQUEL──▶ CN-v2 ──SEQUEL──▶ CN-v3 …… CN-v22
                     │ defaultUnitId = B-v2-ja
─────────────────────────────────────────────────
包裝層 Unit(BOOK)             EMBODIES
  B-v2-ja  電撃文庫 日文原版v2  ───────▶ CN-v2   [catalogEntryKind=MAIN]
  B-v2-en  Yen Press 英譯v2    ───────▶ CN-v2   [VARIANT, mainUnitId=B-v2-ja]
  B-v2-tw  台灣角川 繁中v2      ───────▶ CN-v2   [VARIANT, mainUnitId=B-v2-ja]
  B-bunko  文庫合本電子書       ──┬────▶ CN-v1
            (isAggregate=true)   ├────▶ CN-v2  (ordinal=2)
                                 └────▶ … CN-v22
  B-webnov web novel(若有)      ──────▶ CN-v1…CN-v22   ※魔禁本身LN起源,
                                                        Re:Zero等適用,機制同
```

VARIANT_OF: `B-v2-en→B-v2-ja`、`B-v2-tw→B-v2-ja`（合本**不**走 VARIANT_OF，只走 EMBODIES）

## 3.2 場景 A：讀者讀「特定出版社特定語言的版本」

用戶買 Yen Press 英譯 v2 → 在 `B-v2-en` 上：
- 閱讀狀態：`UserReadingState{userId, unitId=B-v2-en, status=READING}` —— 獨立
- 給翻譯打分：`UnitRating{targetId=B-v2-en, targetKind=MANIFESTATION, score=4}` —— 獨立
- 看到的元數據：B-v2-en 的 ISBN/出版社/語言（包裝級），**且** CN-v2 的內容級標籤
  （題材/角色，經閉包繼承）。

## 3.3 場景 B：文庫聚合（一本書，內部卷）

`B-bunko` 是一個 BOOK，`isAggregate=true`，靠 22 行 EMBODIES 連到脊椎。
用戶讀到「合本的第3卷」（=CN-v2 的內容）：
- 精確交互：targetId=CN-v2（系統知道合本 ordinal=2 ↔ CN-v2）→ 與讀單卷版的人**聚合**。
- 整體交互（評論整套）：targetId=B-bunko → 閉包含 CN-v1…CN-v22 + grouping。
  打 `wholeAggregate` 標記，讓單卷 lib 頁可選擇展示或降權（避免噪音）。

> 「卷是書的卷而非單獨的書」=合本對內容是**一對多 EMBODIES**；單卷書是**一對一**。
> 同一條脊椎，兩種切法——FRBR aggregating manifestation。

## 3.4 場景 C：web novel（everything 聚合）

同 B-bunko，只是 EMBODIES 覆蓋全部 CN。讀 web novel 第 X 段落→映射到對應 CN→聚合。
魔禁本身是 LN 起源（無 web novel），但 Re:Zero/無職等"web→出版"作品機制完全相同。

## 3.5 Review / Post 如何交互、如何索引（核心）

Review 是 `Post{kind=review, targetUnitId=X}`。**寫入時**計算 anchorClosure，
union 兩個來源：

```
anchorClosure(post) =
    {self}
  ∪ 目錄閉包  catalogClosure(targetUnitId)   // 本 plan：沿 EMBODIES/VARIANT_OF/MEMBER_OF/PART_OF 上溯
  ∪ 討論樹閉包 ancestorPosts(post)            // graveyard plan：沿 parentPost 上溯到 root
```

`catalogClosure` 解析規則（按邊類型，遵守 WCH 傳遞性邊界）：

```
targetUnitId = B-v2-en (英譯v2)
  + VARIANT_OF → B-v2-ja (MAIN)
  + EMBODIES   → CN-v2
  + (CN-v2) MEMBER_OF → G-old → PART_OF → G-honpen → PART_OF → G-toaru
⇒ anchorClosure(R1) = { R1, B-v2-en, B-v2-ja, CN-v2, G-old, G-honpen, G-toaru }
```

深度 D≈6，**寫入 O(D)≈O(1)**。索引：Post 文檔 `anchorClosure[]`（filterable）+
寫 `UnitAnchor` 行。

評論 C1 回覆 R1：`anchorClosure(C1) = {C1, R1} ∪ anchorClosure(R1)`。
→「在 魔禁2 內搜索」`@> [CN-v2]` 命中 R1 **和** C1（社群討論不斷層）。

## 3.6 魔禁2 lib 頁要顯示「所有 version 的 review」

lib 頁 = 內容身份 `CN-v2`（默認呈現 B-v2-ja）。一句查詢：

```sql
-- 跨日版/英譯/繁中/合本第3卷 全部 review
WHERE 'CN-v2' = ANY(anchorClosure) AND kind = 'review'
```

| review | target | 是否命中 CN-v2 | 說明 |
|---|---|---|---|
| R1 | B-v2-en | ✅ (EMBODIES) | 英譯版評論 |
| R2 | CN-v2 (合本卷3) | ✅ | 精確到內容 |
| R3 | B-bunko 整套 | ✅ (含 CN-v2) | 可按 wholeAggregate 降權 |
| Rx | "一篇分析魔禁的論文" DESCRIBES CN-v2 | ❌ 不入此查詢 | aboutness≠成員，獨立索引 |

讀取 **O(log n + k)**。

## 3.7 Shelf 搜索

收藏 B-v2-en 到 shelf A 時，collection 行寫 anchorClosure（同 §3.5）。

```sql
-- shelf 內找"魔禁2 任意版本"
WHERE shelfId='A' AND 'CN-v2'  = ANY(anchorClosure)
-- shelf 內找"魔禁 任意系列任意版本"
WHERE shelfId='A' AND 'G-toaru'= ANY(anchorClosure)
```

兩者皆 **O(log n + k)**，正面滿足你最初的"收藏魔禁2、搜魔禁應命中"。

## 3.8 評分如何不割裂（你的"main version"直覺，落地）

三層並存：

1. **包裝級評分**（power user）：`UnitRating{targetId=B-v2-en, kind=MANIFESTATION}`
   ——"這個英譯好不好"，獨立。
2. **內容級評分**（默認）：從 lib 頁點"給魔禁2評分"且未指定版本 →
   `UnitRating{targetId=CN-v2, kind=CONTENT}` ——"故事好不好"。
3. **展示聚合分** `ContentScoreAgg[CN-v2]` = CONTENT 級 ∪ 所有版本 MANIFESTATION 級
   rollup 的均值。**這是 lib 頁顯眼的那個分**。

**main version 的真正作用**：它是**默認交互目標**。用戶從 lib 頁的任何"評分/標記已讀/
寫評論"按鈕出發，默認 target=內容身份（經 main 路由），而非他碰巧持有的冷門版本。
→ 結構性地保證默認聚合，只有主動下鑽才分流。閱讀狀態同理：每版獨立記錄，
「讀過魔禁2嗎」按 embodiers(CN-v2) 做 rollup。

---

# 4. 複雜度保證（你的硬約束 ≤ O(n log n)）

| 操作 | 路徑 | 複雜度 |
|---|---|---|
| 新 review/收藏/新版（普通寫） | 算 anchorClosure，沿祖先 O(D) | **O(D)≈O(1)** 同步 |
| 編輯正文/元數據 | 單行 | O(1) |
| lib 頁跨版本 review | `@>[CN-v2]` GIN/filterable | **O(log n + k)** |
| 同 work comment/review | 同上 | **O(log n + k)** |
| shelf 找魔禁/魔禁2 | `@>[grouping/CN]` | **O(log n + k)** |
| 重掛系列/移動子樹（罕見） | 異步重建 O(子樹×D) | 不在社群寫路徑 |
| 全量重建 | O(N·D)，排序 O(N log N) | **卡在上限內** |

**讀路徑 O(log n + k) ＜ 你的 O(n log n) 上限**。前提就是"DAG 是真相、閉包物化成數組、
讀取絕不遍歷圖"——讀時遍歷會爆，故 graveyard plan §4 早已拒絕 query-time expansion。

---

# 5. 與既有計劃的收斂（不推翻，是歸位）

```
remove-work  mainUnitId         → 收窄為 VARIANT_OF 邊（單卷版本分組）
remove-work  catalogEntryKind   → 重定義為"默認呈現角色"，非結構父子
remove-work  2.5 content-anchor → 即本 plan 的 ContentNode 脊椎 + UnitAnchor
graveyard    UnitScope.relation → 升級為 UnitRelation typed-edge（真相）
graveyard    scopeUnitIds       → 即 anchorClosure（討論樹閉包來源之一）
simplify-shelf ShelfUnit/Collection → 收藏行加 anchorClosure 投影
失敗的 Series 實體               → 降級為 GROUPING 節點 + MEMBER_OF/PART_OF 邊（polyhierarchy）
```

---

# 6. 待決策（真正的產品取捨）

1. **ContentNode 是獨立輕量表，還是復用去獨佔化的 ContentStructureNode？**
   傾向獨立表（職責清晰、避免 Unit 膨脹）。
2. **合本整套 review（R3）默認在單卷 lib 頁展示還是降權？** 建議默認降權 + 可展開。
3. **`MEMBER_OF` 的治理門檻**：誰能提議"X 屬於魔禁"、需多少票轉 ACTIVE？
   接 `RealmTagApplication` 的投票模型。superwork 論文：邊界應交給社群、保持流動。
4. **`defaultUnitId` 的 locale 路由**：繁中用戶默認看 B-v2-tw、日文用戶看 B-v2-ja？
   需要 per-locale 覆寫表還是運行時選擇。
5. **跨界內容**（如某篇同時屬本篇與超電磁砲）= 多條 `MEMBER_OF`，polyhierarchy 已支持；
   但需定義"主歸屬"以決定 lib 頁麵包屑。

---

# 7. 文獻依據

- FRBR/LRM WEMI + aggregating work：[LoC Tillett PDF](https://www.loc.gov/catdir/cpso/frbreng.pdf) ·
  [OpenWEMI Code4Lib](https://journal.code4lib.org/articles/18412)
- Tillett 書目關係七分法：[Noruzi PDF](http://eprints.rclis.org/25682/1/FRBR%20and%20Tillett's%20Taxonomy%20of%20Bibliographic%20Relationships.pdf)
- Winston-Chaffin-Herrmann 部分-整體六分法（member-collection）：[Winston 1987 PDF](https://ifaa.unifr.ch/Public/TNAEntryPage/ref/Winston1987.pdf)
- Brachman 過載 IS-A：[What IS-A Is and Isn't](https://www.semanticscholar.org/paper/What-IS-A-Is-and-Isn't:-An-Analysis-of-Taxonomic-in-Brachman/fba5b0877f68c147d387563843e1395e5a40e1b7)
- Superwork / franchise（Gundam，與魔禁同構）：Kiryakos & Sugimoto 2018, LIBRES 28(2):40-57
- Polyhierarchy / 分面分類：[Hedden](https://www.hedden-information.com/polyhierarchy-in-taxonomies/) ·
  [Faceted classification](https://en.wikipedia.org/wiki/Faceted_classification)
- 工業實證：[Wikidata P179](https://www.wikidata.org/wiki/Property:P179) · [Data model](https://www.wikidata.org/wiki/Wikidata:Data_model)
