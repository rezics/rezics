# Offline curated showcase conversion

Run this only against the committed pre-cutover fixture checkout and a separate output worktree. It is an offline, deterministic artifact conversion; the application loader has no old-format adapter. Neither database nor network operations are performed. Loopback-only placeholder configuration is used solely to import the canonical validators.

```powershell
bun services/main/scripts/convert-showcase-native.ts --from D:/rezics-repos/rezics-showcase-packs --to D:/rezics-repos/rezics-showcase-packs-native-20260908
```

The source checkout is read-only. The destination must be distinct; only known generated pack documents are replaced there. Source snapshots, locked provenance, rights declarations, and other authored files remain. Existing chapter documents retain their individual files. Every original resource retains its UUID and source key. New Works use a deterministic, domain-separated fixture UUID derived from the source key. The conversion report records the source Git commit, dirty state, owner/shape decisions, original and converted object hashes, every added identity, and unchanged authored-text hashes.

The current reviewed mapping is concrete to these five curated packs:

- Toaru: 68 evidenced bibliographic publications; 67 separate volume Works. The 24-volume electronic omnibus covers those known Works and no longer pretends to be an authored chapter structure. ISBNs and dates become native identifiers/publication events.
- Xu Zhimo: 23 authored TextVersions retain all 389 chapters and cover 23 named Works. The collection stays a platform Collection; the catalog series becomes an ordered Grouping.
- Red Chamber: the actual 120-chapter corpus and two named textual traditions become three TextVersions covering one Work. No extra Publication is invented.
- Light novels: six work-level titles become Works, with no invented edition or text-version layer.
- VNDB: one software Content, seven explicitly distinguished Versions, 65 Releases with actual content components, and the existing native Entities. Thirty groups of measurements become numeric facts with explicit units. The old unscoped `verified` flags are retained only in the conversion report; they grant no canonical trust or account authority.

Old Series memberships become native Grouping relationships with an order profile. Their source release dates qualify the exact relationship rather than creating a property definition per member. Required native structure fields are parsed through the owning schemas. Filter documents use owner/shape addressing. Source-dependent future generator rebuilds must be regenerated into a separate source checkout and converted again; running an old generator directly over the reviewed output would replace its contract.

The application acceptance command after integrating this converter's companion loader change is:

```powershell
# In the configured REZICS service environment, against the intended disposable local target:
bun services/main/scripts/showcase-fixtures.ts plan --from D:/rezics-repos/rezics-showcase-packs-native-20260908
bun services/main/scripts/showcase-fixtures.ts apply --from D:/rezics-repos/rezics-showcase-packs-native-20260908
bun services/main/scripts/showcase-fixtures.ts verify --from D:/rezics-repos/rezics-showcase-packs-native-20260908
```

These commands do not reset a database. The loader refuses partial reconciliation. Inspect the concrete target and choose a disposable fresh target before the apply step; do not expand this conversion into a reset of unrelated local data.
