# REZICS

*inherited · create · spread*

The name draws from reincarnation — not in a mystical sense, but in its 
simplest idea: what is made, learned, or loved does not vanish. It finds 
new form, passes to new hands, and grows.

REZICS is built on that premise. We want to be a community where knowledge 
and creativity are freely inherited, remixed, and passed forward — so that 
everyone can pursue what they genuinely love, together.

## What it is

Rezics is a community-driven, cross-language catalog of works. Realm based 
community — form around shared interests and collectively classify and discuss
the works they care about, so a work's index, its discussion, and its collective
knowledge live in one place instead of three.

It is a full-stack TypeScript monorepo. Everything — books, games, media, posts,
shelves, tags, realms — is modeled as a unified `Unit`, so the same catalog,
classification, attribution, and social layers work across content types and
languages.

## Why

Engaging with a single work today means bouncing between disconnected places:

- **Indexability** — modern, born-digital works (web comics, web novels,
  serialized and indie titles) fall outside traditional catalogs.
- **Language fragmentation** — each language keeps its own partial database; the
  same work has separate, unlinked entries with no shared cross-language
  identity.
- **Ecosystem fragmentation** — the catalog, the community (forums, chat), and
  the wiki live on different platforms; the wiki may not even exist, and you
  rarely know where to look.

Rezics gives any work one cross-language identity and co-locates the community
and the collaborative knowledge around it. AI translation lowers the language
wall, but it is an enabler — the core is identity, classification, and
co-location.

## How it works

- **Collective classification, not editorial** — a global tag vocabulary anyone
  can vote on, plus *realm*-scoped tag votes on individual works layered over it.
  Each community can classify a work in its own terms without forking the shared
  vocabulary, resolving the "same word, different meaning across communities"
  problem.
- **Realms as the community unit** — people gather around what they love; a realm
  is both the place discussion happens and the carrier of collective
  classification. It is the bridge between the library and its communities.
- **Shelves that explain themselves** — each saved work is paired with the
  curator's review, so browsing a shelf tells you *why* something was collected,
  making it easy to judge whether a work is for you.
- **Reading & authoring built in** — a native ebook reader (`@rezics/folio`) and
  a CodeMirror-based content editor (`@rezics/editor`).

## Stack

A service-oriented backend — an Elysia API (`@rezics/server`) plus standalone
auth, history, job-runner, and preview services, with Drizzle/PostgreSQL,
Meilisearch search, and a React + Vite frontend (`@rezics/app`).

Runtime and package manager: **Bun**. Workspaces live under `package/*`. See
`AGENTS.md` and `CONTRIBUTING.md` for architecture and setup.

## Docs

The `Docs` folder is for manually written documentation, while the `tsDocs`
folder stores automatically generated documentation.
