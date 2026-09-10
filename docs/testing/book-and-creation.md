# Book and general creation acceptance

Owner: M05. Use [native creation contracts](../architecture/database/creation.md). The following are required behavior cases, not passed tests. Book is the first complete backend journey; original and transformative works use the same native system.

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

## AO3 functional coverage

Maintain a function-to-native-contract mapping from [AO3 official documentation](https://secure.ao3.org/tos_faq) and [official behavior tests](https://github.com/otwcode/otwarchive/tree/master/features). Cover creation, chapters/series, metadata/tags, contributors, privacy, collections/challenges/gifts, interactions, search and download/export. Reproduce the underlying capability through REZICS mechanisms; copying screens or creating AO3-specific tables is not the target.

Separate fandom membership, source-work derivation, character appearance and relationship declarations. Treat required/nonspecific source values honestly; absence is not a safe rating or no-warning assertion. REZICS may have different product policy, but each elected behavior needs an explicit disposition rather than silently disappearing from the matrix.

For acquisition research, use official published behavior and permitted public examples or authored fixtures. Tests must not depend on a logged-in personal collection or an uncommitted downloaded story. Keep multilingual data where required for language and identity fidelity. Full real-data collection is separate from deterministic functional coverage.
