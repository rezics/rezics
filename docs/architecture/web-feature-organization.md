# Web feature organization

Status: Accepted

Owner: Web

## Decision

Organize Web application code by business capability first. A feature starts
flat and introduces role directories only when its implementation has distinct
responsibilities that benefit from separation. Do not apply a complete folder
template to every feature in advance.

The App Router remains a framework adapter. Route entries under `apps/web/app`
may validate framework inputs, invoke routing control flow, declare route
configuration or metadata, and delegate to feature-owned pages. Page
composition and feature behavior remain under `apps/web/features`.

This is a progressive convention. Existing features migrate when they are
being changed and have reached the structural triggers below. Do not perform a
repository-wide path-only migration.

## Structural triggers

Keep a feature flat while its files have one clear responsibility and remain
easy to scan. Introduce structure when one or more of these conditions apply:

- The feature contains two or more route-level pages.
- A file implements more than one page, flow, or independently named UI
  responsibility.
- UI, remote-data coordination, pure domain logic, routing, or server-only code
  have become separate concerns.
- A feature has enough files that names and ownership are no longer apparent
  from one directory listing.
- A file's size or change frequency makes unrelated responsibilities collide.

File count and line count are review signals, not hard limits. A small feature
with cohesive files may remain flat; a feature with only a few files may still
need structure when those files belong to distinct runtime or architectural
roles.

## Optional role directories

Create only the directories that the feature currently needs:

| Directory     | Responsibility                                                                                                                 |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `pages/`      | Route-level screen composition delegated to by `apps/web/app`. Keep one exported page responsibility per file.                 |
| `components/` | Feature-owned UI components and forms that are not route entries.                                                              |
| `hooks/`      | React hooks that name and own a meaningful stateful lifecycle or reusable coordination rule.                                   |
| `data/`       | Remote-data orchestration, query options, mutations, cache invalidation, and feature data selectors.                           |
| `model/`      | Framework-independent domain types, policies, state transitions, and transformations.                                          |
| `routing/`    | Typed URL construction, route-state parsers, and address helpers.                                                              |
| `server/`     | Server-only feature operations and resolvers. Use an explicit `.server.ts` suffix where it makes the boundary easier to audit. |

Do not create catch-all `utils/` or `types/` directories. A helper or type stays
next to its owner unless it expresses a feature-wide domain concept, in which
case it belongs in `model/` or another specific role.

Do not create a custom hook merely to forward one generated query or mutation
hook. The new hook must own a reusable lifecycle, derived state, cache policy,
or coordination rule.

## Dependency direction

Use these default dependency directions inside a structured feature:

```text
app adapter -> pages
pages       -> components | hooks | data | model | routing
components  -> hooks | data | model | routing
hooks       -> data | model
data        -> model
server      -> data | model
```

- `apps/web/app` imports feature pages or narrowly scoped server/routing
  adapters and does not contain ordinary feature implementation.
- Pages may compose their feature's lower layers and explicit reusable modules
  from other features.
- Components and hooks must not import pages.
- Data modules must not import UI components.
- Model modules must not depend on React, the App Router, or client data hooks.
- Client-reachable modules must not import server-only modules.
- Cross-feature dependencies use the `@/features/<capability>/...` alias;
  imports within one feature use relative paths.
- Import concrete modules directly. Do not add broad `index.ts` barrels that
  obscure dependencies or combine client and server module graphs.
- A lower-level module must not create a cross-feature dependency cycle. Move
  orchestration upward to a page or application-shell owner, or extract the
  genuinely shared concept to its proper owner.

These are defaults rather than permission to create pass-through abstractions.
Every extracted module must own a recognizable responsibility, invariant, or
lifecycle.

## Naming and tests

- Use kebab-case file and directory names.
- Name route-level feature components `*-page.tsx`.
- Name hooks `use-*.ts` or `use-*.tsx`.
- Keep unit tests, fixtures, and mocks beside the implementation they verify:
  `thing.ts`, `thing.test.ts`, `thing.fixture.tsx`, and `thing.mock.ts`.
- Introduce a feature-local `testing/` directory only when several different
  modules share the same testing support.
- Preserve explicit `.server.ts` and `.client.tsx` suffixes when they communicate
  a real runtime constraint; a directory name does not replace runtime
  directives or server-only enforcement.

## Reference feature

[`apps/web/features/following`](../../apps/web/features/following) is the
reference implementation:

```text
following/
├── components/
│   └── follow-button.tsx
├── data/
│   └── following-cache.ts
├── pages/
│   └── following-page.tsx
└── routing/
    ├── following-route.ts
    └── following-route.test.ts
```

The absence of `hooks/`, `model/`, and `server/` is intentional. Add one of
those directories only after the feature owns code with that responsibility.

## Growth beyond role directories

When one role directory itself becomes difficult to scan, group it by a named
sub-capability such as `moderation`, `membership`, or `settings`. Do not add a
generic extra nesting level. A sub-capability should describe product behavior,
not merely a file type.

If two existing features depend on each other, treat them as one migration
problem. Moving the same files into role directories does not resolve the
ownership cycle.

## Migration procedure

When a touched feature crosses a structural trigger:

1. Identify the feature's pages, UI components, data coordination, pure model,
   routing, and runtime-specific code.
2. Create only the role directories required by those responsibilities.
3. Split multi-responsibility files; do not only relocate an oversized
   aggregate file.
4. Update internal and external imports in the same change. Do not leave
   compatibility re-export files for old internal paths.
5. Keep behavior and type contracts unchanged unless the task explicitly
   includes a behavioral change.
6. Run the affected unit tests and the Web workspace TypeScript check.

## Rationale

React recommends decomposing components as their responsibilities grow, while
Next.js intentionally leaves project organization open and supports keeping
application code outside `app`. Feature-first ownership keeps code that changes
together close together; optional role directories add navigation only after
they carry useful information.

References:

- [React: Thinking in React](https://react.dev/learn/thinking-in-react)
- [Next.js: Project structure and organization](https://nextjs.org/docs/app/getting-started/project-structure)
- [Redux style guide: Structure files as feature folders](https://redux.js.org/style-guide/#structure-files-as-feature-folders-with-single-file-logic)
- [TanStack Query: Query options](https://tanstack.com/query/v5/docs/framework/react/guides/query-options)
