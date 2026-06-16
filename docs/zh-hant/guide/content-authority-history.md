# 內容權威、歷史與 Wiki 所有權

這份筆記說明 v1 內容權威 rollout 中的營運部分。

## 基礎設施使用者

`rezics` 和 `rezics-wiki` 是一般的 `User` 資料列，背後都有
`Unit(type=USER)` 資料列。它們刻意沒有 `authUserId`，所以不能作為登入
身份使用。

`rezics` 用於平台官方擁有的內容。`rezics-wiki` 是透過明確 wiki 模式流程
建立的社群目錄與 wiki 內容的保管擁有者。產品 UI 可以把 `rezics-wiki`
所有權標示為社群目錄所有權，但儲存與權限程式碼會把這個值視為一般的
User Unit id。

## 歷史消費

主 canonical mutation 會在和內容變更相同的資料庫交易中寫入 `HistoryOutbox`
資料列。Runtime delivery 由 `@rezics/job-runner` 負責：Sequin 觀察已提交的
`HistoryOutbox` insert，runner 佇列化 `history.outbox.ingest`，worker 再把
確切儲存的 outbox payload 持久化到 history 資料庫。主寫入不會同步呼叫
history service。

若要暫停歷史消費，停止或縮減 job-runner 的 `history.ingest` worker。主
canonical 寫入會繼續，outbox 資料列會保持 pending。worker 恢復後，可以處理
pending 資料列，而不需要對 main 的目前狀態做 backfill。

歷史 ingestion 只有一條 owner path：job-runner 的 `history.ingest` worker。
history service 負責讀取，不會執行 process 內的 outbox poller。

失敗資料列可以透過 admin dashboard 的計數觀察。管理員可以用下列 API 將失敗
資料列移回 pending：

```http
POST /admin/history-outbox/retry-failed
Content-Type: application/json

{}
```

傳入 `{ "unitId": "<unit-id>" }` 可以只重試單一 Unit 的失敗。

## Backfill 政策

既有開發資料列不需要自動 backfill。v1 的 Wiki 所有權是 forward-only：新的
wiki 模式建立流程會在伺服器端把 `Unit.userId` 解析為已 seed 的
`rezics-wiki` 使用者。

若要手動檢視既有 wiki-shaped 資料列，執行：

```bash
bun run --cwd package/server scripts/list-wiki-shaped-rows.ts
```

在任何一次性資料修復前先檢視輸出。沒有明確 migration plan 時，不要批次改寫
owners。

## API 消費者注意事項

支援 wiki 的 create API 接受 `creationMode`。

- 社群目錄/wiki 建立請送出 `creationMode: "wiki"`。
- 個人作品或 claim 流程中，請送出 `creationMode: "personal"`，或在 API 預設
  為個人所有權時省略此欄位。
- wiki 建立時不要送出 owner ids。伺服器會忽略或拒絕 client 提交的 owner
  identity，並在內部解析為 `rezics-wiki`。

Runtime edit authority 與 creation mode 分開。編輯是否允許由目前 owner、
collaborators、endpoint policy，以及 `UnitFieldLock` 資料列共同決定。
