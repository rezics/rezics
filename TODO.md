- [ ] add Paraglide i18n package
- [x] https://better-auth.com/docs/plugins/admin https://better-auth.com/docs/plugins/organization 参考相关文档为 auth service 添加用户管理功能
- [ ] add editor package use code mirror 6 build markdown and json editor
- [ ] 我需要整理spc规范嘛？
- [ ] 我需要做到auth-store规范，如果 access token 不存在，则不主动请求任何 内容，所有请求都依赖于auth-store
- [ ] 实现session失效后的主动登录退出机制，但是我又担心网络波动引起恶意退出？better-auth session 到底是如何工作的
- [ ] ICON 品牌SVG (https://simpleicons.org/), Font Awesome, https://tabler.io/icons

- 如果有这样一系列的网站，他们 除了 Homepage，aboutpage，或者一些特殊 page 不一样，以及 laytout 不一样以外，公用 完全一样的代码，包括 比如 /book/unitid or ……，最适合的架构是怎样？ 
- routes 通过虚拟文件路由似乎就能够做到跨package继承哦

login page 太窄了，左侧可以添加图片之类的以美观，参考https://www.deviantart.com/join/

审计超级多，过多的 api 请求，不应该一直请求tokn，得想个办法，比如添加一个shared session，标记未登录状态？
