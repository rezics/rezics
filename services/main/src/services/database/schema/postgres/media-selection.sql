CREATE OR REPLACE FUNCTION public.media_selection_member_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE slot uuid; rev uuid; frozen boolean;
BEGIN
 IF TG_OP='DELETE' THEN slot:=OLD.slot_id; rev:=OLD.selection_revision_id; ELSE slot:=NEW.slot_id; rev:=NEW.selection_revision_id; END IF;
 SELECT sealed INTO frozen FROM public.media_selection_revision WHERE slot_id=slot AND id=rev FOR SHARE;
 IF frozen THEN RAISE EXCEPTION 'A sealed media selection is immutable' USING ERRCODE='23514'; END IF;
 IF TG_OP='UPDATE' AND (NEW.slot_id<>OLD.slot_id OR NEW.selection_revision_id<>OLD.selection_revision_id) THEN
   RAISE EXCEPTION 'Selection membership cannot change owner' USING ERRCODE='23514';
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $$;
CREATE OR REPLACE TRIGGER media_selection_member_guard BEFORE INSERT OR UPDATE OR DELETE ON public.media_selection_member
FOR EACH ROW EXECUTE FUNCTION public.media_selection_member_guard();

CREATE OR REPLACE FUNCTION public.media_selection_seal_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE minimum integer; maximum integer; members bigint;
BEGIN
 IF TG_OP='UPDATE' AND (NEW.slot_id<>OLD.slot_id OR NEW.id<>OLD.id) THEN RAISE EXCEPTION 'Selection identity cannot change' USING ERRCODE='23514'; END IF;
 IF TG_OP='UPDATE' AND OLD.sealed THEN RAISE EXCEPTION 'A sealed selection cannot be changed' USING ERRCODE='23514'; END IF;
 IF NEW.sealed THEN
  SELECT s.minimum,s.maximum INTO minimum,maximum FROM public.media_slot s WHERE s.id=NEW.slot_id FOR SHARE;
  SELECT count(*) INTO members FROM public.media_selection_member WHERE slot_id=NEW.slot_id AND selection_revision_id=NEW.id;
  IF members<minimum OR members>maximum THEN RAISE EXCEPTION 'Media slot cardinality violated' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE TRIGGER media_selection_seal_guard BEFORE INSERT OR UPDATE ON public.media_selection_revision
FOR EACH ROW EXECUTE FUNCTION public.media_selection_seal_guard();

CREATE OR REPLACE FUNCTION public.media_selection_head_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 PERFORM 1 FROM public.media_selection_revision WHERE slot_id=NEW.slot_id AND id=NEW.revision_id AND sealed FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Selection head requires a sealed exact revision' USING ERRCODE='23514'; END IF;
 IF (TG_OP='INSERT' AND NEW.version<>1) OR (TG_OP='UPDATE' AND NEW.version<>OLD.version+1) THEN
  RAISE EXCEPTION 'Selection version must advance exactly once' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE TRIGGER media_selection_head_guard BEFORE INSERT OR UPDATE ON public.media_selection_head
FOR EACH ROW EXECUTE FUNCTION public.media_selection_head_guard();

-- Scope and bounds are immutable. A changed role/language/cardinality creates a new slot.
CREATE OR REPLACE TRIGGER media_slot_immutable BEFORE UPDATE ON public.media_slot
FOR EACH ROW EXECUTE FUNCTION public.schema_reject_mutation();
CREATE OR REPLACE TRIGGER media_use_immutable BEFORE UPDATE ON public.media_use
FOR EACH ROW EXECUTE FUNCTION public.schema_reject_mutation();
CREATE OR REPLACE TRIGGER media_use_revision_immutable BEFORE UPDATE ON public.media_use_revision
FOR EACH ROW EXECUTE FUNCTION public.schema_reject_mutation();
