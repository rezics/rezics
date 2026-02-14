
```
home/                     # 入口型功能（首页）
    model/                  # 纯业务模型与规则（无 React）
      types.ts
      selectors.ts
    state/                  # 状态容器（zustand/jotai 等）
    component/
      HeroBanner.tsx
      FeedList.tsx
    section/
      HomeMainSection.tsx
    page/                   # 路由级入口组件（很薄的装配层）
      HomePage.tsx
    index.ts                # feature 对外暴露的统一出口
```

## feature 规范

跨 feature、跨领域、具有“平台级”或“应用级”性质的模块，使用根级别名访问，这类代码本来就应该被很多地方依赖，例如全局 UI 基础组件、网络层、状态管理入口、设计系统等。而在单个 feature 内部，尤其是 components、hooks、services 这类强内聚代码，优先使用同层或低层的相对路径，保持“依赖主要在本领域内流动”的形态。这样一眼就能从导入路径判断：这是在用本 feature 的内部实现，还是在依赖应用层能力。

