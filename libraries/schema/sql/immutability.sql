-- Canonical package integrity guards. Generate their migration with db:guards:generate.
CREATE OR REPLACE FUNCTION public.schema_reject_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Schema identities, revisions and decisions are immutable; append a new revision or selection'
    USING ERRCODE = '23514';
END;
$$;

DO $$
DECLARE name text;
BEGIN
  FOREACH name IN ARRAY ARRAY[
    'schema_vocabulary','schema_release','schema_release_context','schema_term','schema_term_alias',
    'schema_definition','schema_release_term','schema_label','schema_release_label','schema_change',
    'schema_label_selection','schema_profile','schema_profile_revision','schema_profile_rule',
    'schema_relation','schema_relation_revision','schema_relation_selection'
  ] LOOP
    EXECUTE format('CREATE OR REPLACE TRIGGER schema_immutable BEFORE UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.schema_reject_mutation()', name);
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.schema_require_prior_revision()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE parent_exists boolean;
BEGIN
  IF NEW.parent_revision_id IS NOT NULL THEN
    EXECUTE format('SELECT EXISTS (SELECT 1 FROM %I.%I WHERE id = $1 AND relation_id = $2)', TG_TABLE_SCHEMA, TG_TABLE_NAME)
      INTO parent_exists USING NEW.parent_revision_id, NEW.relation_id;
    IF NOT parent_exists THEN
      RAISE EXCEPTION 'A revision parent must already exist for the same relation' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER schema_revision_parent BEFORE INSERT ON public.schema_relation_revision
FOR EACH ROW EXECUTE FUNCTION public.schema_require_prior_revision();
