Get-ChildItem -Path . -Recurse -Include "node_modules", "package-lock.json", "pnpm-lock.yaml" | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue

## TECH_STACK

- https://react.dev/
- 组件库：https://mui.com/
- 路由：https://github.com/molefrog/wouter
- APP状态管理：https://github.com/pmndrs/zustand
- 组件状态管理：https://github.com/pmndrs/valtio

## Monorepo

- https://rushjs.io/

## DashBoard

- https://refine.dev/

## GraphQL

- https://github.com/urql-graphql/urql
- Appwrite SDK https://appwrite.io/docs/sdks

# `create-preact`

<h2 align="center">
  <img height="256" width="256" src="./src/assets/preact.svg">
</h2>

<h3 align="center">Get started using Preact and Vite!</h3>

## Getting Started

- `pnpm dev` - Starts a dev server at http://localhost:5173/

- `pnpm build` - Builds for production, emitting to `dist/`

- `pnpm preview` - Starts a server at http://localhost:4173/ to test production build locally
