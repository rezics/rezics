# Component Selection — shadcn-or-custom (no MUI)

The component selection policy for rezics is **shadcn-or-custom**:

1. **shadcn primitives** from `@rezics/ui/shadcn` are the default. They are Radix-based, token-aligned via `--rezics-*`, and already wired to the rezics aesthetic (borderless surfaces, parchment canvas, brand-fill).
2. **Custom rezics primitives** in `@rezics/ui/primitive/`, `@rezics/ui/composite/`, or feature-local `components/` directories cover the gaps shadcn does not. Add a custom primitive only when there is an in-tree consumer that needs it.

There is no third option. **MUI (`@mui/*`) and `@material/material-color-utilities` are permanently forbidden** — R8 in `bun run check:convention` blocks any `@mui/*` import or `package.json` declaration. Reintroducing MUI requires an OpenSpec change updating both `ui-component-foundation` and `convention-enforcement` specs.

## Decision flow

```
Need a UI primitive?
  ├── Does @rezics/ui/shadcn export it?    → Use it.
  ├── Is there an existing custom primitive in @rezics/ui/primitive or composite?  → Use it.
  └── Neither? Author a custom primitive in package/ui/src/primitive/<category>/<Name>.tsx
              (or feature-local components/) — but only with a real consumer use case.
```

## MUI → replacement map (reference)

The deprecate-mui change replaced every MUI usage with the entries below. Use this when reading old PRs, migrating dormant code, or onboarding.

### Layout

| MUI                 | Replacement                                  |
| ------------------- | -------------------------------------------- |
| `Box`               | `<div>` + UnoCSS                             |
| `Stack`             | `<div className="flex flex-col gap-{2n}">`   |
| `Container`         | `<div className="mx-auto w-full max-w-...">` |
| `Grid`              | `grid grid-cols-12 gap-4` / `col-span-{n}`   |
| `Paper`             | `<div>` + `bg-rezics-color-bg-elevated`      |

### Buttons & form controls

| MUI                  | Replacement                                                          |
| -------------------- | -------------------------------------------------------------------- |
| `Button`             | shadcn `Button` (`default` / `outline` / `ghost` / `destructive`)    |
| `IconButton`         | shadcn `Button size="icon"` + `aria-label`                           |
| `LoadingButton`      | shadcn `Button` + `Spinner size="sm"` + `disabled`                   |
| `ButtonGroup`        | flex container of shadcn `Button`s, or `ToggleGroup` for segmented   |
| `TextField`          | shadcn `Input` + `Label` (or `<textarea>` for multiline)             |
| `Select` / `MenuItem`| shadcn `Select` (sentinel `__none__` for empty value)                |
| `Checkbox`           | shadcn `Checkbox`                                                    |
| `Radio` / `RadioGroup` | shadcn `RadioGroup` + `RadioGroupItem`                             |
| `Switch`             | shadcn `Switch`                                                      |
| `FormControl` / `FormLabel` | shadcn `Field` family or plain `<label>` + `<p>`              |
| `Slider`             | shadcn `Slider`                                                      |
| `Rating`             | `RatingInput` (custom; `@rezics/ui` `primitive/control`)             |
| `ToggleButtonGroup`  | shadcn `ToggleGroup` (use `RatingInput` for score-input contexts)    |

### Surface & feedback

| MUI                                | Replacement                                           |
| ---------------------------------- | ----------------------------------------------------- |
| `Card` family                      | shadcn `Card` family (no decorative border)           |
| `Divider`                          | `<hr className="border-rezics-color-border" />`       |
| `Avatar` / `AvatarGroup`           | shadcn `Avatar` family                                |
| `Chip`                             | shadcn `Badge` (+ `Button size="icon"` with lucide `X` for removable) |
| `Alert` / `AlertTitle`             | shadcn `Alert` family (token-mapped severity)         |
| `Snackbar` / toast usage           | `sonner` `toast()`                                    |
| `Skeleton`                         | shadcn `Skeleton`                                     |
| `CircularProgress` / `LinearProgress` | `Spinner` (custom; indeterminate) or shadcn `Progress` (determinate) |
| empty-state ad-hoc compositions    | `EmptyState` (custom; `@rezics/ui` `composite/feedback`) |

### Navigation & overlays

| MUI                                | Replacement                                                       |
| ---------------------------------- | ----------------------------------------------------------------- |
| `Tabs` / `Tab`                     | shadcn `Tabs` family (string `value`)                             |
| `Dialog` family                    | shadcn `Dialog` (`onOpenChange={(o) => !o && onClose()}`)         |
| `Drawer`                           | shadcn `Sheet` (`side` prop)                                      |
| `Menu` / `MenuItem`                | shadcn `DropdownMenu`                                             |
| `Popover` (interactive sites)      | shadcn `Popover` (`modal={false}` for tag interaction)            |
| `Popper`                           | shadcn `Popover` (`modal={false}`)                                |
| `Tooltip`                          | shadcn `Tooltip` (wrap each in its own `TooltipProvider`)         |
| `Breadcrumbs`                      | shadcn `Breadcrumb` family                                        |
| `AppBar` / `Toolbar`               | project shell-layout components                                   |
| `List` / `ListItem*`               | semantic `<ul>`/`<li>` + UnoCSS, or shadcn `Command`              |
| `Accordion`                        | shadcn `Accordion`                                                |

### Data display

| MUI                       | Replacement                                                |
| ------------------------- | ---------------------------------------------------------- |
| `Table` family            | shadcn `Table` family (TanStack Table for headless logic)  |
| `DataGrid` (`@mui/x-*`)   | TanStack Table + shadcn `Table` (no `@mui/x-*` consumers exist) |
| `Pagination`              | project pagination component or composed shadcn `Button`s  |

### Theme / styling

| MUI                                | Replacement                                          |
| ---------------------------------- | ---------------------------------------------------- |
| `useTheme()` / `theme.*`           | `var(--rezics-*)` references / TS breakpoint constants |
| `sx` prop                          | UnoCSS classes (8px MUI scale doubles to 4px UnoCSS) |
| `ThemeProvider` / `createTheme`    | removed; tokens project via `[data-theme]` cascade   |
| `@mui/material/styles`             | removed; use UnoCSS / CSS variables                  |

## Custom primitives shipped with deprecate-mui

These three are the only custom primitives the migration shipped. Anything else (Combobox, DatePicker, DataTable, etc.) needs its own change proposal.

- **`RatingInput`** — `package/ui/src/primitive/control/RatingInput.tsx`. Star rating with keyboard support, `precision={1}`, click-selected-to-clear.
- **`EmptyState`** — `package/ui/src/composite/feedback/EmptyState.tsx`. Title + description + optional icon + optional action.
- **`Spinner`** — `package/ui/src/primitive/feedback/Spinner.tsx`. CSS-only indeterminate loader (`role="status"`).

## Icons

Default to `lucide-react`. Only fall back to `@tabler/icons-react` when lucide lacks the glyph, and document the mapping in `icons.md`. Never use emoji as UI chrome (decorative emoji inside user-generated content is fine).
