
```
feature/                  # 模块根目录
  model/                  # 纯业务模型与规则（禁止引用 React）
    types.ts              # 定义业务实体与接口协议
    selectors.ts          # 处理数据转换与业务计算的纯函数
  hooks/                  # 封装与本功能相关的 React 逻辑（副作用、事件监听）
  util/                   # 仅限本功能使用的技术工具函数（如特定格式转换）
  state/                  # 状态容器（管理 jotai atoms 或 zustand stores）
  component/              # 原子化 UI 组件（仅负责视觉渲染，无副作用）
    HeroBanner.tsx
    FeedList.tsx
  section/                # 业务区块层（负责将状态注入组件并编排业务）
    HomeMainSection.tsx
  page/                   # 路由级入口组件（极薄的布局装配层）
    HomePage.tsx
  index.ts                # 模块对外暴露的唯一合法出口
```

util: 区别于 model/selectors. selectors 负责业务逻辑计算，而 util 负责纯技术性的辅助。例如：针对该功能的特殊字符串处理、局部数据格式化等。

## feature 规范

跨 feature、跨领域、具有“平台级”或“应用级”性质的模块，使用根级别名访问，这类代码本来就应该被很多地方依赖，例如全局 UI 基础组件、网络层、状态管理入口、设计系统等。而在单个 feature 内部，尤其是 components、hooks、services 这类强内聚代码，优先使用同层或低层的相对路径，保持“依赖主要在本领域内流动”的形态。这样一眼就能从导入路径判断：这是在用本 feature 的内部实现，还是在依赖应用层能力。

## 层级引用规范

- 严禁 model 层引用 hooks 或 state，保持其纯净度以支持单元测试。
- page 和 section 优先从 state 获取数据，通过 hooks 执行副作用动作。
- index.ts 应当作为该功能的唯一出口，外部禁止直接访问 hooks 或 util 内部文件。
