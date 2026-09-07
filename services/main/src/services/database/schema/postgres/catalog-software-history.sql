-- Software state is constrained in native columns before its immutable history is captured.
CREATE OR REPLACE FUNCTION public.capture_software_record_revision() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE owner_revision bigint;
BEGIN
  IF TG_OP = 'UPDATE' AND (NEW.id IS DISTINCT FROM OLD.id OR NEW.identity_shape IS DISTINCT FROM OLD.identity_shape OR (TG_TABLE_NAME = 'software_version' AND to_jsonb(NEW)->'content_id' IS DISTINCT FROM to_jsonb(OLD)->'content_id')) THEN
    RAISE EXCEPTION 'software identity and content ownership are immutable' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'UPDATE' AND to_jsonb(NEW) = to_jsonb(OLD) THEN RETURN NEW; END IF;
  SELECT revision INTO STRICT owner_revision FROM public.software_identity WHERE id = NEW.id FOR UPDATE;
  INSERT INTO public.software_record_revision(owner_id, revision, shape, value)
  VALUES (NEW.id, owner_revision, NEW.identity_shape, to_jsonb(NEW));
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.reject_software_revision_mutation() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' AND pg_trigger_depth() > 1 THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'software history is written only by native capture triggers' USING ERRCODE = '23514';
END $$;

DROP TRIGGER IF EXISTS software_content_history ON public.software_content;
CREATE TRIGGER software_content_history AFTER INSERT OR UPDATE ON public.software_content
FOR EACH ROW EXECUTE FUNCTION public.capture_software_record_revision();
DROP TRIGGER IF EXISTS software_version_history ON public.software_version;
CREATE TRIGGER software_version_history AFTER INSERT OR UPDATE ON public.software_version
FOR EACH ROW EXECUTE FUNCTION public.capture_software_record_revision();
DROP TRIGGER IF EXISTS software_release_history ON public.software_release;
CREATE TRIGGER software_release_history AFTER INSERT OR UPDATE ON public.software_release
FOR EACH ROW EXECUTE FUNCTION public.capture_software_record_revision();
DROP TRIGGER IF EXISTS software_record_revision_immutable ON public.software_record_revision;
CREATE TRIGGER software_record_revision_immutable BEFORE INSERT OR UPDATE OR DELETE ON public.software_record_revision
FOR EACH ROW EXECUTE FUNCTION public.reject_software_revision_mutation();

CREATE OR REPLACE FUNCTION public.capture_software_component_revision() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v jsonb; owner_revision bigint; component_id text;
BEGIN
  IF TG_OP = 'UPDATE' AND to_jsonb(NEW) = to_jsonb(OLD) THEN RETURN NEW; END IF;
  v := CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
  component_id := v ->> TG_ARGV[1];
  SELECT revision INTO STRICT owner_revision FROM public.software_identity WHERE id = (v ->> 'release_id')::uuid FOR UPDATE;
  INSERT INTO public.software_component_revision(release_id, kind, component_id, revision, operation, value)
  VALUES ((v ->> 'release_id')::uuid, TG_ARGV[0], component_id, owner_revision, CASE WHEN TG_OP = 'DELETE' THEN 'remove' ELSE 'put' END, v);
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END $$;

DROP TRIGGER IF EXISTS software_component_revision_immutable ON public.software_component_revision;
CREATE TRIGGER software_component_revision_immutable BEFORE INSERT OR UPDATE OR DELETE ON public.software_component_revision
FOR EACH ROW EXECUTE FUNCTION public.reject_software_revision_mutation();
DO $$
DECLARE entry text[];
BEGIN
  FOREACH entry SLICE 1 IN ARRAY ARRAY[
    ['software_release_content','content','id'], ['software_release_platform','platform','platform_revision_id'],
    ['software_release_medium','medium','id'], ['software_release_language','language','id'],
    ['software_release_event','event','id'], ['software_patch_target','patch_target','base_release_id'],
    ['software_release_animation','animation','context']
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS software_component_history ON public.%I', entry[1]);
    EXECUTE format('CREATE TRIGGER software_component_history AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.capture_software_component_revision(%L,%L)', entry[1], entry[2], entry[3]);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.enforce_software_patch_target() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_TABLE_NAME = 'software_patch_target' THEN
    IF NOT EXISTS (SELECT 1 FROM public.software_release WHERE id = NEW.release_id AND is_patch IS TRUE FOR SHARE) THEN
      RAISE EXCEPTION 'only a patch can declare applicable base releases' USING ERRCODE = '23514';
    END IF;
  ELSIF NEW.is_patch IS DISTINCT FROM TRUE AND EXISTS (SELECT 1 FROM public.software_patch_target WHERE release_id = NEW.id LIMIT 1) THEN
    RAISE EXCEPTION 'release with patch targets must remain a patch' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS software_patch_target_kind ON public.software_patch_target;
CREATE TRIGGER software_patch_target_kind BEFORE INSERT OR UPDATE ON public.software_patch_target
FOR EACH ROW EXECUTE FUNCTION public.enforce_software_patch_target();
DROP TRIGGER IF EXISTS software_release_patch_kind ON public.software_release;
CREATE TRIGGER software_release_patch_kind BEFORE UPDATE OF is_patch ON public.software_release
FOR EACH ROW EXECUTE FUNCTION public.enforce_software_patch_target();
