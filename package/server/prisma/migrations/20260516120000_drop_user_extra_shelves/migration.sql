-- Strip the `shelves` sub-property from `User.extra`.
--
-- System shelf ids are now resolved exclusively through the Unit slug index
-- `(slugScope, slug)` (see openspec change `shelf-system-slugs`). The
-- `extra.shelves` JSON map is no longer a documented surface of the User DTO,
-- so its content is removed here. The `extra` column itself stays available
-- for other product features per design D5.

UPDATE "User"
SET "extra" = "extra" - 'shelves'
WHERE "extra" ? 'shelves';
