-- Canonical integrity for generic Main-Variant stars.
--
-- Entity subtype equality is proved at the rare relationship write instead of
-- duplicating Entity subtype into unit_variant or building a corpus-scale
-- (id, kind) index. Both Unit and Entity rows are locked in UUID order so the
-- proof remains valid through commit and concurrent writers cannot deadlock.

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
