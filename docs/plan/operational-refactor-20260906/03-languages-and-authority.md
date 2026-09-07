# P03 — Standard language tags, named forms and official provenance

Status: IANA consumption-language foundation implemented; named forms and authority pending. Date: 2026-09-06. Parent: [program and gates](README.md).

The [current schema milestone](00-source-complete-schema.md) requires the remaining
open metadata-language, identified named-form, translation/version and scoped
authority **database contracts now**. The completed parser is supporting work and
does not pass this source-schema gate. Source URLs and concrete counterexamples
are in the [schema report](../../report/REZICS-source-complete-catalog-schema-20260906.md).

## Outcome and evidence

Support cross-language discovery and distinguish original, authorized, unofficial and machine-generated representations without losing source detail. Supports U01/U07–U09.
The [language audit](../../report/REZICS-language-and-authority-audit-20260906.md) owns current line evidence and standards analysis. Owners include `libraries/content-language`, `libraries/i18n`, database language/localization/alias/search schemas, `apps/web/i18n`, content-language features, `apps/about`, source adapters and SDK.

## Selected contracts

- Persist canonical **BCP 47**, with a versioned IANA Language Subtag Registry validation/canonicalization policy. Case-insensitive matching and conventional casing are distinct from semantic aliasing.
- Do not use `Intl.Locale`/CLDR alone as the authority for stored content identity: structural acceptance is not registry validity, and CLDR mappings can collapse meaningful language distinctions. Use Intl/CLDR for display and UI negotiation through explicit adapters.
- Preserve language, script and region as actually known. `zh` is not automatically `zh-Hans`, `zh-Hant`, `zh-CN` or `zh-TW`; never use likely-subtag maximization as provenance.
- UI locale availability is a finite product choice; content languages are not restricted to that list. Source raw codes and mapping versions remain auditable.
- Represent unknown/unprovided independently. Standard `und`, `mul`, `zxx` and registered/private-use tags follow documented semantics, with private-use namespace provenance. Invalid tags are preserved in source evidence with unresolved mapping status, not silently replaced.
- Identified named forms/translation records allow multiple values in one language. Store text, name form/origin, scope, edition/content target, evidence and revision. Translation method (human/machine/mixed/unknown) and authorization are independent dimensions; an authorized machine-assisted translation is possible. A selected display value is a policy projection.
- **Officialness belongs to a scoped assertion about a named form, translation, release or language-support record.** Keep asserting source, authorizing Entity, relationship/role, territory/channel, time, exact target revision, evidence revision and review state. A changed target invalidates the old approval's applicability until re-evaluated.
- Source-reported official status can exist without known authorizing organization; display it as a source claim, not verified authorization. Absence of proof means unknown, not unofficial.
- Translator, publisher, licensor, source operator and uploader are distinct relationships. An official publisher credit alone does not prove every supplied name or language is official.

## Implementation slices

1. Build shared parsing/canonicalization fixtures from RFC/IANA and source counterexamples; pin registry version and introduce a reviewed registry-update command.
   Map source vocabulary before BCP 47 parsing. In the inspected VNDB schema, source `ta` means Tagalog and maps to `tl`, while `ck` maps to `chr`; ordinary public BCP 47 `ta` remains Tamil. Pin the source schema and mapping revision so changed upstream labels cannot silently reuse this rule.
2. Replace enum-limited content-language contracts and script-collapsing mappings. Keep provider-specific spelling only at adapter boundaries. About route keys may stay stable and map to canonical locale values.
3. Add identified named forms, translation derivations and language support per channel/edition. Connect officialness assertions through P01/P02, including multiple authorizers and partial scopes.
4. Replace existing localization/alias consumers with the new named-form contract. P11's separate offline tool converts old document/localization IDs, history keys and metric references; this is not a prerequisite for replacement. For selected imported records, collision groups retain original evidence rather than last-write-wins, and historical `zh` remains `zh` without evidence.
5. Replace fixed `text_zh`/`text_en`/`text_ja`-style search columns with owner projections that support open content-language tags. Update query fingerprints, URL negotiation, SSR/SEO, editor forms, source adapters and SDK. Keep current lookup fallback shared across server/client; separate lookup preference from factual content language.
6. Publish canonical response values and version the changed API/cursors. Accept old *supported v1+* inputs only through explicit normalization where semantically unambiguous; do not maintain parallel authoritative spellings.

## Acceptance

- Equivalent casing canonicalizes; script/region precision is retained; deprecated aliases use the pinned IANA policy; private-use tags remain scoped.
- Mandarin and Chinese macrolanguage are not merged by a UI convenience mapping.
- Two official names in the same language but different territories/editions coexist; preferred display does not delete either.
- Machine-translated text cannot acquire official status merely through language selection or trusted-source binding.
- A source reports official translation with no named authority: evidence is retained and status remains distinguishable from verified authorization.
- Revoking an authority claim changes its adoption/display, not historical source truth or original credit.
- Tests cover registry updates, roundtrip source values, collisions, mixed script search, SSR/client fallback and stale cursors.
- Run backend, affected frontend and SDK typechecks, content-language tests, i18n terminology/policy checks and source-mapping tests.

## Capacity

Count named forms, support entries and authority/evidence rows separately (not one per UI language). Paginate long name and language lists; replace 64-entry whole-object assumptions where source coverage requires growth. Index target/scope/language/role and source revision; cache registry/definition data by pinned version with bounded memory. P10 includes 500M/3B row estimates and update fan-out. No automatic index per arbitrary tag or full-corpus rewrite on registry refresh.

## Implementation ledger

The [content-language owner](../../../libraries/content-language/README.md) now
pins the IANA 2026-08-08 registry and its complete checksum, validates registration
and extlang prefixes, applies only IANA preferred values, preserves scripts/regions,
and retains scoped private-use identity. The existing consumption field uses this
boundary and rejects unscoped private use or locale-preference extensions.
Reads fail for values requiring conversion instead of silently returning a different
tag than the indexed stored fact. Both Search request-hash owners include the
language policy. A bounded read-only audit reports conversion/quarantine candidates.

Registry generation/checks and tests are part of root deterministic checks.
47 parser tests include every registered primary language, extlang prefix and
grandfathered/redundant tag; the combined backend/language/filter/fixture suite
passed 1,502 tests across 250 files. Backend, Web, library and API package types
passed. The local audit found
all 80 current language-support rows unchanged. Historical/filter/production audits,
VNDB vocabulary mapping, open metadata localization, named forms and revision-scoped
authority are not claimed complete by this slice.

The Web display adapter preserves the original tag when Intl would alias it to a
different identity or cannot represent a grandfathered tag. This avoids both a
misleading language name and a rendering exception. Eleven pure presentation,
model and route tests passed; Web TypeScript passed. No new translation claim or
rendered UX acceptance is inferred from that fallback.
