DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM unit_variant relationship
    LEFT JOIN unit variant_unit ON variant_unit.id = relationship.unit_id
    LEFT JOIN unit main_unit ON main_unit.id = relationship.canonical_unit_id
    WHERE relationship.unit_id = relationship.canonical_unit_id
       OR variant_unit.id IS NULL
       OR main_unit.id IS NULL
       OR variant_unit.kind <> main_unit.kind
       OR variant_unit.kind NOT IN ('book', 'software', 'media')
  ) THEN
    RAISE EXCEPTION 'unit_variant contains missing, self-linked, unsupported, or cross-kind relationships';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM unit_variant relationship
    JOIN unit_variant parent_relationship
      ON parent_relationship.unit_id = relationship.canonical_unit_id
  ) THEN
    RAISE EXCEPTION 'unit_variant contains a chain or cycle';
  END IF;
END
$$;

ALTER TABLE "unit" ADD CONSTRAINT "unit_id_kind_key" UNIQUE ("id", "kind");

DROP INDEX "unit_variant_canonical_idx";
ALTER TABLE "unit_variant"
  DROP CONSTRAINT "unit_variant_unit_id_unit_id_fkey",
  DROP CONSTRAINT "unit_variant_canonical_unit_id_unit_id_fkey";
ALTER TABLE "unit_variant" RENAME COLUMN "unit_id" TO "variant_unit_id";
ALTER TABLE "unit_variant" RENAME COLUMN "canonical_unit_id" TO "main_unit_id";
ALTER TABLE "unit_variant" ADD COLUMN "unit_kind" text;
UPDATE "unit_variant" relationship
SET "unit_kind" = source_unit."kind"
FROM "unit" source_unit
WHERE source_unit."id" = relationship."variant_unit_id";
ALTER TABLE "unit_variant" ALTER COLUMN "unit_kind" SET NOT NULL;
ALTER TABLE "unit_variant"
  ADD CONSTRAINT "unit_variant_kind_check"
    CHECK ("unit_kind" IN ('book', 'software', 'media')),
  ADD CONSTRAINT "unit_variant_variant_kind_fkey"
    FOREIGN KEY ("variant_unit_id", "unit_kind")
    REFERENCES "unit" ("id", "kind") ON DELETE CASCADE,
  ADD CONSTRAINT "unit_variant_main_kind_fkey"
    FOREIGN KEY ("main_unit_id", "unit_kind")
    REFERENCES "unit" ("id", "kind") ON DELETE RESTRICT;
CREATE INDEX "unit_variant_main_created_at_idx"
  ON "unit_variant" ("main_unit_id", "created_at", "variant_unit_id");

CREATE FUNCTION enforce_unit_variant_star() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM id
  FROM unit
  WHERE id IN (NEW.variant_unit_id, NEW.main_unit_id)
  ORDER BY id
  FOR UPDATE;

  IF EXISTS (
    SELECT 1
    FROM unit_variant target_relationship
    WHERE target_relationship.variant_unit_id = NEW.main_unit_id
  ) THEN
    RAISE EXCEPTION 'a Variant must point directly to a Main'
      USING ERRCODE = '23514', CONSTRAINT = 'unit_variant_target_is_variant';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM unit_variant child_relationship
    WHERE child_relationship.main_unit_id = NEW.variant_unit_id
  ) THEN
    RAISE EXCEPTION 'a Main with Variants cannot become a Variant'
      USING ERRCODE = '23514', CONSTRAINT = 'unit_variant_source_has_variants';
  END IF;

  RETURN NEW;
END
$$;

CREATE TRIGGER unit_variant_star_enforce
BEFORE INSERT OR UPDATE OF variant_unit_id, main_unit_id ON unit_variant
FOR EACH ROW EXECUTE FUNCTION enforce_unit_variant_star();

UPDATE profile_preference
SET collection_config = jsonb_set(collection_config, '{version}', '1'::jsonb, true)
WHERE collection_config IS NOT NULL
  AND NOT collection_config ? 'version';
