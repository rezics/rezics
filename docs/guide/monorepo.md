# Monorepo Structure

This project uses [Bun workspaces](https://bun.sh/docs/install/workspaces) with a hierarchical layout.

## Workspace Configuration

```json
{
  "workspaces": ["package/**", "!package/**/test/**", "!package/**/template/**"]
}
```

`package/**` uses tree-matching (recursive glob), so nested packages are discovered automatically.

See Bun's [glob pattern docs](https://bun.com/docs/runtime/glob#supported-glob-patterns) for details.
