# Component Selection — MUI vs shadcn vs Custom

## The order

1. **MUI first.** It's the foundation. Tokens map to `theme.palette` / `theme.spacing` / `theme.shape` / `theme.typography`. MUI components inherit all of it for free.
2. **shadcn supplements** when MUI is missing the primitive or its API is awkward for the use case.
3. **Custom only** when neither MUI nor shadcn fits — and the component must consume tokens (UnoCSS utilities, MUI theme props, `var(--rezics-color-*)` for colors, or token imports from `@rezics/ui/config/tokens/*`), not hex literals.

---

## When to use MUI

| Need                        | Component                                              | Storybook |
| --------------------------- | ------------------------------------------------------ | --------- |
| Button (any kind)           | `<Button>` (variant: contained / outlined / text)      | `Primitive/Button/ColorfulButton--green` (variant axis), `Composite/Button/CooldownButton--default` |
| Icon button                 | `<IconButton>`                                         |           |
| Form text input             | `<TextField>` (variant="standard" for app, outlined for admin) | `Primitive/Control/RoseTextField--default`, `--multiline`, `--with-error`, `--disabled` |
| Form select                 | `<Select>` + `<MenuItem>`                              |           |
| Form switch / checkbox      | `<Switch>` / `<Checkbox>`                              |           |
| Form radio group            | `<RadioGroup>` + `<Radio>`                             |           |
| Modal                       | `<Dialog>` (with `<DialogTitle>`, etc.)                | `Composite/Surface/DialogContainer--default`, `Composite/Surface/FullScreenModal--default`, `Composite/Forms/ConfirmDeleteDialog--default` |
| Tooltip                     | `<Tooltip>`                                            |           |
| Tabs                        | `<Tabs>` + `<Tab>`                                     |           |
| Menu (right-click / overflow) | `<Menu>` + `<MenuItem>`                              |           |
| Snackbar / toast            | `sonner` (`<Toaster />` already mounted) — NOT MUI's, sonner has better DX |           |
| App bar / nav rail          | `<AppBar>` + `<Toolbar>`                               |           |
| Drawer (side nav)           | `<Drawer>`                                             |           |
| Avatar                      | `<Avatar>`                                             |           |
| Chip / tag                  | `<Chip>`                                               |           |
| Linear progress             | `<LinearProgress>`                                     |           |
| Circular progress           | `<CircularProgress>`                                   |           |
| Skeleton                    | `<Skeleton>`                                           |           |
| Pagination                  | `<Pagination>`                                         |           |
| Tables                      | `<Table>` family                                       |           |
| Accordion                   | `<Accordion>`                                          |           |
| Stepper                     | `<Stepper>`                                            |           |
| DatePicker / TimePicker     | `@mui/x-date-pickers` (already a dep via `@mui/lab`)   |           |
| Empty state                 | Compose with `<EmptyState>`                            | `Composite/EmptyState/EmptyState--default` |
| Forms (multi-field)         | Compose `TextField` + `<Button>` + `<EmptyState>` for the no-data path | `Domain/Review/ReviewForm--default`, `--happy-path`, `--with-error` |

## When to reach for shadcn (Radix-based)

shadcn primitives in `@rezics/ui` already exist (see `package/ui/src/shadcn/`). Use them when:

| Need                                | Component / source                       | Why over MUI                                   |
| ----------------------------------- | ---------------------------------------- | ---------------------------------------------- |
| Command palette / cmdk             | shadcn `<Command>` (cmdk-based)          | MUI has no command palette primitive.          |
| Bottom-sheet / mobile drawer       | `vaul` (already a dep)                   | MUI's `<Drawer>` with anchor="bottom" is heavier on mobile gestures. |
| Context menu (right-click)         | shadcn `<ContextMenu>` (Radix)           | MUI's `<Menu>` doesn't bind to right-click idiomatically. |
| Hover card / rich tooltip          | shadcn `<HoverCard>`                     | MUI's `<Tooltip>` is single-line / inline only. |
| Disclosure (collapsible)           | shadcn `<Collapsible>` (Radix)           | MUI's `<Collapse>` is animation-only, not a structured a11y disclosure. |
| Toggle group                       | shadcn `<ToggleGroup>` (Radix)           | MUI's `<ToggleButtonGroup>` is fine but heavier; choose by feel. |
| Drag-and-drop                      | `@dnd-kit/*` (already deps)              | Neither MUI nor shadcn has DnD.                |
| Carousel                           | `embla-carousel-react` + shadcn `<Carousel>` | MUI has no carousel primitive.             |
| Charts                             | `recharts`                               | MUI x-charts exist but recharts is the project default. |

## When to write custom

Only after you've checked:
- MUI's component list
- shadcn primitives in `package/ui/src/shadcn/`
- Existing custom primitives in `package/ui/src/primitive/` and `package/ui/src/composite/`

If still nothing fits, write custom and obey:

