# Spec: Visual Fixes

## Inputs
- Remove border from metadata inputs — use `border-b border-input` (bottom only) or `bg-muted/50` background
- Keep MUI Autocomplete for user search (already correct)

## Section Layout
- Remove `<Card>` / `<CardHeader>` / `<CardContent>` wrappers from BookEditInfoSection
- Use section heading + separator + content pattern
- Generous spacing between sections (space-y-8)

## Buttons
- Restore MUI `<Button>` for submit/back in BookEditInfoSection
- shadcn Button stays in chapter tree toolbar (new UI)

## Chapter Tree
- Remove `rounded-md border` from tree container
- Variable rowHeight: parent=36, leaf=80
- Leaf node card: title (font-medium), mock date (text-xs text-red-400), word count (text-xs text-muted-foreground)
- Kebab icon (MoreVertical) on leaf nodes for context menu
- Tree height: fill viewport with min 500px
