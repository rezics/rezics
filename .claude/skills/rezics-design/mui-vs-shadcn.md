# DEPRECATED — see `component-selection.md`

The `deprecate-mui` change permanently removed MUI from rezics. The component selection policy is now **shadcn-or-custom** (no third option).

See **`component-selection.md`** in this skill directory for:
- the shadcn-or-custom decision flow
- the MUI → replacement map
- the three custom primitives shipped with the migration (`RatingInput`, `EmptyState`, `Spinner`)
- the icon policy (lucide default, tabler fallback)

R8 in `bun run check:convention` blocks any `@mui/*` or `@material/material-color-utilities` import or `package.json` declaration. The authoritative spec is `openspec/specs/ui-component-foundation/spec.md`.
