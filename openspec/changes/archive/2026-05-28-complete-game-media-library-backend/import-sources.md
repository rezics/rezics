# GAME/MEDIA Import Source Expectations

This change prepares storage and admin readiness for imported GAME/MEDIA
metadata, but it does not implement crawlers or importer adapters.

- IGDB: use source refs for game identity, release dates, platform mappings,
  genres/tags, companies, screenshots, videos, and ratings when available.
- Steam: store Steam app identity as `UnitExternalRef`; preserve source text for
  PC requirements in `GameSystemRequirement.rawText` and partial structured
  fields in `hardware`.
- PCGamingWiki: use as source evidence for platform-specific requirements and
  compatibility notes; each requirement row should reference the evidence
  `UnitExternalRef` when the source page is known.
- TMDB: store movie or TV identity as `UnitExternalRef`; trailers, clips,
  posters, seasons, and episodes remain domain media or content-structure data,
  not raw `Media` columns.
- IMDb: store title identity as `UnitExternalRef`; credits and release metadata
  should flow through existing attribution and translation surfaces.
