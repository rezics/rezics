# Multilingual community rule authoring

Status: target contract. A Realm is the community capability of a Space.
[Governance](governance-rule-decisions.md) owns exact rule consent and decisions;
[content composition](database/content-composition.md) owns staged revisions and
published selections. The [runtime reference](../reference/current-implementation.md)
records the earlier array-based authoring shape and its language limits.

## Rule identity and language

A Rule has stable Resource identity and immutable policy/content revisions. An
ordered RuleSet revision pins the exact rules and language/representation selections
it publishes. Language presentations are separately identified variants; their
translation derivation and review evidence remain explicit. Consent records the
exact applicable RuleSet/rule and, where required, the presentation actually shown.
Adding a translation does not silently reinterpret an earlier acknowledgement.

Content language uses the open IANA/BCP 47 contract, independently of UI locales.
A rule must have at least one admitted readable presentation before publication;
the installed interface's translated language list is not a storage allowlist.
Same-language alternative variants can exist. A published presentation selector
chooses one for its exact scope/purpose; variant identity is not just language.

The authoring API uses bounded pages/commands with explicit variant IDs, language,
text/Document references and expected revisions. Duplicate occurrence IDs or
ambiguous published selection are rejected. Bilingual source material is not
silently split, combined or translated. Reading reports the actual selected
language and fallback; an unavailable requested translation is not fabricated.

## Revision and publication protocol

Small edits use a bounded atomic command. Large multilingual changes stage an
immutable manifest through bounded batches, then seal and activate under current
authority and the exact expected RuleSet head. Failed or incomplete staging cannot
become a published policy. Editing one translation need not copy every rule and
every other language into one request.

Publishing locks/reloads the current community capability, required authority and
head after admission. A concurrent policy change returns a typed conflict; clients
retain drafts and never substitute another current rule silently. Rule order uses
stable occurrences and positions. Changes to language presentation, normative rule
meaning and publication selection have distinct version/consent consequences.

## Draft and editor contract

A draft is private to the authenticated account and is bound to the selected
authority subject, target Resource/Space, feature, exact base revisions and variant
or shared partition. Changing interface locale does not select another content
variant. Changing a default Agent does not retarget a prepared publication.

Language-specific draft values have stable variant identities. Shared fields such
as rule order or route configuration have a shared draft partition. Stored draft
payloads enter the editor only through the owning codec. Local persistence and
expiry are explicit product policy, not evidence of server acceptance. Successful
publication clears only the submitted draft/receipt; conflicts preserve input.

## Bounded work and capacity

Declare separately the product bound on rules in a RuleSet, per-command rule/variant
count, payload bytes, page size and staged-operation limits. The existing 100-rule
policy may remain a reviewed community configuration bound; it does not imply seven
languages or a 700-row lifetime total. No all-language authoring endpoint loads all
variants into one response. Long sets continue through revision-bound keysets.

Let R be rules per selected set, L the actual average variants per rule, H retained
changed revisions and B an admitted command batch. Current rows scale with R*L;
history scales with actual changed variants/selections, not reader traffic. A command
uses O(B) rows/bytes plus bounded authority/head work. Activation relies on sealed
manifest completeness, not a whole-corpus validation scan.

Apply the 500M/3B-row baseline independently to variants, revision payloads, selections
and consent. At an illustrative 1,024 bytes per localization row including the
assumed index/payload contribution, those rows alone are 512 GB / 3.072 TB before
WAL, replicas, free space and backups. This is arithmetic, not measured storage.
Actual text sizes, skew, concurrent publication, WAL, vacuum and restoration must
be measured. Keep current selections and history access owner-local in one database;
partition counts follow the [storage policy](database/resource-storage.md).

## Acceptance

Qualify a language outside the UI list, two variants in one language, an exact
translation source, staged multi-page editing, stale activation, consent history,
revocation, fallback and draft recovery. Reuse MODEL09-MODEL16 and MODEL27-MODEL36.
The [1.5.0 cutover](../releases/1.5.0.md#rule-authoring-cutover) is historical evidence,
not the target's deployment procedure or permission to discard current rules.
