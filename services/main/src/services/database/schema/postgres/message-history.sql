-- Current bodies stay in message. Only edits create closed versions; erasure also removes historical payloads.
CREATE OR REPLACE FUNCTION public.capture_message_revision()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 IF NEW.content IS NOT DISTINCT FROM OLD.content AND NEW.deleted_at IS NOT DISTINCT FROM OLD.deleted_at THEN
   IF NEW.revision<>OLD.revision THEN RAISE EXCEPTION 'Message revision changes require a content transition' USING ERRCODE='23514'; END IF;
   RETURN NEW;
 END IF;
 IF OLD.deleted_at IS NOT NULL AND NEW.content IS NOT NULL THEN
   RAISE EXCEPTION 'Erased message content cannot be restored' USING ERRCODE='23514';
 END IF;
 IF OLD.content IS NOT NULL THEN
   INSERT INTO public.message_revision(conversation_id,message_id,revision,content,valid_from,closed_at,erased_at)
   VALUES(OLD.conversation_id,OLD.id,OLD.revision,
     CASE WHEN NEW.deleted_at IS NULL THEN OLD.content ELSE NULL END,
     OLD.updated_at,clock_timestamp(),CASE WHEN NEW.deleted_at IS NULL THEN NULL ELSE clock_timestamp() END);
 END IF;
 NEW.revision:=OLD.revision+1;
 IF NEW.deleted_at IS NOT NULL THEN
   UPDATE public.message_revision SET content=NULL,erased_at=coalesce(erased_at,clock_timestamp())
   WHERE conversation_id=OLD.conversation_id AND message_id=OLD.id;
 END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE TRIGGER message_capture_revision BEFORE UPDATE ON public.message
FOR EACH ROW EXECUTE FUNCTION public.capture_message_revision();

CREATE OR REPLACE FUNCTION public.guard_message_revision()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 IF NEW.content IS NULL AND NEW.erased_at IS NOT NULL
    AND (to_jsonb(NEW)-ARRAY['content','erased_at'])=(to_jsonb(OLD)-ARRAY['content','erased_at']) THEN RETURN NEW; END IF;
 RAISE EXCEPTION 'Closed message revisions only permit payload erasure' USING ERRCODE='23514';
END $$;
CREATE OR REPLACE TRIGGER message_revision_immutable BEFORE UPDATE ON public.message_revision
FOR EACH ROW EXECUTE FUNCTION public.guard_message_revision();
