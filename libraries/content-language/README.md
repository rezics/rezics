# Content language identity

Content-consumption tags use the pinned IANA Language Subtag Registry, independently
of the finite UI locale list. Version 1.1 changes the earlier Intl/CLDR contract:
`cmn` remains Mandarin, `zh` remains the Chinese macrolanguage, and explicit scripts
and regions are retained. No likely-subtag expansion or Suppress-Script removal
is applied. Only IANA Preferred-Value mappings change deprecated identities;
registered extlangs must have an allowed prefix before canonicalization.

`canonicalizeContentLanguageTag` is the current unscoped Resource/API language boundary. It
rejects unregistered subtags, malformed tags, repeated variants, locale extensions
and unscoped private use. `parseContentLanguageTag` additionally accepts private
use with an explicit namespace and returns that namespace alongside the tag.
Consumers must use the complete scoped result as private-use identity. Namespace
text and registry validity do not establish source provenance or officialness.
Extensions such as Unicode calendar/collation preferences may be valid BCP 47
syntax but are not admitted as content-language identity by this policy.

Unknown/unprovided is represented by absence in the owning contract. It is not
automatically converted to `und`, `mul`, `zxx`, or the UI language. Those three
registered tags retain their own meanings. Historical grandfathered tags with no
preferred replacement remain addressable. The 64-entry consumption-support field
bound remains; identified names and source/edition language support are separate
P03 work and must not inherit that bound as a lifetime catalog limit.

## Registry updates

The committed raw registry is 2026-08-08, 9,296 records, SHA-256
`be21e91b6851f750a7b1a687f11209d46ad5a8471d6b10a1efc8d1dac4c8a926`.
The generated lookup is 56,226 bytes; the 731,799-byte raw source is build evidence,
not a browser runtime dependency. The generator rejects more than 50,000 records
or 10 MB, unknown record types, duplicate identities and unreviewed ranges.
Runtime work depends on a tag's 255-character bound and fixed registry lookups,
not the number of catalog rows. No database column/index or corpus rewrite is
introduced by a registry update.

Download the [IANA registry](https://www.iana.org/assignments/language-subtag-registry/language-subtag-registry)
to an operator scratch file, review its changes and hash, then run from the repo root:

```text
node libraries/content-language/scripts/update-registry.ts --update <file> <sha256>
task libraries:content-language:test
task libraries:content-language:typecheck
```

`--check` regenerates in memory and compares the formatted output to the committed
lookup. Root tests include this check. No runtime fetch or local hand-maintained
language allowlist is used. The policy identity includes the algorithm revision,
registry date and complete checksum. Search request hashes bind that identity.

## Deployment and preservation

Before deploying this stricter writer/reader, run the backend's
`scripts/audit-content-language-support.ts` with a read-only
`DATABASE_INVENTORY_URL`. Each call reads at most 1,001 rows using the owner UUID
index, emits at most 1,000 dispositions and a continuation key, and writes nothing.
Repeat under the P11 snapshot/freeze contract. Current rows requiring conversion
or quarantine retain their original values in the report. Use canonical owner
commands for reviewed conversion; do not silently rewrite stored values during
reads or infer lost script precision from prior CLDR output.

The local `rezics-dev` audit scanned all 80 current support documents: 80 unchanged,
no conversion/quarantine findings. Historical revision slots, source vocabularies,
production values and stored filter documents require their own audit before
production activation. No successful current-row audit proves those other sets.

Some current metadata consumers still use the seven-value localization enum; this
parser alone does not replace them. The [target language contract](../../docs/architecture/content-language-support.md)
requires open content-language identity and independently versioned entries;
the existing 64-entry guard is not a lifetime vocabulary/name limit. Named-form
identity, scoped authority and VNDB-specific vocabulary mapping keep their owners. In particular, public BCP 47 `ta` means Tamil; a source using it for
Tagalog must map its pinned vocabulary before invoking this boundary.

References: [RFC 5646](https://www.rfc-editor.org/info/rfc5646/),
[BCP 47 syntax parser](https://github.com/wooorm/bcp-47).
