# Content Authority Search Audit

Search/index ownership semantics for the wiki authority rollout:

- Content documents expose `ownerUnitId` from `Unit.userId`. This is custodian
  ownership and may be `rezics-wiki` for community catalog entries.
- Entity documents also expose `ownerUnitId` from their backing Unit.
- Post documents expose `authorUserId` from `Post.authorUserId`; ordinary post,
  review, remark, reply, excerpt, and chapter search/user scopes continue to use
  author semantics.
- Wiki post documents use `kind = "WIKI"` and keep `targetUnitId` for the Unit
  they document or extend.
- App result rendering must treat `rezics-wiki` ownership through the shared
  Unit card summary/community catalog classification instead of showing it as a
  normal human owner card.

No automatic search backfill is required for development rows. Reindex after
deploying the wiki post kind and community ownership renderer if existing local
Meili documents were built before those fields existed.

