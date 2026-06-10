## Section 1

- [ ] 新書建立頁沒有 bookUnitId，不能立即 link author；我會先只在既有書籍編輯頁顯示 Add author。如果你想新書也能先選作者，需要把 author 暫存進 create payload 
- [ ] 定製 elysia + db 的 console 輸出主題，可以做成獨立 package，包括信息輸出的中間件，可能需要討論一下，dev 和 production 都要支持，不過 production 是 log，然後要計入性能分析工具
- [ ] meilisearch 可能的性能問題的全面分析
- [ ] 章節數量，加入 book info
- [ ] 可能的通用性能問題，如果 lazy import 同一個 @/entity index，可能會讓detail/edit/self-claim 被打進同一個 lazy chunk。 如果feature很小，這不一定是問題；但如果想保留 route-level split，可以在合併目錄使用薄 entry point，或者在整理 TanStack Router code splitting 策略時一起整理。
- [ ] zone 未來支持 root page ，通過一個選項支持 zone/id/page-slug 的訪問
- [ ] meilisearch admin 需要更多的東西，比如各個index的行數情況之類的數據，以及還有什麼數據有需要的，應該調查
- [ ] about, donate, product page.
- [ ] 確保項目的垂直複雜性不能過高，但是水平複雜性可以擴展因爲水平複雜性是可以獨立維護，甚至隨時拋棄的
- [ ] 有沒有一個可以通過設定設定github倉庫，會自動clone到 某個文件夾，提取 skill，建立最新的版本 map，並對本地進行更新的工具？感覺還挺有用的，然後通過config還能配置 clone 清理策略，然後對於 agents skill 位置的 contract 維護，如果沒有 Package 也有價值
- [ ] 只有在最底部的 feed 才支持自動加載，也就是 feed 的自動加載要主動啓用
- [ ] Toaru Wiki 這個名字是錯誤的， wiki zone 也是錯誤的，應該是 realm zone，因爲 wiki zone 不止 wiki


## 搜索

- [ ] Suggest / autocomplete（header 下拉建議）：本身要新 endpoint、prefix 索引或快取層，與聯邦搜尋正交。建議獨立 search-suggest。
- [ ] 空查詢的探索/熱門/最近（discovery state）：要 trending/recent 統計來源，跟搜尋管線無關。獨立做。
- [ ] comment section sort by 旁邊添加 search comment , 樣式看 reddit

## Section 2
- [ ] 翻譯 是一個獨立包，包括並行翻譯引擎，翻譯調度之類的，和內容獲取分開
- [ ] 允許用戶在 prefer 中按分類設定 只顯示偏好語言支持的內容，比如 post 只顯示這樣， 但是當前應當不做篩選的渲染。
- [ ] award 支持兩種獎勵點數和現金獎勵
- [ ] 支持轉發機制, 利用 targetUnit 添加一個 unit 類型，以及一個 post 模型，但是 post 不是必選的，然後 editor 區域也要擴展，允許用戶 以轉發/轉發批註的方式進行評論，通過 Model框選擇嗎？業界方案是？
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

- [ ] SERVER_ISSUER: rezics-server 有沒有不符合 jwt 規範的問題或是安全問題？
- [ ] server/src/env 的瘦身，看看有沒有好的位置去放
- [ ] docker化，建立完善的部署脚本
- [ ] 將所有app路由讓AI過一邊，實際上試試大併發的情況，分析請求上可能的任何性能問題，這是一個非常大的change，tasks集合，需要分段執行
- [ ] deploy mode 的日誌和性能分析配置
- [ ] podman 和 docker 的管理面板，看看 1panel的適配情況，以及討論到時候數據庫備份要怎麼做。

## Software related

- [ ] The software architecture is determined to adopt Electron
- [ ] focus on local lib
- [ ] app desktop mobile package


## 社区治理

- [ ] 如何防止个人作品或者社区作品恶意挂靠知名entity（譬如知名作者，导演），从而导致滥用？然后是否扩展锁，以支持锁定某个entity不允许被使用，即需要使用邀请机制，就是user添加该entity，会触发邀请通知和邮件。然后这个机制是先确定现有schema能不能做，具体实践则是以后再做
