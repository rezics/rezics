# @rezics/about

Static public about/product site for `about.rezics.com`.

Long-form page copy lives in localized MDX files under `src/content/<locale>/`.
Short navigation, footer, and button strings live in `src/i18n/ui.ts`.

## Commands

```bash
bun --filter=@rezics/about run dev
bun --filter=@rezics/about run build
bun --filter=@rezics/about run preview
bun --filter=@rezics/about run test
```

## Cloudflare Pages

- Project path: `package/about`
- Build command: `bun run build`
- Build output directory: `dist`
- Custom domain: `about.rezics.com`

This package is static-first. It does not require Workers bindings, auth,
database access, or shared app runtime state. `rezics.com` and
`book.rezics.com` remain product origins; the about site links users into those
origins for interactive catalog workflows.

The site uses Astro static output with MDX page sources. Visual storytelling is
implemented with Astro components and CSS rather than exported image assets.
