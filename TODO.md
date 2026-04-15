- [ ] 重新制作章节编辑器，功能完整，美观好用的组件
- [ ] 我需要整理spc规范嘛？
- [ ] 我需要做到auth-store规范，如果 access token 不存在，则不主动请求任何 内容，所有请求都依赖于auth-store
- [ ] 实现session失效后的主动登录退出机制，但是我又担心网络波动引起恶意退出？better-auth session 到底是如何工作的
- [ ] 引入prismabox優化contract package, 但是對於這種有唯一 contract來源的，到底要如何處理其實是個問題
- [ ] 有沒有一個將所有 test 收集起來並以文檔展示，也方便測試的工具？
- [ ] R2 暫時對於所有非書籍封面，或者非管理員不開放（就是論壇圖片全部走圖床）
- [ ] 截至目前，i18n 並沒有一個很好的解決方案，所以暫時不做遷移，不是非常重要
- [ ] 登錄流程仍然需要優化，主要是代碼上的，比如不需要觸發頁面刷新，純穩定的邏輯

- 如果有这样一系列的网站，他们 除了 Homepage，aboutPage，或者一些特殊 page 不一样，以及 layout 不一样以外，公用 完全一样的代码，包括 比如 /book/unitId or ……，最适合的架构是怎样？ 
- routes 通过虚拟文件路由似乎就能够做到跨package继承哦

login page 太窄了，左侧可以添加图片之类的以美观，参考https://www.deviantart.com/join/

审计超级多，过多的 api 请求，不应该一直请求token，得想个办法，比如添加一个shared session，标记未登录状态？

policy 允许 用户同意多个网站上的 cookie 使用权力，auth 应该建一个 cookie 授权同意表嘛？

然后授权是有开关的，多个不同的部分的授权

basic 是锁死必须同意，

然后别的部分，日后可以这样加, 然后 cookie 可以存 json这样

session key 重命名 到比如 rezics_login_state

- [ ] 将 admin 相关代码内化到各个feature里面
