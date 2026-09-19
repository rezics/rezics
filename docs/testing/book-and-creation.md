# Book and general creation acceptance

Owner: M05. Use [native creation contracts](../architecture/database/creation.md). The following are required behavior cases, not passed tests. Book is the first complete backend journey; original and transformative works use the same native system.

The [cross-domain Work matrix](native-work.md) and [composition operation matrix](content-composition.md) also apply. Passing this Book journey does not define Work for music, audiovisual, game/software or mixed-media content.

| Case | Required behavior |
| --- | --- |
| BOOK01 | Create an original work with no fabricated source Work/fandom; edit metadata and publish content through produced IDs. |
| BOOK02 | Draft, publish r1, edit private r2, adopt r1 elsewhere, publish r2 and independently advance adoption. |
| BOOK03 | Add/reorder/reuse chapters across structures with local titles/credits and complete versus planned chapter counts. |
| BOOK04 | Read, resume and complete against an exact content/structure version; changed order produces mapped or unknown progress. |
| BOOK05 | Link one or several source works/fandoms for fanwork/crossover while preserving relationship type and context. |
| BOOK06 | Add characters and appearances with explicit Work/expression/canon scope; ambiguous imported names remain unresolved. |
| BOOK07 | Add romantic, platonic and multi-party relationship declarations in a story; do not promote them to universal canon facts. |
| BOOK08 | Query inclusive/exclusive tags, characters, relationships, fandoms, languages and completion with bounded pagination. |
| BOOK09 | Preserve rating, unknown/not-rated, explicit warnings, no-applicable-warning and warning-nondisclosure as distinct meanings. |
| BOOK10 | Co-create with independent credits and editing authority; revoke one editor without erasing contribution history. |
| BOOK11 | Use pseudonyms/anonymous public presentation while preserving allowed private accountability and preventing actor leaks. |
| BOOK12 | Translate, adapt, remix or mark inspiration with exact known source/derivation; no automatic author endorsement or rights grant. |
| BOOK13 | Organize series, public/private collections, gifts/dedications and creative event submissions with their own roles and lifecycle. |
| BOOK14 | Comment/reply, subscribe, react and receive notifications; moderation/privacy propagates to every read surface. |
| BOOK15 | Keep bookmarks/favorites/notes private unless explicitly published; account erasure respects each domain. |
| BOOK16 | Attach multilingual/multi-release artwork, document files and audiovisual content; select contextual covers without losing origin. |
| BOOK17 | Export and reimport an elected portable content format with chapter order, credits, language and allowed references preserved. |
| BOOK18 | Withdraw/remove content, hide identity or relinquish control through distinct operations; no guessed AO3 orphaning semantics. |
| BOOK19 | Run one complete multi-principal author/editor/reader/moderator journey entirely through native APIs. |
| BOOK20 | Repeat the journey under concurrent edits, source changes, failed jobs, revoked grants and cache/index lag. |
| BOOK21 | Create and publish a metadata-only REZICS Work without ISBN, external edition or dummy Document; tag, discuss and favorite the Work through generic Resource contracts before any body is adopted. |
| BOOK22 | Adopt an English original and community Chinese/Japanese contributions into the same Work with no corresponding trilingual publisher edition; preserve exact provenance, officialness, credits and independent contributor control. |
| BOOK23 | Admit all languages by policy without preallocated language rows; distinguish that policy from particular support declarations, metadata translations and actual readable coverage. Two same-language contributions coexist with an explicit reading selection. |
| BOOK24 | Link hardcover, paperback and ebook publications with their own identifiers/contents to one Work; no external edition becomes its primary flag and a provider language update cannot remove community adoptions. |
| BOOK25 | Maintain anthology C and split/constituent Works A and B independently; aggregation, part coverage and ordered adoption remain distinct, with no family-wide primary uniqueness or inherited permissions/votes/progress. |
| BOOK26 | Repeat the same text/Work target in one publication manifest with different occurrence IDs, order and coverage; preserve exact citations and source correspondence through reorder/removal/restore. |
| BOOK27 | Correct Work metadata, revise a contributed Document and change an adoption independently; historical reading/export pins the earlier exact selection and progress maps or becomes unknown after changed structure. |
| BOOK28 | Export a virtual Work with unknown text correspondence and a multi-work text container; preserve native identity and explicitly map bibliographic components without claiming the Work itself is an LRM abstract Work. |
| BOOK29 | Build a complete anthology outline by importing a volume's exact structure into local occurrences; adding a volume reference alone does not expand it. Reuse chapter bodies and keep source correspondence. |
| BOOK30 | Refresh the imported outline after source and local edits, retaining stable nodes or explicit conflicts; published contents, progress, tags/comments and metric counting retain their separate identities. |

## AO3 functional coverage

Maintain a function-to-native-contract mapping from [AO3 official documentation](https://secure.ao3.org/tos_faq) and [official behavior tests](https://github.com/otwcode/otwarchive/tree/master/features). Cover creation, chapters/series, metadata/tags, contributors, privacy, collections/challenges/gifts, interactions, search and download/export. Reproduce the underlying capability through REZICS mechanisms; copying screens or creating AO3-specific tables is not the target.

Separate fandom membership, source-work derivation, character appearance and relationship declarations. Treat required/nonspecific source values honestly; absence is not a safe rating or no-warning assertion. REZICS may have different product policy, but each elected behavior needs an explicit disposition rather than silently disappearing from the matrix.

For acquisition research, use official published behavior and permitted public examples or authored fixtures. Tests must not depend on a logged-in personal collection or an uncommitted downloaded story. Keep multilingual data where required for language and identity fidelity. Full real-data collection is separate from deterministic functional coverage.
