## Section 1

- [ ] 新書建立頁沒有 bookUnitId，不能立即 link author；我會先只在既有書籍編輯頁顯示 Add author。如果你想新書也能先選作者，需要把 author 暫存進 create payload 
- [ ] 定製 elysia + prisma 的 console 輸出主題，可以做成獨立 package，包括信息輸出的中間件，可能需要討論一下，dev 和 production 都要支持，不過 production 是 log，然後要計入性能分析工具
- [ ] meilisearch 可能的性能問題的全面分析
- [ ] 章節數量，加入 book info
- [ ] 可能的通用性能問題，如果 lazy import 同一個 @/entity index，可能會讓detail/edit/self-claim 被打進同一個 lazy chunk。 如果feature很小，這不一定是問題；但如果想保留 route-level split，可以在合併目錄使用薄 entry point，或者在整理 TanStack Router code splitting 策略時一起整理。
- [ ] meilisearch admin 需要更多的東西，比如各個index的行數情況之類的數據，以及還有什麼數據有需要的，應該調查
- [ ] about, donate, product page.


## 搜索

- [ ] Suggest / autocomplete（header 下拉建議）：本身要新 endpoint、prefix 索引或快取層，與聯邦搜尋正交。建議獨立 search-suggest。
- [ ] 空查詢的探索/熱門/最近（discovery state）：要 trending/recent 統計來源，跟搜尋管線無關。獨立做。

## Section 2
- [ ] award 支持兩種獎勵點數和現金獎勵
- [ ] https://www.usebruno.com/
- [ ] realm联合封禁名单，就是将block list作为一级公民，最好可以订阅多个block list，但是这样必然也带来性能问题，要如何处理呢。 目的就是讓用戶或者realm可以訂閱多個block list，最好能隨時啓用block list(對於user)，讓生態真正做到爲每一個人服務，就是不會說整個平臺被任何風向帶歪。
- [ ] 編輯器也有問題，回覆了也無法成功
- [ ] You could consider tools that empower authors to engage with feedback and improve their work. For example, a dashboard where authors can track reviews, filter critiques by themes (e.g., plot, style, pacing), or highlight top feedback. You might also add revision tools or prompts based on reader suggestions, and perhaps even a feature for authors to respond or engage with reviewers—fostering a strong feedback loop. Tools that make feedback actionable will keep both authors and reviewers engaged!
- [ ] 目前需要限制普通用戶創建有slug的realm,比如最多十個，僅unitId的realm可以無限
- [ ] 有沒有一個將所有 test 收集起來並以文檔展示，也方便測試的工具？
- [ ] R2 分爲 user domain 和 site domain，像 book cover 之類的就是site domain, 然後 post 上傳就是 user domain, user domain 可能可以限制每個用戶的r2空間，比如1gb free之類的。目標其實是無限的站內用空間，尤其是圖片，不能限制用戶的post創作，但是對於file或者可分享空間需要有限制。
- [ ] 設計參考https://better-auth.com/docs/infrastructure/plugins/dashboard
- [ ] login page 太窄了，左侧可以添加图片之类的以美观，参考https://www.deviantart.com/join/
- [ ] Annual Analysis Feature
- [ ] 針對 unit 的擴展，地理擴展和時間擴展，不僅僅是真實時間和真實地理，而是能支持任何地理，不知道是否能做到。不過我認爲真實地理可能不要放在單獨表放在 unit 表比較好，就跟真實時間並不被抽象到單獨表一樣。

## Before launch

- [ ] server/src/env 的瘦身，看看有沒有好的位置去放
- [ ] docker化，建立完善的部署脚本
- [ ] 將所有app路由讓AI過一邊，實際上試試大併發的情況，分析請求上可能的任何性能問題，這是一個非常大的change，tasks集合，需要分段執行
- [ ] deploy mode 的日誌和性能分析配置
- [ ] podman 和 docker 的管理面板，看看 1panel的適配情況，以及討論到時候數據庫備份要怎麼做。

## V2

- [ ] introduce-api-unit-store
- [ ] 一个 local 的数据库，基于indexdb 里面维护了 slugScope-slug-unitId 的对应关系 对于比如 /u/root-user/shelf/favorites 就要先查 slug-scope = u slug = root-user get unitId then, slug-scope = root-user-unitId slug = favorites get favorites shelf unitId  https://www.npmjs.com/package/dexie 

## Software related

- [ ] The software architecture is determined to adopt Electron
- [ ] focus on local lib
- [ ] app desktop mobile package


## 社区治理

- [ ] 如何防止个人作品或者社区作品恶意挂靠知名entity（譬如知名作者，导演），从而导致滥用？然后是否扩展锁，以支持锁定某个entity不允许被使用，即需要使用邀请机制，就是user添加该entity，会触发邀请通知和邮件。然后这个机制是先确定现有schema能不能做，具体实践则是以后再做
