SET search_path TO public;

-- Canonical Entity measurement facts have immutable identity while their
-- values remain editable. Cross-row contextual cardinality stays bounded.

-- entity_measurement is created empty earlier in this unreleased cutover. Do
-- not silently bless rows written by a partial preview deployment before the
-- cross-row guard existed; the bounded empty-table probe avoids a corpus scan.
DO $$
BEGIN
	IF EXISTS (SELECT 1 FROM public.entity_measurement LIMIT 1) THEN
		RAISE EXCEPTION 'Entity measurement guard cutover requires an empty relation'
			USING ERRCODE = '55000';
	END IF;
END;
$$;

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
