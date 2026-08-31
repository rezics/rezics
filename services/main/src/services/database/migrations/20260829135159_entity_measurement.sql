SET search_path TO public;

-- Modify "unit_merge_operation" table
ALTER TABLE "unit_merge_operation" ADD COLUMN "measurement_preflight_cursor_entity_id" uuid NULL;
-- Create "entity_measurement" table
CREATE TABLE "entity_measurement" (
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "entity_id" uuid NOT NULL,
  "context_unit_id" uuid NULL,
  "height_millimetres" integer NULL,
  "weight_grams" integer NULL,
  "bust_millimetres" integer NULL,
  "waist_millimetres" integer NULL,
  "hips_millimetres" integer NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "updated_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "entity_measurement_entity_context_key" UNIQUE NULLS NOT DISTINCT ("entity_id", "context_unit_id"),
  CONSTRAINT "entity_measurement_context_unit_id_unit_id_fkey" FOREIGN KEY ("context_unit_id") REFERENCES "unit" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "entity_measurement_entity_id_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entity" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "entity_measurement_context_not_self_check" CHECK ((context_unit_id IS NULL) OR (context_unit_id <> entity_id)),
  CONSTRAINT "entity_measurement_positive_check" CHECK (COALESCE((height_millimetres > 0), true) AND COALESCE((weight_grams > 0), true) AND COALESCE((bust_millimetres > 0), true) AND COALESCE((waist_millimetres > 0), true) AND COALESCE((hips_millimetres > 0), true)),
  CONSTRAINT "entity_measurement_value_present_check" CHECK (num_nonnulls(height_millimetres, weight_grams, bust_millimetres, waist_millimetres, hips_millimetres) > 0)
);
-- Create index "entity_measurement_context_idx" to table: "entity_measurement"
CREATE INDEX "entity_measurement_context_idx" ON "entity_measurement" ("context_unit_id", "entity_id") WHERE (context_unit_id IS NOT NULL);

-- Canonical Entity measurement facts have immutable identity while their
-- values remain editable. Cross-row contextual cardinality stays bounded.

CREATE OR REPLACE FUNCTION public.guard_entity_measurement()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
	IF TG_OP = 'UPDATE' AND (NEW.entity_id, NEW.context_unit_id)
		IS DISTINCT FROM (OLD.entity_id, OLD.context_unit_id) THEN
		RAISE EXCEPTION 'Entity measurement identity is immutable'
			USING ERRCODE = '23514', CONSTRAINT = 'entity_measurement_identity_immutable';
	END IF;
	IF TG_OP <> 'DELETE' AND NEW.context_unit_id IS NOT NULL THEN
		PERFORM pg_advisory_xact_lock(hashtextextended('entity_measurement:' || NEW.entity_id::text, 0));
		IF NOT EXISTS (
			SELECT 1 FROM public.entity_measurement
			WHERE entity_id = NEW.entity_id AND context_unit_id = NEW.context_unit_id
		) AND EXISTS (
			SELECT 1 FROM public.entity_measurement
			WHERE entity_id = NEW.entity_id AND context_unit_id IS NOT NULL
			OFFSET 7 LIMIT 1
		) THEN
			RAISE EXCEPTION 'An Entity may have at most eight contextual measurement sets'
				USING ERRCODE = '23514', CONSTRAINT = 'entity_measurement_context_limit';
		END IF;
	END IF;
	RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

DROP TRIGGER IF EXISTS entity_measurement_guard ON public.entity_measurement;
CREATE TRIGGER entity_measurement_guard
BEFORE INSERT OR UPDATE OR DELETE ON public.entity_measurement
FOR EACH ROW EXECUTE FUNCTION public.guard_entity_measurement();
