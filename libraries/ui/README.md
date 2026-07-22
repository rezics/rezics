# @rezics/ui

This shared UI workspace is the single source of truth for upstream SharkUI components and REZICS custom components. All components are exported from the package root:

```tsx
import { Button, PageHeading, QueryPending } from "@rezics/ui";
```

Heavy project-owned components can be imported from their explicit custom entry point when they
need an isolated client bundle:

```tsx
import { PortableTextEditor } from "@rezics/ui/custom/portable-text-editor";
```

## Surface policy

REZICS uses a ghost-first surface system. Static cards and ordinary controls are transparent and
borderless at rest, then use semantic hover, pressed, selected, and focus states for affordance.
Floating surfaces use shadow for elevation without an outline. Visible edges are intentional:

- use `border-input` for form-field boundaries;
- use `border-border-weak` for structural dividers;
- use an explicit component appearance such as `Card appearance="outlined"` or a filled button
  variant when the surface needs stronger emphasis.

Import UI components from `@rezics/ui`. The upstream `src/ui` mirror is not a public application
entry point, so project defaults cannot be bypassed accidentally.

## Shape policy

SharkUI owns ordinary control geometry. Buttons, selects, and input groups inherit their radius
from the shared `--radius` scale and use component `size` props for height and padding. Feature
call sites may use `className` for layout constraints, but must not override the radius of a
control whose SharkUI component already defines its surface geometry. Prefer component `size`
props over overriding height, padding, or typography.

Use SharkUI's `pill` variant only when the shape carries meaning, such as a circular icon button.
Avatars and functional tracks may remain fully round. Project-wide visual treatments belong in a
project-owned component or variant under `src/custom`, not in the upstream `src/ui` mirror or an
individual feature call site.

Each frontend app should import the shared theme in its global style entry point and declare the shared component sources for Tailwind scanning:

```css
@import "@rezics/ui/styles.css";

@source "../../libraries/ui/src";
```

Custom components receive localized copy and entity-search implementations through `UiProvider`. Authentication, routing, and API clients remain in each app's adapter layer, so apps such as Admin can reuse components without inheriting the REZICS frontend's runtime coupling.

Preview changes in this package before adding or updating a SharkUI component:

```sh
yarn dlx shadcn@latest add @shark/<component> --dry-run --cwd libraries/ui
yarn dlx shadcn@latest add @shark/<component> --diff --cwd libraries/ui
```

## SharkUI audit

Run the following command to verify the local component mirror, package-root exports, and frontend usage rules:

```sh
task libraries:ui:shark-audit
```

It requires `src/ui` to match the official SharkUI registry one-to-one. It also rejects
hand-written native interactive controls, composite ARIA controls, feature-level control radius
overrides, native `option` elements, physical-direction utilities, `space-x/space-y` utilities,
and non-semantic Tailwind palette classes in application features and `src/custom`. Use the
corresponding SharkUI components and primitives instead, such as `NativeSelectOption`.
