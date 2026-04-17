## Section 1
- [x] zone-and-unified-search
- [x] universal-markdown-and-user-brief
- [x] book-detail-restructure
- [ ] tag-interaction-system
- [ ] seed-restructure-and-scale

## Section 2
- [ ] book content index 並不需要章節存在，所以如果沒有 unitId 前端應該給交互，可以創建 chapter
- [ ] post 不需要 translation 直接使用 unit translation 只不過他專門索引 不同 trans 的 release id, 就是 翻譯是 不同 unit 維護
- [ ] UnitTranslation  sourceReleaseUnitId  我覺得這個名詞不夠準確，因爲這描述了 work，但是他可以提供 wiki 的功能
- [ ] 快照其實是正確的，用快照的話，bot更新可以不觸發新版本
- [ ] 我需要整理spc规范嘛？
- [ ] 有沒有一個將所有 test 收集起來並以文檔展示，也方便測試的工具？
- [ ] R2 暫時對於所有非書籍封面，或者非管理員不開放（就是論壇圖片全部走圖床）
- [ ] 截至目前，i18n 並沒有一個很好的解決方案，所以暫時不做遷移，不是非常重要
- [ ] 登錄流程仍然需要優化，主要是代碼上的，比如不需要觸發頁面刷新，純穩定的邏輯
- [ ] oauth 靜默綁定，不修了，添加 更豐富的 user setting page 吧
- 如果有这样一系列的网站，他们 除了 Homepage，aboutPage，或者一些特殊 page 不一样，以及 layout 不一样以外，公用 完全一样的代码，包括 比如 /book/unitId or ……，最适合的架构是怎样？ 
- routes 通过虚拟文件路由似乎就能够做到跨package继承哦

login page 太窄了，左侧可以添加图片之类的以美观，参考https://www.deviantart.com/join/
