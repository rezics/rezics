- https://react.dev/reference/rules/rules-of-hooks
- [ ] allow to mention
- [x] MUI 的还没自己写的好用 https://mui.com/x/react-tree-view/ 用这个替换当前的 Tree 章节 View
- [ ] 树章节检查为啥 shift 键还是会跳转，感觉就不应该渲染为 link，修改一下
- 完善所有请求暂停逻辑，否则会导致重新渲染！
- 切换明暗模式之后，SideBar 滚动条隐藏样式失效
- 调整高度之后，SideBar 滚动条隐藏样式也会失效
- 通过 ThemeProvider 状态更新机制实现动态主题系统（目前系统损坏）
- 剧透警告
- 後續支持 Route 動畫定制
- 章節名稱修改綁定
- [ ] 侧边栏支持插件，可以获取比如书库内书籍状态
- [ ] 字数不是 tag，只是伪装成 tag,是支持填写区间以查询的
- [ ] https://github.com/meilisearch/meilisearch-react
- [ ] 引入 react-instantsearch
- [ ] Clone NanoJSON 优化代码
- [ ] cookie_consent https://chatgpt.com/share/692d08eb-8160-8005-9134-70c02e82b22b 浏览器级别的组件，等后续引入第三方脚本再添加该组件
- fix : NODE_ENV=production is not supported in the .env file. Only NODE_ENV=development is supported to create a development build of your project. If you need to set process.env.NODE_ENV, you can set it in the Vite config instead.
- 好用的 JSON 编辑器
- [ ] i18n 切换到 Paraglide + (Sherlock 扩展)，或者等到切换的时候看看 i18n Ally 的支持性
- [ ] 模块化 字体切换 https://chatgpt.com/share/69991605-878c-8005-adaf-3b93dbcb43e7 
- [ ] user 详情页似乎可能卡住

## Complete

- [x] 分页组件似乎有的时候可能突然将 page 重置为 1
- [x] 完善 Sidebar 的功能，修改为连接
