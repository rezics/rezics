# REZICS

_inherited · create · spread_

REZICS is a community-driven, cross-language catalog of works. Communities form
around shared interests, classify and discuss the works they care about, and
keep a work's index, discussion, and collective knowledge together.

Everything — books, games, media, posts, shelves, tags, and realms — is modeled
as a unified `Unit`, allowing the same catalog, classification, attribution, and
social layers to work across content types and languages.

## Repository structure

```text
apps/
├─ web/                              # Main Vinext/React application
└─ about/                            # Static multilingual Astro site

services/
└─ main/                             # Elysia/srvx API and recommendation worker

libraries/
├─ i18n/                             # Internal localization library
├─ portable-text/                    # Internal Portable Text contracts
├─ ui/                               # Internal shared UI
└─ services/main/
   ├─ openapi/                       # Main-service API contract
   ├─ openapi-fetch/                 # Generated Fetch client
   └─ openapi-tanstack-query/        # Generated TanStack Query client

packages/
└─ brand/                            # Public @rezics/brand package
```

`apps/` and `services/` contain deployable units. `libraries/` contains private
workspace libraries. `packages/` contains externally consumable packages and
must not depend on private libraries, applications, or services.

## Development

The root workspace uses Node.js 26, Yarn 4, Go Task, PostgreSQL 18 with
PGroonga, and S3-compatible object storage. Use the repository's devenv/direnv
environment or provide compatible tools locally.

```sh
yarn install --immutable
yarn task services:up
yarn task dev
```

The main checks are:

```sh
yarn task format:check
yarn task openapi:check
yarn task typecheck
yarn task test
yarn task apps-web:build
yarn task apps-about:build
```

OpenAPI documents and generated clients are updated through
`yarn task openapi:generate` and should not be edited by hand.
`libraries/ui` contains both local components and the tracked SharkUI mirror;
preserve that upstream boundary.

The about site is deployed independently to Cloudflare Pages from the
`about-v*` tag or a manual workflow dispatch.
