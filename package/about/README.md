# @rezics/about

Static public about/product site for `about.rezics.com`.

Page structure lives in Astro templates. Localized short copy lives in JSON
files under `src/content/locale/<locale>/`; each locale has `common.json`,
`home.json`, and `product.json`. Long prose lives in Markdown fragments under
`src/content/markdown/<locale>/<page>/<slug>.md`.

Keep JSON for metadata, navigation, CTA labels, headings, product rows, and
short section text. Use Markdown fragments for multi-paragraph prose only; do
not put layout directives in Markdown.

## Commands

```bash
task about:dev
task about:build
task about:preview
task about:test
```

## Cloudflare Pages

- Project path: `package/about`
- Build command: `bun astro build` (Pages-native build runs in `package/about`;
  no per-package script, so invoke Astro directly)
- Build output directory: `dist`
- Custom domain: `about.rezics.com`

This package is static-first. It does not require Workers bindings, auth,
database access, or shared app runtime state. `rezics.com` and
`book.rezics.com` remain product origins; the about site links users into those
origins for interactive catalog workflows.

The site uses Astro static output with fixed page templates, slug-matched JSON
and Markdown content, and the shared Rezics UnoCSS design token config.
