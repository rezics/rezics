# 資料庫工作流程

Rezics 的資料庫變更以 Drizzle 為優先。一般 schema 形狀的 durable source 是
擁有該 schema 的 package 中的 Drizzle schema，而不是手寫 SQL migration。

## Schema Owners

Schema ownership 是 package-local：

- `@rezics/auth`
- `@rezics/server`
- `@rezics/notify`
- `@rezics/reaction`
- `@rezics/history`
- `@rezics/ranking`

`@rezics/job-runner` 只做 ensure，因為 pg-boss 擁有它的內部 schema；它使用
`db:ensure`，不要使用 Drizzle schema migrations。

Repo 資料庫命令會按下列順序執行 schema owners：

```text
auth -> server -> notify -> reaction -> history -> ranking
```

工具 preflight 需要 PostgreSQL 18+，且內建 `uuidv7()`。

## 必要 Migration 流程

一般 schema 變更：

1. 編輯 owning package 底下的 Drizzle schema：
   `package/<owner>/src/db/schema`。
2. 從 repo root 執行 `task db:generate -- --package=<owner>`。
3. 檢視產生的 SQL 與 metadata。
4. 執行 `task db:migrate -- --package=<owner>` 做窄範圍驗證。
5. 交付較廣的資料庫工作前，從 repo root 執行 `task db:reset -- --yes`，
   然後執行 `task db:migrate`。

多 owner 變更使用 root commands：

```bash
task db:generate
task db:migrate
task db:deploy
task db:reset -- --yes
task db:ensure
task db:smoke
```

不要把 `drizzle push` 當作 repository durable migration path。它不能取代已
checked-in 的 migrations。

## 手寫 SQL

當 Drizzle 能表達 schema 時，不要手寫一般 table、column、enum、index 或
foreign-key 變更。

手寫 SQL 只允許用於：

- Extensions 與 helper SQL，例如 `ltree` 或 path helper functions。
- Drizzle 無法乾淨表達的資料庫功能，例如特殊 GiST/GIN indexes、partial
  indexes、custom operator classes，或有序的 capability setup。
- 修正文檔化的 Drizzle-generated SQL 缺陷，同時保持 Drizzle schema source
  同步。

提供 prerequisite capability 的 custom SQL 必須出現在依賴它的 migrations 之前。

修正 generated SQL 時，保持修改範圍狹窄：

1. 找出 Drizzle schema intent。
2. 確認 generated SQL 是無效或不匹配的。
3. 只修正產生出的缺陷。
4. 如果 schema expression 造成錯誤輸出，也要更新 schema source。
5. 用 reset 和 migrate 驗證。

## Version Pinning

有意識地使用 Drizzle v1 rc line。在宣告 `drizzle-orm` 和 `drizzle-kit` 的地方，
將它們 pin 到精確相容的 `1.0.0-rc.*` 版本；這次 migration 期間不要改成寬鬆的
`latest` 或 `^` ranges。

截至 2026-06-04，npm 對兩個 package 的 `rc` dist-tag 都解析為
`1.0.0-rc.3`；較新的 `rc4` tags 是 branch prereleases，不是被選定的精確組合。

## 已知 Bugs

### Drizzle Kit 1.0.0-rc.3 Empty Array Default

在 2026-06-06 使用 `drizzle-kit@1.0.0-rc.3` 和
`drizzle-orm@1.0.0-rc.3` 時觀察到。

當 schema 使用未指定型別的 empty array expression 時，Drizzle Kit 會為 empty
text-array default 產生無效 PostgreSQL：

```ts
textArray().default(sql`ARRAY[]`).notNull()
```

Generated SQL：

```sql
DEFAULT ARRAY::text[]
```

Expected SQL：

```sql
DEFAULT ARRAY[]::text[]
```

在 schema source 和 migration SQL 中使用明確 typed expression：

```ts
textArray().default(sql`ARRAY[]::text[]`).notNull()
```

這是文檔化的 generated-SQL defect correction，不是允許手寫 SQL 設計 schema。

## Reset 與 Seeding

`db:reset` 是 destructive 且僅限開發使用。它會 drop 並重新建立選定的本地
databases，然後透過相同的 package `db:migrate` scripts 執行 migrations。它
不得自行建立 application schema。

Reset 後，明確執行必要 seed 與 optional factory workflows。不要依賴應用啟動去
backfill seed 或 factory data。

## Migration Review Checklist

- Schema 變更從 owning package 的 Drizzle schema 開始。
- Generated migrations checked in 到該 package 的 `drizzle/` folder。
- 手寫 SQL 僅限文檔化 custom SQL 或 generated-SQL defect correction。
- Migration SQL 和 schema source 描述相同的最終形狀。
- Fresh reset 和 repeated migrate 都通過。
- Smoke checks 通過，或在 smoke tooling 本身過期時有文檔化 follow-up issue。
