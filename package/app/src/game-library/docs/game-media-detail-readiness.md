# GAME/MEDIA Detail Readiness

Future GAME and MEDIA detail pages should mirror the book detail product
structure: hero first, then overview, content, releases, community, and metadata
tabs.

The hero domain-media region is reserved for trailers, clips, screenshots,
posters, and carousel content. Those assets are not part of this backend slice
and must not be modeled as raw URL columns on `Game` or `Media`. Use existing
Unit/ContentDoc/UnitExternalRef-backed data or a future typed media-asset
contract when those assets are implemented.
