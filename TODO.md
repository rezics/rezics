## Section 1
- [ ] EXCERPT 前端 單 url 解析的話，如何在有兩個unitId 的時候正確定位，比如 章節定位到章節？
- [ ] 後端如果可行的化，最好同時返回slug，比如 book info page tag 查詢的時候，最好同時返回 slug，然後前端先渲染 slug，再用unit 去查 tags，這樣好歹比 顯示 unitIds 好看
- [ ] 章節數量，加入 book info
- [ ] https://better-auth.com/docs/infrastructure/plugins/dashboard
- [ ] 年齡分級機制調整
- [ ]  meilisearch 需要調整，支持專門的 tag，realm-tag 索引系統 
- [ ]  post?.extra?.title 是錯誤的嗎？post 需要有一個支持的語言用以進行語言篩查，所以title要不直接基於translation?代價高嗎？
- [ ]  幾個模式是錯誤的啊，grid 模式要換成瀑布流， list 模式實際上是平鋪， review 是默認模式，shelf item 的 review 默認應該分 tab 展示，所以纔會有平鋪，這才是邏輯。瀑布流則是平鋪模式下的衍生。

## Section 2
- [ ] 還是考慮遷移到 paraglide-js
- [ ] 權限模型還是不正確，jwt 驗證通過之後，還需要查數據庫校驗啊
- [ ] 編輯器也有問題，回覆了也無法成功
- [ ] You could consider tools that empower authors to engage with feedback and improve their work. For example, a dashboard where authors can track reviews, filter critiques by themes (e.g., plot, style, pacing), or highlight top feedback. You might also add revision tools or prompts based on reader suggestions, and perhaps even a feature for authors to respond or engage with reviewers—fostering a strong feedback loop. Tools that make feedback actionable will keep both authors and reviewers engaged!
- [ ] 专注于做 local lib
- [ ] 用戶 提交 slug 限制
- [ ] 目前需要限制普通用戶 創建 realm,比如最多十個
- [ ] 短鏈 like /r/xxx
- [ ] unit-users 複數 user unit 協作
- [ ] 似乎有的時候會彈出完成註冊，校驗完成註冊的接口 應該不能用來覆蓋 slug
- [ ] book content index 並不需要章節存在，所以如果沒有 unitId 前端應該給交互，可以創建 chapter
- [ ] post 不需要 translation 直接使用 unit translation 只不過他專門索引 不同 trans 的 release id, 就是 翻譯是 不同 unit 維護
- [ ] UnitTranslation  sourceReleaseUnitId  我覺得這個名詞不夠準確，因爲這描述了 work，但是他可以提供 wiki 的功能
- [ ] 快照其實是正確的，用快照的話，bot更新可以不觸發新版本
- [ ] 我需要整理spc规范嘛？
- [ ] 有沒有一個將所有 test 收集起來並以文檔展示，也方便測試的工具？
- [ ] R2 暫時對於所有非書籍封面，或者非管理員不開放（就是論壇圖片全部走圖床）
- [ ] 登錄流程仍然需要優化，主要是代碼上的，比如不需要觸發頁面刷新，純穩定的邏輯
- [ ] oauth 靜默綁定，不修了，添加 更豐富的 user setting page 吧
- 如果有这样一系列的网站，他们 除了 Homepage，aboutPage，或者一些特殊 page 不一样，以及 layout 不一样以外，公用 完全一样的代码，包括 比如 /book/unitId or ……，最适合的架构是怎样？ 
- routes 通过虚拟文件路由似乎就能够做到跨package继承哦

login page 太窄了，左侧可以添加图片之类的以美观，参考https://www.deviantart.com/join/
