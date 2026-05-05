# Component Selection — shadcn-or-custom

The component selection policy for rezics is **shadcn-or-custom**:

1. **shadcn primitives** from `@rezics/ui/shadcn` are the default. They are vendored from the `base-luma` registry, base-ui-based, token-aligned via the flat `--colors-*` cascade, and already wired to the rezics aesthetic (borderless surfaces, parchment canvas, brand-fill). Path P keeps vendored source close to upstream; see `openspec/changes/migrate-shadcn-to-base-ui-luma/design.md`.
2. **Custom rezics primitives** in `@rezics/ui/primitive/`, `@rezics/ui/composite/`, or feature-local `components/` directories cover the gaps shadcn does not. Add a custom primitive only when there is an in-tree consumer that needs it.

There is no third option. Introducing a third-party UI library requires an OpenSpec change updating `ui-component-foundation`.

## Decision flow

```
Need a UI primitive?
  ├── Does @rezics/ui/shadcn export it?    → Use it.
  ├── Is there an existing custom primitive in @rezics/ui/primitive or composite?  → Use it.
  └── Neither? Author a custom primitive in package/ui/src/primitive/<category>/<Name>.tsx
              (or feature-local components/) — but only with a real consumer use case.
```

## Selection by category

| Need                       | Recommendation                                                                          |
| -------------------------- | --------------------------------------------------------------------------------------- |
| Modal / dialog             | shadcn `Dialog` (`onOpenChange={(o) => !o && onClose()}`)                               |
| Side panel / drawer        | shadcn `Sheet` (`side` prop)                                                            |
| Form input                 | shadcn `Input` + `Label` (or `<textarea>` for multiline); shadcn `Field` family for grouping |
| Form select                | shadcn `Select` (sentinel `__none__` for empty value)                                   |
| Form toggle                | shadcn `Checkbox` / `Switch` / `RadioGroup` + `RadioGroupItem`                          |
| Button (primary actions)   | shadcn `Button` (`default` / `outline` / `ghost` / `destructive`); `size="icon"` + `aria-label` for icon-only |
| Segmented control          | shadcn `ToggleGroup` (or `RatingInput` for score-input contexts)                        |
| Table                      | shadcn `Table` family + TanStack Table for headless logic                               |
| Empty state                | `EmptyState` (custom; `@rezics/ui/composite/feedback`)                                  |
| Navigation tabs            | shadcn `Tabs` family (string `value`)                                                   |
| Navigation menu            | shadcn `DropdownMenu` for action menus, shadcn `NavigationMenu` for top-level chrome    |
| Breadcrumbs                | shadcn `Breadcrumb` family                                                              |
| Rating input               | `RatingInput` (custom; `@rezics/ui/primitive/control`)                                  |

## Surface, feedback, and miscellaneous

| Need                       | Recommendation                                                                          |
| -------------------------- | --------------------------------------------------------------------------------------- |
| Card surface               | shadcn `Card` family (no decorative border)                                             |
| Divider                    | `<hr className="border-rezics-color-border" />`                                         |
| Avatar                     | shadcn `Avatar` family                                                                  |
| Badge / chip               | shadcn `Badge` (+ `Button size="icon"` with lucide `X` for removable)                   |
| Inline alert               | shadcn `Alert` family (token-mapped severity)                                           |
| Toast                      | `sonner` `toast()`                                                                      |
| Skeleton                   | shadcn `Skeleton`                                                                       |
| Spinner / progress         | `Spinner` (custom; indeterminate) or shadcn `Progress` (determinate)                    |
| Tooltip                    | shadcn `Tooltip` (wrap each in its own `TooltipProvider`)                               |
| Popover (interactive)      | shadcn `Popover` (`modal={false}` for tag interaction)                                  |
| Accordion                  | shadcn `Accordion`                                                                      |

## Custom primitives the design system ships

These three are the only first-party custom primitives — anything else (Combobox, DatePicker, DataTable, etc.) needs its own change proposal.

- **`RatingInput`** — `package/ui/src/primitive/control/RatingInput.tsx`. Star rating with keyboard support, `precision={1}`, click-selected-to-clear.
- **`EmptyState`** — `package/ui/src/composite/feedback/EmptyState.tsx`. Title + description + optional icon + optional action.
- **`Spinner`** — `package/ui/src/primitive/feedback/Spinner.tsx`. CSS-only indeterminate loader (`role="status"`).

## Icons

Default to `lucide-react`. Only fall back to `@tabler/icons-react` when lucide lacks the glyph, and document the mapping in `icons.md`. Never use emoji as UI chrome (decorative emoji inside user-generated content is fine).
