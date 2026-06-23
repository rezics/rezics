# Frontend AGENTS.md

## Code Style

- `components/ui/` are **generated files** from `@shark` registry — do not edit manually.
- Prefer **server components**; only use `"use client"` when browser APIs or state are needed.
- Pages using `nuqs` must split into server `page.tsx` + client `content.tsx` with `SectionBoundary`.
- URL search params use **nuqs** (`useQueryState`/`useQueryStates`).
- Rich text editing uses **@portabletext/editor**; display uses **@portabletext/react**.
- State management: **@effect/atom-react** only — no Zustand, Jotai, or SWR.
- Icons: **Lucide** only.
- CSS: **Tailwind v4** — no UnoCSS.
