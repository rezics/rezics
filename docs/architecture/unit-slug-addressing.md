# Unit slug addressing

Status: Accepted

Owners: Main Service and Web

## Decision

A Unit ID is the immutable identity of a Unit. A slug address is an optional,
mutable, human-facing address that resolves to that identity. Slugs improve
navigation and presentation; they do not replace IDs in stored relationships,
authorization, mutations, cache identities, or document references.

The database-backed address registry remains the authority for canonical and
redirect addresses. This contract does not add another slug store.

## Terminology

- `unitId`: the globally unique UUIDv7 identity of a Unit.
- `slug`: one validated label within a scope.
- `scopeUnitId`: the Unit ID of the label's direct namespace or parent. It is
  address containment, not an ownership or authorization claim.
- `canonicalPath`: the complete current backend path, including its top-level
  namespace, for example `users/alice` or `users/alice/favorites`.
- `slugAddress`: the public, atomic projection of `slug`, `scopeUnitId`, and
  `canonicalPath`, or `null` when no public canonical address is available.

## Invariants

- Persist Unit relationships, Block and Portable Text references, navigation
  references, authorization subjects, mutation targets, and query cache
  identities by Unit ID.
- A canonical slug address is optional. APIs must represent absence explicitly
  as `slugAddress: null`; they must not publish a slug without its direct scope
  and canonical path.
- Only canonical addresses are projected in ordinary resource responses.
  Redirect address IDs and other registry internals remain administrative.
- Frontend-visible resource summaries that can render a Unit link should carry
  both the Unit ID and its nullable slug address. Backend presenters do not
  construct frontend URLs.
- Localized titles and names remain display copy. A slug may be shown as a
  handle where the product calls for one, but it does not replace localized
  content.

## Lookup contract

Read APIs may provide two explicit lookup forms:

```ts
type UnitLookup =
	| { readonly by: "id"; readonly unitId: string }
	| {
			readonly by: "slug";
			readonly scopeUnitId: string;
			readonly slug: string;
	  };
```

An endpoint must not infer `idOrSlug` from one string. A valid slug can resemble
a UUID, and the two inputs carry different proof obligations.

When an ID and slug are both known, reads use the ID. Writes remain ID-addressed
except for dedicated slug-management commands. A scoped lookup receives only
the direct `scopeUnitId` and `slug`; UUID uniqueness makes ancestor IDs
unnecessary for locating the direct namespace. The backend must still validate
the target kind, requested scope ancestry, visibility, and object-level
authorization before returning the target.

Cold browser navigation still resolves the complete public path because a URL
does not contain the direct scope UUID. After resolution, feature data is loaded
and cached by Unit ID.

## Public route contract

The compile-time route manifest in `@rezics/slug` is the executable authority
for enabled mappings. Backend namespace labels remain plural; frontend
canonical segments are singular.

| Backend namespace | Canonical prefix | Short prefix | Target  | Status  |
| ----------------- | ---------------- | ------------ | ------- | ------- |
| `users`           | `/user`          | `/u`         | Profile | Enabled |
| `realms`          | `/realm`         | `/r`         | Realm   | Enabled |
| `zones`           | `/zone`          | `/z`         | Zone    | Enabled |

Long slug routes are canonical. Short routes permanently redirect to the long
route. A retained public former slug permanently redirects to the current
canonical route and therefore must not later be reassigned to another Unit.
An ID route remains the fallback for an unaddressed Unit and continues to load
the resource by ID.

Candidates such as Collection `/collection` and `/c`, Entity `/entity` and
`/e`, Tag `/tag` and `/t`, Post `/post` and `/p`, Poll `/poll` and `/q`, Book
`/book` and `/b`, Software `/software` and `/s`, Media `/media` and `/m`, Review
`/review` and `/rv`, and Series `/series` and `/sr` are not enabled or reserved.
Adding a candidate to documentation must not install a namespace or route.

## Collections and Favorites

Top-level Collection slug routing is disabled. Favorites remains ID-addressed
unless a separate decision enables a public, shareable address.

If enabled later, the system Favorites Collection uses slug `favorites`
directly under its owning Profile Unit:

```text
scopeUnitId = ownerProfile.id
canonicalPath = users/{profileSlug}/favorites
```

It renders as `/user/{profileSlug}/favorites` and
`/u/{profileSlug}/favorites`, never through `/collection` or `/c`. Future
user-owned Collection slugs follow the same Profile-scoped policy. User-scope
route labels such as `content`, `favorites`, `following`, `settings`, `edit`,
and `new` must be reserved from arbitrary child addresses; `favorites` may only
target that Profile's system Favorites Collection.

## Assignment contract

- A signed-in Profile may assign or rename only its own label in `users`.
- A Realm settings authority may assign or rename that Realm only in `realms`.
- A Zone update authority may assign or rename that Zone only in `zones`.
- Callers provide a label, never a scope, for these resource-specific commands;
  the backend fixes and proves the namespace.
- Staff commands cannot move an enabled Profile, Realm, or Zone outside its
  fixed public namespace; otherwise an ID response and browser route could
  disagree about its canonical address.
- Other kinds and namespace operations remain staff-governed. There is no
  public Collection or Favorites assignment command while those routes are
  disabled.

## Lifecycle and security

- Slugs are explicitly assigned; localized titles do not silently generate or
  rename addresses.
- An unaddressed Unit remains ID-only. After a public address is assigned it may
  be renamed, but not removed; this preserves link durability.
- Renames retain the former address. Public retained addresses are permanent
  and cannot be released for reuse.
- Public path and scoped lookup return not found for an unavailable scope,
  target, wrong target kind, or unauthorized resource without disclosing which
  check failed.
- UUIDs and hard-to-guess slugs are not authorization. Every resolved Unit goes
  through the same object-level authorization policy as an ID lookup.
- Address changes invalidate Unit-ID projections, the old path, the new path,
  and affected ancestor-path projections.

## Required verification

- The route manifest has unique backend, canonical, and short prefixes.
- ID and scoped-slug reads resolve to the same Unit and response contract.
- Wrong-scope and wrong-kind lookups fail without cross-resource disclosure.
- Nested direct-scope lookup works without ancestor IDs while full-path lookup
  still validates every public ancestor.
- Canonical, former-slug, short, and ID-fallback routes behave as documented.
- Stored content references remain ID-based while their rendered links prefer
  an enabled canonical slug address.
