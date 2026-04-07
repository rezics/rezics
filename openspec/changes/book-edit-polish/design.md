# Design: Book Edit Polish

## Metadata Page (InfoSection)

Replace bordered Cards with Apple-style sections:
```
Section Title                    (text-sm font-semibold text-muted-foreground uppercase tracking-wide)
─────────────────────────────    (thin separator)
  field content below
  with generous spacing

                                 (gap between sections)
Section Title 2
─────────────────────────────
  more fields
```

- No Card/border wrappers
- Section headers as small uppercase labels with a thin separator
- Restore MUI Button for submit/back actions
- shadcn Checkbox/Tooltip stay (they're new and better)
- Input fields: remove `border` class, use `border-b border-input bg-transparent` for bottom-border-only style

## Chapter Tree Editor

### Variable Row Height
react-arborist supports `rowHeight` as a function: `(node) => number`
- Parent/section nodes: 36px (compact header row)
- Leaf nodes: 80px (card with metadata)

### Leaf Node Card Design (from screenshot reference)
```
┌──────────────────────────────────────────────────────┐
│  ⠿  第一章 少女陷入绝境                    ⋮        │
│     已发布 2026.01.11 23:33                          │
│     字 6.0K  ⊙ 0                                    │
└──────────────────────────────────────────────────────┘
```
- Drag handle (left)
- Title (bold, larger text)
- Mock published date (muted red)
- Word count + view count (muted)
- Kebab menu (right) — triggers context menu

### Parent Node (unchanged, compact)
```
⠿ ▼ 边境                                    12,450字
```

### Tree Container
- Remove border from tree container div
- Height: `calc(100vh - top offset - footer)` with minimum 500px
