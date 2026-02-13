
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
