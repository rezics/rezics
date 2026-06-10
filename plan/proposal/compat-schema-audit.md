---
title: 強制兼容 schema 審計 — 兼容類 JSON 補課與紀律落地
status: active
created: 2026-06-10
completed:
supersededBy:
tags: [contract, schema, compat, convention, audit]
---

## Why

兼容類(extra/普通 JSON)列的演進策略是「無信封 + 強制加性兼容」,但前提是
每列有已知形狀——現狀約 30 個 jsonb 列無 contract schema(唯一例外
`bookExtraSchema` 只有一個字段),沒有已知形狀,連將來 absence-as-v1 加裝
信封的退路都用不了。本提案定稿六條兼容紀律、給每列補 contract schema(或
顯式豁免),並把可機檢項接進 `check:convention`。依賴
`json-evolution-policy.md` 的三分規則機制(2.x)。

## Durable constraints & decisions

- 兼容紀律六條,標 `@compat additive-only` 的 schema 必須遵守:(comment →
  envelope 模塊 JSDoc 統一表述;每個 @compat schema 的 JSDoc 引用)
  1. tolerant reader:讀/解析側不得 `additionalProperties: false`;嚴格僅
     用於寫 DTO。**這與 house style 相反,是本提案的核心決策**:兼容類
     schema 的讀側容忍未知字段,寫側才嚴格。
  2. 新字段必須 optional + 定義默認;可選永不改必填。
  3. 封閉 discriminated union 必須有未知 `kind` 兜底(舊讀者降級不崩潰)。
  4. 默認值即契約,與字段同樣不可變。
  5. 不改字段類型/語義、不復用已刪字段名;要變就加新字段。
  6. 用字符串枚舉起步,不用 boolean。
- 補課原則:**先查實際讀寫再定型**——schema 反映現實用法,不發明字段;
  確實空置的列定為空對象 schema(`t.Object({}, 寬鬆)`)佔位,形狀留給未來
  加性演進。(comment → 各 schema JSDoc)
- 豁免僅限:外部標準格式(JWK ×2、auth `OAuthClient.metadata`)與有意
  無類型的通用 KV(`EchoKV.value`)。內部數組/簿記列一律歸兼容類,不豁免。
  (type → convention 規則豁免清單)
- `HistoryOutbox.payload` 按事件 kind 建 discriminated union(含未知 kind
  兜底),歸兼容類——行短命但屬內部協議,需形狀。(type)
- 機檢範圍:@compat schema 讀側無嚴格 additionalProperties、union 有兜底
  分支;其餘四條靠 review 紀律,不做不可靠的機檢。(comment → 規則代碼)

## Tasks

## 1. 紀律定稿與機檢

- [ ] 1.1 六條紀律寫進 `package/contract/src/envelope/envelope.ts` 模塊
      JSDoc(雙語),定義 `@compat additive-only` 標記格式。
- [ ] 1.2 `tool/src/commands/convention/rules/` 兼容類機檢:帶 @compat 標記
      的 schema 禁讀側 `additionalProperties: false`、discriminated union
      需兜底分支。

## 2. 逐列補課(每列:查用法 → 定型/豁免 → @compat 標記 → 銷 TODO)

- [ ] 2.1 身份域:`User.permission`、`User.settings`、`User.extra`、
      `ApiToken.scopes`(`db/schema/identity.ts`)→ contract user/auth 模塊。
- [ ] 2.2 目錄域:`Book.extra`(擴充現有 `bookExtraSchema` 並補 @compat)、
      `Game.extra`、`GameSystemRequirement.hardware`、`Media.extra`、
      `Series.extra`、`Shelf.extra`、`Link.extra`、`SourceSite.refRules`。
- [ ] 2.3 社交域:`Post.extra`、`Realm.extra`、`UserUnitProgress.extra`、
      `UserUnitProgress.lastReadAnchor`。
- [ ] 2.4 翻譯域:`UnitTranslation.extra`、`ContentTranslation.provenance`。
- [ ] 2.5 評分域:`ScoreAggregate.distribution`、`ScoreAggregate.fields`、
      `ScoreEntry.fields`。
- [ ] 2.6 內容結構:`ContentStructureAnchor.ancestorNodeIds/path/titlePath`
      (數組列,typed array schema,歸兼容類)。
- [ ] 2.7 治理域:`AccountEnforcement.metadata`、`ModerationCase.metadata`、
      `StaffAuditLog.metadata`。
- [ ] 2.8 基礎設施:`HistoryOutbox.payload`(按事件 kind 的 union + 兜底);
      `EchoKV.value` 確認豁免並補理由註釋。
- [ ] 2.9 豁免確認:`Jwks`(server `db/schema/jwt.ts` 與 auth
      `db/schema/auth.ts`)、auth `OAuthClient.metadata` 補豁免理由註釋。

## 3. 收尾

- [ ] 3.1 清空 `json-evolution-policy.md` 2.3 留下的 TODO 清單;
      `task check:convention` 全綠。
- [ ] 3.2 凡補課中發現的「寫了但無人讀」「讀了但無人寫」字段,記入
      對應 schema JSDoc 或交 `task knip` / 後續清理,不在本提案擴大刪改。

## Out of scope

- 信封類列(zone、content doc)——它們走升級鏈,不在兼容類審計範圍。
- 給兼容類列發明新字段或重構現有用法;本提案只「如實定型」。
- 兼容紀律 2/4/5/6 條的自動化機檢(靠 review)。
