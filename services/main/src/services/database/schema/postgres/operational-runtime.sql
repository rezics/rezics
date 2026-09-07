CREATE OR REPLACE FUNCTION public.operational_enqueue_relay()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.operational_relay_pending(routing_bucket,message_id,message_class,routing_epoch,created_at)
  VALUES(NEW.routing_bucket,NEW.message_id,NEW.message_class,NEW.routing_epoch,NEW.created_at);
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS operational_outbox_relay ON public.operational_outbox;
CREATE TRIGGER operational_outbox_relay AFTER INSERT ON public.operational_outbox
FOR EACH ROW EXECUTE FUNCTION public.operational_enqueue_relay();

