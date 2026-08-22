SET LOCAL search_path = public;

-- Add value to enum type: "unit_revision_slot_role"
ALTER TYPE "unit_revision_slot_role" ADD VALUE 'content_language_support' AFTER 'localization';

-- Replace the Main-Variant guard before retiring the old closed-kind CHECK.
-- Existing rows were proved by that CHECK; the replacement trigger proves all
-- future writes without validating the corpus again.
CREATE OR REPLACE FUNCTION public.enforce_unit_variant_star() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  variant_entity_kind text;
  main_entity_kind text;
BEGIN
  PERFORM id
  FROM public.unit
  WHERE id IN (NEW.variant_unit_id, NEW.main_unit_id)
  ORDER BY id
  FOR UPDATE;

  IF NEW.unit_kind NOT IN ('book', 'software', 'media', 'entity') THEN
    RAISE EXCEPTION 'Unit kind % cannot participate in a Variant group', NEW.unit_kind
      USING ERRCODE = '23514', CONSTRAINT = 'unit_variant_kind_check';
  END IF;

  IF NEW.unit_kind = 'entity' THEN
    PERFORM id
    FROM public.entity
    WHERE id IN (NEW.variant_unit_id, NEW.main_unit_id)
    ORDER BY id
    FOR SHARE;

    SELECT kind INTO variant_entity_kind
    FROM public.entity
    WHERE id = NEW.variant_unit_id;

    SELECT kind INTO main_entity_kind
    FROM public.entity
    WHERE id = NEW.main_unit_id;

    IF variant_entity_kind IS NULL
       OR main_entity_kind IS NULL
       OR variant_entity_kind IS DISTINCT FROM main_entity_kind
    THEN
      RAISE EXCEPTION 'Entity Variants must use the same Entity subtype'
        USING ERRCODE = '23514', CONSTRAINT = 'unit_variant_entity_kind_mismatch';
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.unit_variant target_relationship
    WHERE target_relationship.variant_unit_id = NEW.main_unit_id
  ) THEN
    RAISE EXCEPTION 'a Variant must point directly to a Main'
      USING ERRCODE = '23514', CONSTRAINT = 'unit_variant_target_is_variant';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.unit_variant child_relationship
    WHERE child_relationship.main_unit_id = NEW.variant_unit_id
  ) THEN
    RAISE EXCEPTION 'a Main with Variants cannot become a Variant'
      USING ERRCODE = '23514', CONSTRAINT = 'unit_variant_source_has_variants';
  END IF;

  RETURN NEW;
END
$$;

CREATE OR REPLACE FUNCTION public.guard_entity_variant_kind_change() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.kind IS NOT DISTINCT FROM OLD.kind THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.unit_variant relationship
    WHERE relationship.variant_unit_id = NEW.id
  ) OR EXISTS (
    SELECT 1
    FROM public.unit_variant relationship
    WHERE relationship.main_unit_id = NEW.id
  ) THEN
    RAISE EXCEPTION 'an Entity subtype cannot change while it participates in a Variant group'
      USING ERRCODE = '23514', CONSTRAINT = 'entity_variant_kind_change';
  END IF;

  RETURN NEW;
END
$$;

CREATE OR REPLACE FUNCTION public.guard_entity_variant_delete() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.unit_variant relationship
    WHERE relationship.variant_unit_id = OLD.id
  ) OR EXISTS (
    SELECT 1
    FROM public.unit_variant relationship
    WHERE relationship.main_unit_id = OLD.id
  ) THEN
    RAISE EXCEPTION 'an Entity row cannot be deleted while it participates in a Variant group'
      USING ERRCODE = '23514', CONSTRAINT = 'entity_variant_delete';
  END IF;

  RETURN OLD;
END
$$;

DROP TRIGGER IF EXISTS unit_variant_star_enforce ON public.unit_variant;
CREATE TRIGGER unit_variant_star_enforce
BEFORE INSERT OR UPDATE OF variant_unit_id, main_unit_id, unit_kind
ON public.unit_variant
FOR EACH ROW EXECUTE FUNCTION public.enforce_unit_variant_star();

DROP TRIGGER IF EXISTS entity_variant_kind_change_guard ON public.entity;
CREATE TRIGGER entity_variant_kind_change_guard
BEFORE UPDATE OF kind
ON public.entity
FOR EACH ROW EXECUTE FUNCTION public.guard_entity_variant_kind_change();

DROP TRIGGER IF EXISTS entity_variant_delete_guard ON public.entity;
CREATE CONSTRAINT TRIGGER entity_variant_delete_guard
AFTER DELETE
ON public.entity
DEFERRABLE INITIALLY IMMEDIATE
FOR EACH ROW EXECUTE FUNCTION public.guard_entity_variant_delete();

