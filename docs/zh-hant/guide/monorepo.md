# Monorepo 結構

這個專案使用 [Bun workspaces](https://bun.sh/docs/install/workspaces)，採用階層式
layout。

## Workspace Configuration

```json
{
  "workspaces": ["package/**", "!package/**/test/**", "!package/**/template/**"]
}
```

`package/**` 使用 tree-matching（recursive glob），因此 nested packages 會自動被
發現。

詳情見 Bun 的 [glob pattern docs](https://bun.com/docs/runtime/glob#supported-glob-patterns)。
