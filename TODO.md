## Section 1
- [ ] Unit 等級的 版權 copyright 字段，string 或者 array 用戶可以選擇 用戶默認的/realm默認（realm優先）的 copyright 協議，類似於 github 的那種版權協議，cc-by-4.0 這種，不過我們需要確認下各種協議的slug，要固定下來
- [ ] UnitTag 表是否要重命名到 TagUnit 比較好？
- [ ] 搞清楚 ui package 如何 允许 unocss config 以及basic-css 共享, 以提供给 dispatch
- [ ] 需要明确的是，realm scoped tag 和 realm tag 并不相同，realm scoped tag引入了新的tag， realm tag本质上类似于realmVoteTag
- [ ] meilisearch 可能的性能問題的全面分析
- [ ] 章節數量，加入 book info
- [ ] 將 所有app路由讓AI過一邊，實際上試試大併發的情況，分析請求上可能的任何性能問題，這是一個非常大的change，tasks集合，需要分段執行
- [ ] 我们需要一个 local 的数据库，基于indexdb 里面维护了 slugscope-slug-unitid 的对应关系  
对于比如 /u/root-user/shelf/favourite 就要先查 slug-scope = u slug = root-user get unitId then, slug-scope = root-user-unitid slug = favourite get favourite shelf unitid  
https://www.npmjs.com/package/dexie 

## 搜索
- [ ] Suggest / autocomplete（header 下拉建議）：本身要新 endpoint、prefix 索引或快取層，與聯邦搜尋正交。建議獨立 search-suggest。
- [ ] 空查詢的探索/熱門/最近（discovery state）：要 trending/recent 統計來源，跟搜尋管線無關。獨立做。

## Section 2
- [ ] award 支持兩種獎勵點數和現金獎勵
- [ ] https://www.usebruno.com/
- [ ] realm联合封禁名单，就是将block list作为一级公民，最好可以订阅多个block list，但是这样必然也带来性能问题，要如何处理呢。 目的就是讓用戶或者realm可以訂閱多個block list，最好能隨時啓用block list(對於user)，讓生態真正做到爲每一個人服務，就是不會說整個平臺被任何風向帶歪。
- [ ] 還是考慮遷移到 paraglide-js
- [ ] 編輯器也有問題，回覆了也無法成功
- [ ] tanstack query 能不能通過中間件讓list查詢能夠做到全部支持的id級別的緩存，意思就是比如 book list query1 查詢了 id1,id2,id3. query2 查詢 id2,id3,id4. 然後 能夠自動復用 query1 的 id2, id3 的結果，我需要網絡調查，以及如果不支持，看看要怎麼實現一個通用的支持
- [ ] You could consider tools that empower authors to engage with feedback and improve their work. For example, a dashboard where authors can track reviews, filter critiques by themes (e.g., plot, style, pacing), or highlight top feedback. You might also add revision tools or prompts based on reader suggestions, and perhaps even a feature for authors to respond or engage with reviewers—fostering a strong feedback loop. Tools that make feedback actionable will keep both authors and reviewers engaged!
- [ ] 专注于做 local lib
- [ ] 目前需要限制普通用戶創建有slug的realm,比如最多十個，僅unitId的realm可以無限。
- [ ] unit-users 複數 user unit 協作，即unit有權限的user支持多人
- [ ] 快照其實是正確的，用快照的話，bot更新可以不觸發新版本
- [ ] 有沒有一個將所有 test 收集起來並以文檔展示，也方便測試的工具？
- [ ] R2 分爲 user domain 和 site domain，像 book cover 之類的就是site domain, 然後 post 上傳就是 user domain, user domain 可能可以限制每個用戶的r2空間，比如1gb free之類的。目標其實是無限的站內用空間，尤其是圖片，不能限制用戶的post創作，但是對於file或者可分享空間需要有限制。
- [ ] 設計參考https://better-auth.com/docs/infrastructure/plugins/dashboard
- [ ] login page 太窄了，左侧可以添加图片之类的以美观，参考https://www.deviantart.com/join/
