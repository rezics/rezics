# Native Work and release acceptance

Owners: M01-M05 and M07. Contract: [native Work and release](../architecture/database/native-work.md). These are pending semantic/persistence/API specifications, not passed tests. Book may be implemented first after the common contract is checked against the other domains.

| Case | Required behavior |
| --- | --- |
| WORK01 | Create metadata-only literary, musical, audiovisual, visual, game/software and mixed-media Works without a universal parent, dummy body or fabricated external release. |
| WORK02 | Apply the same identity/scope/continuity decision process to each domain; current table or source class names cannot exempt a domain. |
| WORK03 | Correct title, metadata or classification while retaining native identity and existing generic references. |
| WORK04 | Keep unrelated creations distinct despite equal names, genre, purpose, external identifier claims or initial bytes; record conflicts rather than auto-merge. |
| WORK05 | Create virtual and actual releases with distinct identities but the shared domain composition/revision protocol; identifiers are optional or required only by the selected issuing contract. |
| WORK06 | Correct release metadata without rewriting an earlier published selection; new contents require a new exact manifest/adoption revision. |
| WORK07 | Preserve original plus same-language translation, subtitle and localization alternatives, their exact revisions, attribution and independent authority. |
| WORK08 | Reject a subtitle/cut or patch/build mismatch even when language and target identity are valid; support declarations do not establish compatible availability. |
| WORK09 | Declare all-language admission without preallocated language rows; keep metadata language, particular consumption declarations, current coverage and nonlinguistic content distinct. |
| WORK10 | Apply word count only to relevant text/version/coverage, duration to exact timed content and dimensions to their representation; unknown/inapplicable/inaccessible do not become zero. |
| WORK11 | Display a selected Work's measurements with their source versions and counting basis; do not sum language alternatives or both a container subtotal and its leaves. |
| WORK12 | Represent composition, independent recording, album, track occurrence and release without collapsing their scopes or identities. |
| WORK13 | Preserve project continuity through maintenance branches; establish an independently directed fork or remake as a related Work when justified. Ambiguous boundaries remain reviewable. |
| WORK14 | Maintain anthology/album/series and constituent or split Works independently; no unique primary Work for the whole family and no inferred content/grant/progress adoption. |
| WORK15 | Organize a visual novel with text, images, audio and interaction without splitting identity by modality; retain separately maintained derivative/asset identities where appropriate. |
| WORK16 | Distinguish person/place/event/concept from an authored Work describing it; ordinary Collection membership does not automatically create an editorial Work. |
| WORK17 | Map LRMoo, BIBFRAME, MusicBrainz and software/source scopes explicitly; preserve uncertain correspondence and independently adopted community content after source updates/withdrawal. |
| WORK18 | Run shared Tag, favorite, follow, relation, discussion and authorization operations against eligible Works/releases in different owners; reject ineligible operations independently of identity validity. |

Use produced native IDs and multiple principals. Pin every tested source contract and exact content/selection revision. Check rejected SQL states, competing authoring/adoption and stateful APIs after semantic fixtures establish expected outcomes. External papers and deployments support the [design reasoning](../architecture/database/design-evidence.md), not a passing result for these cases.
