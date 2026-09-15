# M03: content and media

Dependencies: M01 and M02 reference/definition contracts. Owner: dictionary D08-D10 and database architecture section 8.

## Remaining work

- Implement Document variants/branches, revisions, exact anchors, derivation, attribution and availability.
- Implement social Publication revisions, ContentSlot/Adoption, author release channels and independent editor/published/adopted heads across domains. Published consumption pins exact content and structure; metadata-only states require no fabricated payload.
- Replace overloaded post kinds with explicit roles/workflows/presentation changes; retain identity and reply origin when comments become articles or wiki bodies.
- Implement asset versions, representations, locations, contextual uses, language/release/work/territory applicability, galleries and scoped cover selection.
- Qualify encoding identity, source approval versus adoption, representative release artwork, remote-byte assurance and optional caching.
- Implement the shared [composition protocol](../../architecture/database/content-composition.md): local occurrences/overrides, exact source import, durable correspondence, refresh comparison, staged activation and child-list cursors. Qualify [COMP01-COMP24](../../testing/content-composition.md) with M01/M04/M09 rather than add an unbounded subtree helper.
- Test staging/sealing, dependency disclosure, concurrent edits/adoptions, derivatives racing erasure and unavailable fallback.

## Acceptance

[M10's Realm review application](subscriptions-and-pro.md) consumes this owner's
exact publication/adoption selections: keep the last accepted Realm version during
review, recheck transitive disclosure at activation/delivery and preserve independent
social Publication/Thread identities on cross-Realm repost. This is a dependency of
Pro qualification, not permission for a review flag on a mutable current head to
replace the content contract.

Short comments, prose, images, audiovisual content and files use explicit compatible contracts. Realms can adopt different versions/covers. Gallery/source ordering cannot overwrite human selection. Delivery and derivatives obey current access/erasure. Body edits do not rewrite unrelated structures or public heads.
