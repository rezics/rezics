## Section 1

- [ ] UnitTag 表是否要重命名到 TagUnit 比較好？
- [ ] 搞清楚 ui package 如何 允许 unocss config 以及basic-css 共享, 以提供给 dispatch，還有未來別的package
- [ ] 定製 elysia + prisma 的 console 輸出主題，可以做成獨立 package
- [ ] meilisearch 可能的性能問題的全面分析
- [ ] 章節數量，加入 book info
- [ ] seed factory 相关脚本需要彻底的优化，以满足我的需求，包括将 meili search sync 流程加入 factory，以及搞清楚，要怎么满足特殊测试，譬如大post tree, 大 content tree, 大 history， 复杂 shelf。也许这种特殊 seed 可以作为单独的流程在常规 seed 选项之后进行 seed，然后 seed 完之后输出 unit type - unit id 
- [ ] tag 搜索機制要明確 搜索 score>xxx 或者 被 pinned 的，不過以 score排名的時候則不需要特別處理pinned，我覺得這是符合語義的，就是 owner pinned 的內容始終被尊重，可以被 tag 搜索到，但是不代表你要被特殊照顧排在上面。
- [ ] entity 应当有 avatar
- [ ] wiki 和所有权之间的冲突，我们需要锁机制，就是 用户拥有的 entity 是不允许其他用户编辑的， 然后 book 里面的某些字段，也是可以锁起来的。 wiki-content-ownership-plan 基本上 需要和 wiki history 系统一起实现
- [ ] 基于 cdc-queue-sequin-spike report 的结果实现相应功能 确定 pg-boss 用独立的数据库，最好独立的后端service。
- [ ] unitTranslation常用叫法扩充表，单独的表，允许类似 tagVote 的机制让用户贡献unit的常见叫法，作为元信息的一部分，也能方便搜索。

## 搜索

- [ ] Suggest / autocomplete（header 下拉建議）：本身要新 endpoint、prefix 索引或快取層，與聯邦搜尋正交。建議獨立 search-suggest。
- [ ] 空查詢的探索/熱門/最近（discovery state）：要 trending/recent 統計來源，跟搜尋管線無關。獨立做。

## Section 2
- [ ] award 支持兩種獎勵點數和現金獎勵
- [ ] https://www.usebruno.com/
- [ ] realm联合封禁名单，就是将block list作为一级公民，最好可以订阅多个block list，但是这样必然也带来性能问题，要如何处理呢。 目的就是讓用戶或者realm可以訂閱多個block list，最好能隨時啓用block list(對於user)，讓生態真正做到爲每一個人服務，就是不會說整個平臺被任何風向帶歪。
- [ ] 還是考慮遷移到 paraglide-js
- [ ] 編輯器也有問題，回覆了也無法成功
- [ ] You could consider tools that empower authors to engage with feedback and improve their work. For example, a dashboard where authors can track reviews, filter critiques by themes (e.g., plot, style, pacing), or highlight top feedback. You might also add revision tools or prompts based on reader suggestions, and perhaps even a feature for authors to respond or engage with reviewers—fostering a strong feedback loop. Tools that make feedback actionable will keep both authors and reviewers engaged!
- [ ] 目前需要限制普通用戶創建有slug的realm,比如最多十個，僅unitId的realm可以無限。
- [ ] unit-users 複數 user unit 協作，即unit有權限的user支持多人
- [ ] 快照其實是正確的，用快照的話，bot更新可以不觸發新版本
- [ ] 有沒有一個將所有 test 收集起來並以文檔展示，也方便測試的工具？
- [ ] R2 分爲 user domain 和 site domain，像 book cover 之類的就是site domain, 然後 post 上傳就是 user domain, user domain 可能可以限制每個用戶的r2空間，比如1gb free之類的。目標其實是無限的站內用空間，尤其是圖片，不能限制用戶的post創作，但是對於file或者可分享空間需要有限制。
- [ ] 設計參考https://better-auth.com/docs/infrastructure/plugins/dashboard
- [ ] login page 太窄了，左侧可以添加图片之类的以美观，参考https://www.deviantart.com/join/

## Before launch

- [ ] docker化，建立完善的部署脚本
- [ ] 將所有app路由讓AI過一邊，實際上試試大併發的情況，分析請求上可能的任何性能問題，這是一個非常大的change，tasks集合，需要分段執行

## V2

- [ ] introduce-api-unit-store
- [ ] 一个 local 的数据库，基于indexdb 里面维护了 slugScope-slug-unitId 的对应关系 对于比如 /u/root-user/shelf/favorites 就要先查 slug-scope = u slug = root-user get unitId then, slug-scope = root-user-unitId slug = favorites get favorites shelf unitId  https://www.npmjs.com/package/dexie 

## Software related

- [ ] The software architecture is determined to adopt Electron
- [ ] focus on local lib


## 社区治理

- [ ] 如何防止个人作品或者社区作品恶意挂靠知名entity（譬如知名作者，导演），从而导致滥用？然后是否扩展锁，以支持锁定某个entity不允许被使用，即需要使用邀请机制，就是user添加该entity，会触发邀请通知和邮件。然后这个机制是先确定现有schema能不能做，具体实践则是以后再做
