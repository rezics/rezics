## Context

The platform uses a polymorphic `Unit` model as the base entity for all content types (BOOK, TAG, REALM, SHELF, etc.). Units are currently addressable only by UUIDv7. Tags and realms would benefit from human-readable slugs for clean URLs and discoverability.

Slug validation already exists in `@rezics/auth` (`package/auth/src/identity/slugValidation.ts`) for user profile slugs. It validates format, length, and a ~50-word reserved list. This logic is local to the auth package and cannot be reused by the server.

### Current state

```
@rezics/auth (auth DB)
  UserProfile.slug  ──  String @unique
  slugValidation.ts ──  validateSlug(), 50 reserved words
                        allows A-Z, length 6-32

@rezics/server (server DB)
  Unit.id           ──  UUIDv7 (only identifier)
  no slug field
```

### Target state

```
@rezics/contract (shared)
  slug.ts           ──  validateSlug(), RESERVED_SLUGS (~300+)
                        [a-z0-9-] only, length 6-36

@rezics/auth
  identity.api.ts   ──  import { validateSlug } from "@rezics/contract/slug.js"
  slugValidation.ts ──  DELETED

@rezics/server
  Unit.slug         ──  String? @unique
  unit.service.ts   ──  import { validateSlug } from "@rezics/contract"
```

## Goals / Non-Goals

**Goals:**
- Single source of truth for slug validation rules across auth and server
- Comprehensive reserved words list that protects all platform routes
- Slug field on Unit with type-gating and write-once semantics

**Non-Goals:**
- Cross-database uniqueness between user slugs and unit slugs
- Slug support for unit types other than TAG and REALM
- Frontend slug-based routing (future work)

## Decisions

### 1. Slug field on Unit table (not extension tables)

**Choice:** Add `slug String? @unique` directly to the `Unit` model.

**Alternatives considered:**
- *Create a Tag extension table with slug* — Tag currently has no extension table. Creating one just for slug adds a join for every tag query and breaks the pattern that slug is a cross-type concern.
- *Separate slug lookup table* — Adds indirection without benefit when only 2 types use it.

**Rationale:** Slug is conceptually a unit-level identifier (like `id`). Placing it on Unit with a unique index gives the simplest query path (`WHERE slug = ?`) and naturally enforces global uniqueness. The cost is nullable columns on non-TAG/REALM rows, which is negligible.

### 2. Application-layer type gating (not database constraint)

**Choice:** Enforce "only TAG and REALM can have slugs" in the service layer, not via database triggers or check constraints.

**Rationale:** Prisma does not support check constraints natively. A raw SQL check constraint would work but adds migration complexity and is invisible to the ORM. Since all slug writes go through the unit service, application-layer enforcement is sufficient and easier to maintain. A defensive database constraint can be added later if needed.

### 3. Write-once enforced in service layer

**Choice:** When a non-admin user attempts to update a slug that is already set, the service returns a forbidden error.

**Logic:**
```
if (unit.slug !== null && !isGlobalAdmin(caller)) {
  throw new ForbiddenError("Slug cannot be modified once set")
}
```

### 4. Lowercase-only, max 36

**Choice:** Reject uppercase input rather than auto-lowercasing.

**Rationale:** Auto-lowercasing creates a gap between what the user typed and what was stored. Explicit rejection is clearer — the frontend can show format hints. The `normalized` field in the validation result will still lowercase+trim for the check-slug availability endpoint (preview what it would become), but the confirm endpoint rejects non-lowercase input.

**Update:** After discussion, auto-lowercase is preferred for better UX. The `validateSlug` function will normalize input to lowercase and return the normalized form. Both auth and server endpoints will use the normalized value.

**Max length 36** aligns with UUIDv7 string length, giving ample room without absurd slugs.

### 5. Shared validation in @rezics/contract

**Choice:** Move `validateSlug` to `@rezics/contract/src/slug.ts` with the full reserved words list. Export both the function and a Typebox `slugSchema` for use in route definitions.

**Structure:**
```
@rezics/contract/src/
  slug/
    reserved.ts     ── RESERVED_SLUGS: ReadonlySet<string>
    validate.ts     ── validateSlug(), SlugValidationResult
    schema.ts       ── Typebox slugSchema with pattern + length constraints
    index.ts        ── re-exports
```

### 6. Reserved words: self-maintained comprehensive list

**Choice:** Maintain a ~300-word reserved list in the codebase, categorized for readability.

**Categories:**
- Platform routes: `tag`, `tags`, `realm`, `realms`, `book`, `books`, `shelf`, `search`, `explore`, `feed`, `trending`, `discover`
- Auth/account: `login`, `logout`, `signup`, `register`, `account`, `settings`, `password`, `profile`
- Roles/identities: `admin`, `moderator`, `staff`, `support`, `official`, `system`, `root`
- Technical: `api`, `graphql`, `assets`, `static`, `cdn`, `webhook`, `callback`, `oauth`
- Navigation: `help`, `docs`, `about`, `terms`, `privacy`, `contact`, `pricing`, `billing`
- Common confusable: `me`, `you`, `null`, `undefined`, `test`, `example`, `anonymous`, `deleted`
- Brand: `rezics`

**Alternatives considered:**
- *npm package (reserved-usernames, the-big-username-blacklist)* — All unmaintained (last updated 2019). The lists are generic and miss platform-specific terms. Forking a static word list is equivalent to writing our own.

## Integration points

```
                    ┌──────────────────┐
                    │ @rezics/contract │
                    │   slug/          │
                    │   ├─ reserved.ts │
                    │   ├─ validate.ts │
                    │   └─ schema.ts   │
                    └────────┬─────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
     ┌────────────┐  ┌────────────┐  ┌────────────┐
     │ @rezics/   │  │ @rezics/   │  │ @rezics/   │
     │ auth       │  │ server     │  │ app        │
     │            │  │            │  │            │
     │ identity   │  │ unit.svc   │  │ tag/realm  │
     │ .api.ts    │  │ tag.api.ts │  │ slug input │
     │ (user slug)│  │ realm.api  │  │ UI         │
     └────────────┘  └────────────┘  └────────────┘
```

## Risks / Trade-offs

- **[Nullable slug on all units]** → Most Unit rows will have `slug = NULL`. This is a minor storage overhead and a semantic mismatch. Mitigation: the unique index is partial (NULLs are excluded from unique checks in PostgreSQL), so no performance impact.
- **[Application-only type gating]** → A direct SQL `INSERT` could bypass the TAG/REALM restriction. Mitigation: no external actors write to the DB directly; all writes go through the Elysia service layer.
- **[Reserved list maintenance]** → The list may miss new routes added in the future. Mitigation: document in the reserved list file that new platform routes should be added here. A comment at the top serves as a reminder.
- **[Auth ↔ contract dependency]** → `@rezics/auth` gains a dependency on `@rezics/contract`. Mitigation: this dependency already exists (auth already imports from contract for schema types).

## Migration Plan

1. **Add `slug` column** — `ALTER TABLE "Unit" ADD COLUMN "slug" TEXT UNIQUE` via Prisma migration. Nullable, no backfill needed.
2. **Deploy contract changes first** — The shared validation module has no runtime dependencies, safe to merge independently.
3. **Deploy auth refactor** — Swap import from local to contract. Behavior is identical; this is a pure refactor.
4. **Deploy server endpoints** — New slug set/lookup endpoints. No breaking changes to existing APIs.
5. **Rollback** — Drop the `slug` column if needed; no other data depends on it.
