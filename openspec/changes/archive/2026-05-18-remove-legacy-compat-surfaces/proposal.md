## Why

The repository is still in active development, but several migration-era
surfaces remain in active code: old-name exports, no-op props, retired query
stubs, forwarding helpers, and comments that describe transition behavior as if
it were still supported.

These paths keep stale vocabulary alive and make callers ambiguous. Cleaning
them now keeps the internal API surface small and lets TypeScript expose any
remaining callsites instead of hiding them behind forwarding wrappers.

## What Changes

- Remove migration-era stubs, old-name exports, and no-op transition props
  from active packages.
- Update internal callsites to import or call the current canonical APIs
  directly.
- Keep normal runtime fallbacks such as i18n fallback text, SSR defaults,
  avatar fallbacks, and external protocol requirements.
- Keep archived OpenSpec history untouched; only active code and active specs
  are cleaned.

## Impact

- Affected packages:
  - `package/api`: retired Meili query and mapper stubs are removed.
  - `package/app`: route object imports and retired search callsites move to
    current APIs.
  - `package/contract`: old helper exports are removed.
  - `package/ui`: ignored transition props are removed.
  - `package/server`: stale helper surfaces and comments are cleaned
    where they are active code.
- Cutover:
  - This is a breaking development-stage cutover. No forwarding wrappers,
    old-name exports, or paired read/write paths are retained for internal
    callers.
