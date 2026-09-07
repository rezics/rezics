CREATE OR REPLACE FUNCTION public.catalog_guard_distribution_member()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE sealed_time timestamptz;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'Distribution occurrences are immutable; stage a replacement manifest' USING ERRCODE = '23514';
  END IF;
  SELECT sealed_at INTO sealed_time FROM public.distribution_manifest
    WHERE package_id = NEW.package_id AND id = NEW.manifest_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Distribution manifest is missing' USING ERRCODE = '23503'; END IF;
  IF sealed_time IS NOT NULL THEN
    RAISE EXCEPTION 'Distribution append requires an unsealed manifest' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.catalog_count_distribution_members()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE batch record; prefix bigint;
BEGIN
  FOR batch IN SELECT package_id, manifest_id, count(*) AS members, min(position) AS first_position, max(position) AS last_position
    FROM inserted_distribution_members GROUP BY package_id, manifest_id ORDER BY package_id, manifest_id LOOP
    SELECT member_count INTO prefix FROM public.distribution_manifest WHERE package_id = batch.package_id AND id = batch.manifest_id FOR UPDATE;
    IF batch.first_position <> prefix OR batch.last_position <> prefix + batch.members - 1 THEN
      RAISE EXCEPTION 'Distribution append must be a complete consecutive prefix' USING ERRCODE = '23514';
    END IF;
    UPDATE public.distribution_manifest SET member_count = member_count + batch.members WHERE package_id = batch.package_id AND id = batch.manifest_id;
  END LOOP;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.catalog_guard_distribution_manifest()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.member_count <> 0 OR NEW.sealed_at IS NOT NULL THEN
      RAISE EXCEPTION 'Distribution manifests start empty and unsealed' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Distribution manifests are retained for history' USING ERRCODE = '23514'; END IF;
  IF NEW.id <> OLD.id OR NEW.package_id <> OLD.package_id OR NEW.created_at <> OLD.created_at THEN
    RAISE EXCEPTION 'Distribution manifest identity is immutable' USING ERRCODE = '23514';
  END IF;
  IF NEW.member_count <> OLD.member_count AND pg_trigger_depth() < 2 THEN
    RAISE EXCEPTION 'Distribution prefix is maintained only by occurrence insertion' USING ERRCODE = '23514';
  END IF;
  IF OLD.sealed_at IS NOT NULL AND (NEW.sealed_at IS DISTINCT FROM OLD.sealed_at OR NEW.member_count <> OLD.member_count) THEN
    RAISE EXCEPTION 'Sealed distribution manifests are immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.catalog_guard_distribution_revision()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE head bigint; sealed_time timestamptz;
BEGIN
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Distribution revisions are immutable' USING ERRCODE = '23514'; END IF;
  SELECT current_revision INTO head FROM public.distribution_package WHERE id = NEW.package_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Distribution package is missing' USING ERRCODE = '23503'; END IF;
  IF NEW.revision <> head + 1 THEN RAISE EXCEPTION 'Distribution revision must follow current head' USING ERRCODE = '23514'; END IF;
  SELECT sealed_at INTO sealed_time FROM public.distribution_manifest WHERE package_id = NEW.package_id AND id = NEW.manifest_id FOR SHARE;
  IF NOT FOUND OR sealed_time IS NULL THEN RAISE EXCEPTION 'Distribution revision requires sealed manifest' USING ERRCODE = '23514'; END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.catalog_require_distribution_head()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE package_key uuid; head bigint;
BEGIN
  IF TG_TABLE_NAME = 'distribution_package' THEN package_key := NEW.id; ELSE package_key := NEW.package_id; END IF;
  SELECT current_revision INTO head FROM public.distribution_package WHERE id = package_key;
  IF TG_TABLE_NAME = 'distribution_revision' THEN
    IF head < NEW.revision THEN RAISE EXCEPTION 'Distribution revision must be published atomically' USING ERRCODE = '23514'; END IF;
  END IF;
  IF head > 0 AND NOT EXISTS (SELECT 1 FROM public.distribution_revision WHERE package_id = package_key AND revision = head) THEN
    RAISE EXCEPTION 'Distribution current revision is missing' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.catalog_guard_distribution_package()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.current_revision <> 0 THEN RAISE EXCEPTION 'Distribution package starts at revision zero' USING ERRCODE = '23514'; END IF;
  ELSIF NEW.id <> OLD.id OR NEW.identity_shape <> OLD.identity_shape OR NEW.current_revision <> OLD.current_revision + 1 THEN
    RAISE EXCEPTION 'Distribution head can advance by exactly one revision' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS distribution_member_guard ON public.distribution_member;
CREATE TRIGGER distribution_member_guard BEFORE INSERT OR UPDATE OR DELETE ON public.distribution_member FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_distribution_member();
DROP TRIGGER IF EXISTS distribution_member_count ON public.distribution_member;
CREATE TRIGGER distribution_member_count AFTER INSERT ON public.distribution_member REFERENCING NEW TABLE AS inserted_distribution_members FOR EACH STATEMENT EXECUTE FUNCTION public.catalog_count_distribution_members();
DROP TRIGGER IF EXISTS distribution_manifest_guard ON public.distribution_manifest;
CREATE TRIGGER distribution_manifest_guard BEFORE INSERT OR UPDATE OR DELETE ON public.distribution_manifest FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_distribution_manifest();
DROP TRIGGER IF EXISTS distribution_revision_guard ON public.distribution_revision;
CREATE TRIGGER distribution_revision_guard BEFORE INSERT OR UPDATE OR DELETE ON public.distribution_revision FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_distribution_revision();
DROP TRIGGER IF EXISTS distribution_package_guard ON public.distribution_package;
CREATE TRIGGER distribution_package_guard BEFORE INSERT OR UPDATE ON public.distribution_package FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_distribution_package();
DROP TRIGGER IF EXISTS distribution_package_head ON public.distribution_package;
CREATE CONSTRAINT TRIGGER distribution_package_head AFTER INSERT OR UPDATE ON public.distribution_package DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.catalog_require_distribution_head();
DROP TRIGGER IF EXISTS distribution_revision_head ON public.distribution_revision;
CREATE CONSTRAINT TRIGGER distribution_revision_head AFTER INSERT ON public.distribution_revision DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.catalog_require_distribution_head();
