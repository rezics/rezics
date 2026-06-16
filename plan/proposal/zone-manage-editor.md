---
title: Zone Manage Editor — JSON View, ColorField Palette, and Image URL Flow
status: active
created: 2026-06-10
completed:
supersededBy:
tags: [zone, app, ui, editor, theme, design]
---

## Why

Zone manage currently exposes only structured forms. Admins cannot inspect,
paste, or batch-edit a full config draft; color tokens are bare text inputs with
swatches but no picker or presets; image fields depend on manually pasted unit
ids and will become URL fields after the shell/page split.

This proposal adds three editor improvements after
`zone-shell-page-split.md` lands: a syntax-highlighted JSON view for each
envelope body draft using the existing `RezicsJsonEditor`, a reusable
`@rezics/ui` `ColorField` built on `react-colorful` plus project-owned palette
UI, and an upload-to-URL flow for theme images. UI implementation must load the
`rezics-design` skill.

## Durable constraints & decisions

- The JSON editor edits the envelope body draft, not the full envelope. The
  system owns envelope metadata (`schema` and `version`) and adds it at the
  write boundary; humans do not edit metadata directly. (comment + test)
- JSON view and structured form view edit the same draft. If the JSON text is
  temporarily invalid or fails schema validation, lock the structured view until
  the JSON is fixed or reverted. This prevents two partially invalid
  representations from overwriting each other. (comment + test)
- Client validation is contract validation: use isomorphic TypeBox schemas and
  run `Value.Check` for the corresponding envelope body schema before save.
  Surface TypeBox errors as CodeMirror lint diagnostics. Server validation
  remains authoritative. (comment)
- `ColorField` uses `react-colorful` for the picker panel. The library is small,
  has no dependencies, and exposes `.react-colorful__*` classes that can be
  styled through UnoCSS without coupling `@rezics/ui` to another component
  system. The palette layer (preset swatches and theme sets) is owned by Rezics;
  do not introduce a skinned color component library such as `@uiw/react-color`
  or a new stack such as React Aria for this. (comment -> ColorField component)
- Use `HexColorInput` for direct hex editing, but keep a raw text escape hatch.
  Zone theme tokens are arbitrary CSS color strings rendered through
  `--zone-color-*` variables, not design tokens. Non-hex values such as
  `rgb()` or `oklch()` remain valid, preserving the existing "honest editor"
  stance in `ZoneManageThemeTab`. (comment + test: non-hex values save)
- Theme image upload reuses the existing `uploadApi.uploadImage` provider flow
  to return a URL, matching the markdown editor pipeline. Do not create IMAGE
  units and do not add an IMAGE picker. (comment)
- `ColorField` and palette components are generic UI components. Place them in
  `@rezics/ui` with Storybook stories instead of trapping them inside the zone
  feature. (type)

## Tasks

## 1. ColorField (`@rezics/ui`)

- [ ] 1.1 Add `react-colorful` to `package/ui`; create
      `src/color/ColorField.tsx` with `HexColorPicker` in a popover,
      `HexColorInput`, raw text input, and live swatch. Style
      `.react-colorful__*` classes through UnoCSS so the picker matches design
      tokens.
- [ ] 1.2 Create `src/color/ColorPalette.tsx` for preset swatch grids and
      theme-set application. Export it alongside `ColorField`.
- [ ] 1.3 Add Storybook stories and verify with `task ui:storybook`: single
      color selection, theme-set application, and non-hex value input.

## 2. Theme Tab Integration (`package/app`)

- [ ] 2.1 Replace `ZoneManageThemeTab` color fields with `ColorField` plus
      palette support. Update the local "honest editor" comment to describe the
      new picker + raw CSS value shape.
- [ ] 2.2 Add upload buttons to theme image URL fields. Use
      `createRezicsUploadProvider` / `uploadApi.uploadImage` to obtain a URL and
      write it back to the field. Keep manual URL paste.

## 3. JSON View (`package/app`)

- [ ] 3.1 Add a JSON view toggle to zone manage. Current editing surfaces
      (page sections draft and `boundary`/`nav`/`theme` shell body drafts) use
      `RezicsJsonEditor`; both views share one draft, and invalid JSON locks the
      structured view.
- [ ] 3.2 Before save, run `Value.Check` against the corresponding envelope body
      schema and map TypeBox errors to CodeMirror lint diagnostics.
- [ ] 3.3 Add draft-layer tests: JSON view round-trips without dropping fields,
      invalid JSON locks structured editing, and envelope metadata cannot be
      injected through JSON (`schema`/`version` keys are stripped or rejected).

## Out of scope

- Redesigning the structured forms themselves. Keep the tab structure produced
  by `zone-shell-page-split.md`.
- IMAGE unit library/product work, media manager, and image cropping.
- Replacing color fields outside zone. Other features can adopt `ColorField`
  later.
- Schema-aware JSON autocomplete. Inline lint diagnostics are enough for this
  pass.