-- Modify "unit_variant" table
ALTER TABLE "unit_variant" DROP CONSTRAINT "unit_variant_kind_check";

-- Create "unit_content_language_support" table
CREATE TABLE "unit_content_language_support" (
  "unit_id" uuid NOT NULL,
  "unit_kind" text NOT NULL,
  "value" jsonb NOT NULL,
  "updated_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("unit_id"),
  CONSTRAINT "unit_content_language_support_unit_kind_fkey" FOREIGN KEY ("unit_id", "unit_kind") REFERENCES "unit" ("id", "kind") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "unit_content_language_support_kind_check" CHECK (unit_kind = ANY (ARRAY['book'::text, 'software'::text, 'media'::text, 'video'::text, 'audio'::text, 'release'::text])),
  CONSTRAINT "unit_content_language_support_value_check" CHECK ((jsonb_typeof(value) = 'array'::text) AND ((jsonb_array_length(value) >= 1) AND (jsonb_array_length(value) <= 64)))
);

-- Create "unit_content_language_search" table
CREATE TABLE "unit_content_language_search" (
  "unit_id" uuid NOT NULL,
  "unit_kind" text NOT NULL,
  "language_tag" text NOT NULL,
  "channel_mask" smallint NOT NULL,
  PRIMARY KEY ("unit_id", "language_tag"),
  CONSTRAINT "unit_content_language_search_unit_kind_fkey" FOREIGN KEY ("unit_id", "unit_kind") REFERENCES "unit" ("id", "kind") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "unit_content_language_search_channel_mask_check" CHECK ((channel_mask >= 0) AND (channel_mask <= 15)),
  CONSTRAINT "unit_content_language_search_kind_check" CHECK (unit_kind = ANY (ARRAY['book'::text, 'software'::text, 'media'::text, 'video'::text, 'audio'::text, 'release'::text])),
  CONSTRAINT "unit_content_language_search_language_tag_check" CHECK ((length(language_tag) >= 1) AND (length(language_tag) <= 255))
);
-- Create index "unit_content_language_search_language_channel_unit_idx" to table: "unit_content_language_search"
CREATE INDEX "unit_content_language_search_language_channel_unit_idx" ON "unit_content_language_search" ("language_tag", "channel_mask", "unit_id");

-- Canonical reverse projection maintenance for content-consumption language discovery.
-- The authoritative JSON document is bounded to 64 entries, so each write performs
-- at most 64 projection inserts in the same transaction.

CREATE OR REPLACE FUNCTION public.maintain_unit_content_language_search() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF TG_OP <> 'INSERT' THEN
    DELETE FROM public.unit_content_language_search
    WHERE unit_id = OLD.unit_id;
  END IF;

  IF TG_OP <> 'DELETE' THEN
    INSERT INTO public.unit_content_language_search (
      unit_id,
      unit_kind,
      language_tag,
      channel_mask
    )
    SELECT
      NEW.unit_id,
      NEW.unit_kind,
      entry ->> 'languageTag',
      CASE
        WHEN NOT (entry ? 'channels') THEN 0
        ELSE
          CASE WHEN entry -> 'channels' ? 'text' THEN 1 ELSE 0 END
          + CASE WHEN entry -> 'channels' ? 'audio' THEN 2 ELSE 0 END
          + CASE WHEN entry -> 'channels' ? 'subtitle' THEN 4 ELSE 0 END
          + CASE WHEN entry -> 'channels' ? 'interface' THEN 8 ELSE 0 END
      END
    FROM jsonb_array_elements(NEW.value) AS entry;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS unit_content_language_search_maintain
ON public.unit_content_language_support;

CREATE TRIGGER unit_content_language_search_maintain
AFTER INSERT OR UPDATE OR DELETE ON public.unit_content_language_support
FOR EACH ROW EXECUTE FUNCTION public.maintain_unit_content_language_search();

-- Create "video_audio_track" table
CREATE TABLE "video_audio_track" (
  "video_unit_id" uuid NOT NULL,
  "audio_unit_id" uuid NOT NULL,
  CONSTRAINT "video_audio_track_video_audio_pkey" PRIMARY KEY ("video_unit_id", "audio_unit_id"),
  CONSTRAINT "video_audio_track_video_fkey" FOREIGN KEY ("video_unit_id") REFERENCES "video" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "video_audio_track_audio_fkey" FOREIGN KEY ("audio_unit_id") REFERENCES "audio" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "video_audio_track_not_self_check" CHECK (video_unit_id <> audio_unit_id)
);

-- Create index "video_audio_track_audio_video_idx" to table: "video_audio_track"
CREATE INDEX "video_audio_track_audio_video_idx" ON "video_audio_track" ("audio_unit_id", "video_unit_id");