1. **Tokens-only**: every color, spacing, radius, font-size, shadow, motion is a CSS var or theme reference. No hex literals, no `px` values.
2. **Theme-aware**: if it has color, it must work in light AND dark.
3. **Live in `package/ui/`**: under `primitive/` (atomic, no business logic) or `composite/` (combines primitives).
4. **Document with a fixture or story**: Cosmos fixture today; Storybook story after Phase 5.

---

## Common decision points

### "Modal-like surface"

```
Is it a focused interaction (form, confirmation, command)?
├── Yes, central + reasonable size                → MUI <Dialog>
├── Yes, mobile bottom-sheet feel                 → vaul <Drawer>
├── Yes, list-of-actions triggered by element     → MUI <Menu> (or shadcn <ContextMenu> for right-click)
├── Yes, search-and-pick over commands            → shadcn <Command>
└── No, just a tooltip / hover hint               → MUI <Tooltip> (or shadcn <HoverCard> for rich)
```

### "Form input"

```
What's the input type?
├── Free text / number              → MUI <TextField variant="standard"> (app) or "outlined" (admin)
├── Single choice from list (≤7)    → MUI <RadioGroup> or <ToggleButtonGroup>
├── Single choice from many         → MUI <Select> or <Autocomplete>
├── Multi-choice                    → MUI <Checkbox> group, or <Autocomplete multiple>
├── Boolean                         → MUI <Switch> (preferred over Checkbox for settings)
├── Date / time                     → @mui/x-date-pickers
├── Slider                          → MUI <Slider>
└── Search-as-you-type with results → shadcn <Command>
```

### "Empty state"

```
Always custom, but use MUI primitives inside:
- <Box> wrapper
- <Typography variant="body2" color="text.secondary"> for the message
- Optional <Button variant="text"> for the CTA
- Whitespace via py / my (sx prop)
- NO illustrations, NO emoji, NO bordered card
```

---

## Cross-cutting rules

1. **Don't mix design vocabularies in one feature**. If a feature uses MUI `<Dialog>`, use MUI `<Button>` inside it — not shadcn `<Button>`. Picking and choosing in one render tree creates jarring inconsistencies.

2. **Don't import shadcn `<Button>`**. The shadcn button styling diverges from our MUI theme. Use MUI `<Button>` in nearly all cases. shadcn primitives are for behaviors MUI lacks (Command, ContextMenu, etc.), not styling alternatives.

3. **Avoid raw HTML form elements** (`<button>`, `<input>`, `<select>`, `<textarea>`). They have no theme integration. Always go through MUI or shadcn.

4. **Toolbar / header chrome is MUI**. `<AppBar>`, `<Toolbar>`. Don't hand-roll this.

5. **Sidebar nav for app**: shadcn `<Sidebar>` family (already in `package/ui/src/shadcn/`) is fine; MUI doesn't have a great equivalent.

---

## "Where do I find existing primitives?"

```
package/ui/src/
├── primitive/      Atomic UI bits (carousel arrows, decorative bars). No business logic.
├── composite/      Built from primitives + MUI/shadcn. Often feature-adjacent.
├── shadcn/         shadcn-style Radix primitives (button, dialog, sidebar, command, ...).
├── editor/         Editor-specific UI (json editor, etc.)
└── link/           SafeLink + ExternalLinkModal
```

Before writing anything new, `rg` for the component name in these directories. Most of the time, it already exists.

---

## Common abstractions

When a feature pulls in carousels or color-coded calls-to-action, reach for the
shared component instead of hand-rolling new wrappers.

### `<DomainCarousel>`

Generic horizontal carousel with arrows, indicators, and embla integration. The
four domain wrappers (`HorizontalBookCarousel`, `HorizontalReviewCarousel`,
`HorizontalExcerptCarousel`, `HorizontalShelfCarousel`) shim through it. New
carousel surfaces should compose `<DomainCarousel>` with a `renderItem` prop
rather than copy the embla wiring.

- Story: `Composite/Carousel/DomainCarousel--default`
- Stories: `--empty`, `--loading`, `--long-content`, `--compact`

### `<ColorfulButton>`

Single component, three colors via `color="green | orange | rose"`. Replaces
the legacy `GreenButton`/`OrangeButton`/`RoseButton` triplet. The naming test
fires for the color axis (one component, three colors) but **never** add a
`size` prop here — sizes live on the underlying MUI `<Button>`.

- Stories: `Primitive/Button/ColorfulButton--green`, `--orange`, `--rose`, `--disabled`

### `<ReactionBar>` (size axis)

Reactions and votes share one component with `size="small | medium | large"`.
Don't split into `SmallReactionBar` etc; the layout is identical, only spacing
and icon size vary. See [`patterns.md#13`](./patterns.md) for why.

- Stories: `App/Engagement/ReactionBar--small`, `--medium`, `--large`, `--disabled`

### `<ReviewCardPair>`

Composes two `<ReviewCard>` instances with a shared layout band. Used inside
`HorizontalReviewCarousel` to render two reviews per slide. Don't duplicate
ReviewCard internals — wrap.

- Stories: `Domain/Review/ReviewCardPair--default`, `--locale-cjk`
