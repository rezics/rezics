## Why

The ContentDoc cutover changed `User.description` and `UnitTranslation.description` from plain strings to rich `ContentDoc` JSON, but new seed data and several create paths can still persist JSON string values. This now breaks response validation on fresh seed data, starting with `PostDTO.author.description`, and the same mismatch can surface anywhere descriptions are returned through DTO contracts.

## What Changes

- Complete the rich-description cutover so every server-owned write path persists `User.description` and `UnitTranslation.description` as `ContentDoc` or `null`, never as JSON strings.
- Update factory and infrastructure seeds to emit `ContentDoc` for user profile descriptions and unit translation descriptions.
- Align remaining create/update contracts and services that still accept string descriptions for rich-description fields.
- Add a database repair path for development databases that already contain JSON string values after running the latest seed.
- Add response-shape coverage so seeded users, post authors, and translated units validate against the public contract schemas.
- **BREAKING**: Rich description write inputs that model canonical `User.description` or `UnitTranslation.description` will use `ContentDoc` payloads rather than plain strings, except for any intentionally UI-specific adapter that wraps user-entered markdown before calling the canonical API.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `markdown-user-description`: Require all canonical server write paths, seeds, and repair scripts for rich descriptions to persist `ContentDoc` or `null`, and require public DTO responses to expose that same shape.

## Impact

- Affected packages: `package/contract`, `package/server`, `package/search`, and focused fixtures/tests in `package/app` or `package/api` only where they encode canonical DTO shapes.
- Affected data: development PostgreSQL rows where `jsonb_typeof("User"."description") = 'string'` or `jsonb_typeof("UnitTranslation"."description") = 'string'` need one-time wrapping into `ContentDoc`.
- Affected APIs: create/update payloads for user and unit translation descriptions remain rich `ContentDoc` at canonical boundaries; realm, shelf, entity, and other unit-backed creation flows must stop forwarding plain strings into `UnitTranslation.description`.
- Backward compatibility: this project is still in development and uses clear cutovers for internal schema changes. No long-lived compatibility API for plain string rich descriptions is introduced.
