-- Bounded slot domains plus uniqueness are the concurrency-safe capacity proof.
-- Advisory locks avoid routine conflicts; the UNIQUE constraints still reject oversubscription under a stale repeatable-read snapshot.
CREATE OR REPLACE FUNCTION public.assign_content_structure_slots() RETURNS trigger
LANGUAGE plpgsql SET search_path TO pg_catalog, public AS $function$
BEGIN
 IF NEW.deleted_at IS NOT NULL THEN RETURN NEW; END IF;
 IF TG_OP='UPDATE' AND OLD.deleted_at IS NULL
  AND OLD.structure_id=NEW.structure_id AND OLD.content_unit_id=NEW.content_unit_id THEN
  NEW.live_structure_slot:=OLD.live_structure_slot;
  NEW.live_content_slot:=OLD.live_content_slot;
  RETURN NEW;
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('content-structure-slots:'||NEW.structure_id::text,0));
 PERFORM pg_advisory_xact_lock(hashtextextended('content-placement-slots:'||NEW.content_unit_id::text,0));
 SELECT candidate::smallint INTO NEW.live_structure_slot FROM generate_series(0,2047) candidate
 WHERE NOT EXISTS(SELECT 1 FROM public.content_structure_node n WHERE n.structure_id=NEW.structure_id AND n.live_structure_slot=candidate AND n.deleted_at IS NULL AND n.id<>NEW.id)
 ORDER BY candidate LIMIT 1;
 IF NEW.live_structure_slot IS NULL THEN RAISE EXCEPTION 'Content structure admits at most 2048 live nodes' USING ERRCODE='23514'; END IF;
 SELECT candidate::smallint INTO NEW.live_content_slot FROM generate_series(0,63) candidate
 WHERE NOT EXISTS(SELECT 1 FROM public.content_structure_node n WHERE n.content_unit_id=NEW.content_unit_id AND n.live_content_slot=candidate AND n.deleted_at IS NULL AND n.id<>NEW.id)
 ORDER BY candidate LIMIT 1;
 IF NEW.live_content_slot IS NULL THEN RAISE EXCEPTION 'Content admits at most 64 live placements' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END;
$function$;
DROP TRIGGER IF EXISTS content_structure_slots_assign ON public.content_structure_node;
CREATE TRIGGER content_structure_slots_assign BEFORE INSERT OR UPDATE ON public.content_structure_node
FOR EACH ROW EXECUTE FUNCTION public.assign_content_structure_slots();
