- [ ] 重新制作章节编辑器，功能完整，美观好用的组件
- [ ] 我需要整理spc规范嘛？
- [ ] 我需要做到auth-store规范，如果 access token 不存在，则不主动请求任何 内容，所有请求都依赖于auth-store
- [ ] 实现session失效后的主动登录退出机制，但是我又担心网络波动引起恶意退出？better-auth session 到底是如何工作的
- [ ] 引入prismabox優化contract package, 但是對於這種有唯一 contract來源的，到底要如何處理其實是個問題
- [ ] 有沒有一個將所有 test 收集起來並以文檔展示，也方便測試的工具？
- [ ] R2 暫時對於所有非書籍封面，或者非管理員不開放（就是論壇圖片全部走圖床）
- [ ] 截至目前，i18n 並沒有一個很好的解決方案，所以暫時不做遷移，不是非常重要

- 如果有这样一系列的网站，他们 除了 Homepage，aboutPage，或者一些特殊 page 不一样，以及 layout 不一样以外，公用 完全一样的代码，包括 比如 /book/unitId or ……，最适合的架构是怎样？ 
- routes 通过虚拟文件路由似乎就能够做到跨package继承哦

login page 太窄了，左侧可以添加图片之类的以美观，参考https://www.deviantart.com/join/

审计超级多，过多的 api 请求，不应该一直请求token，得想个办法，比如添加一个shared session，标记未登录状态？

policy 允许 用户同意多个网站上的 cookie 使用权力，auth 应该建一个 cookie 授权同意表嘛？

然后授权是有开关的，多个不同的部分的授权

basic 是锁死必须同意，

然后别的部分，日后可以这样加, 然后 cookie 可以存 json这样

session key 重命名 到比如 rezics_login_state

- [] ENV use @/env 有神奇功效，可以将导入自动重定向到自己的package，但是这依然不能够解决导入文件依赖env就会导致报错的现实，也许我们应该切割，任何export的file，都不应该包括任何env依赖
- verifyAuth 的 env 依赖清理
- PendingVerificationSection 需要能够退出登录
- Refresh main-server session 就加上(token)


refine-user-session-and-verification-flow 这个 change 应当做如下调整

- main server 不应当直接与 auth server 通讯， auth server 新增一个 auth_context_token token 端口，采用和auth_identity_token同样的密钥，auth_context_token应当包括验证状态，avatar,name,slug，id，总之，就是建立用户的所有需要的字段，前端先通过接口请求 auth_context_token ，main server ensure 接口依据auth_identity_token 判断登录， 如果登录了就进行一次查询，判断用户是否已经创建，如果创建了就返回 用户已创建。
如果没创建的话，就验证auth_context_token，然后根据auth_context_token的内容创建用户
- /ensure 只应该 ensure，main server jwt token 的 发放应该有单独的端口 /session/token
- /jwt-payload 建议禁用，感觉不是很有用的东西, 前端需要 payload 就自己解析

- \package\auth\src\jwt\verify 必须确保不依赖 env，而是通过参数运行，任何依赖env 的实现都应当 放到 同文件夹下新独立文件然后，在 index.ts 中导出供 package/auth 使用，但是 package/server 绝对不能用，然后 package/server 如果想要更方便快捷的校验，可以自己对 package/auth 导入的 verify 提供一个 提供参数的 包装层

你应当这么调整，依据新的prompt修改之前的 所有 冲突的内容，调整之前的 task，并新增 task 以满足这次prompt 的需要

- [ ] requiredScope 是什么东西，token 应该没有哪个有scop吧？不过可以想想以后怎么利用，比如，很多权限都可以签发为 token，然后可以存在 index,用于初步筛选

- [ ] jwks 相关端口的权限校验问题，cors开放访问

- [ ] 将 admin 相关代码内化到各个feature里面
