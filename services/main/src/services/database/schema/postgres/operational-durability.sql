CREATE OR REPLACE FUNCTION public.operational_reserve_capacity(bucket integer, capacity_lane text, row_count bigint, byte_count bigint)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF row_count < 1 OR byte_count < 1 THEN RAISE EXCEPTION 'capacity reservations must be positive' USING ERRCODE = '23514'; END IF;
  UPDATE public.operational_capacity SET reserved_rows = reserved_rows + row_count, reserved_bytes = reserved_bytes + byte_count
  WHERE routing_bucket = bucket AND lane = capacity_lane
    AND reserved_rows <= maximum_rows - row_count AND reserved_bytes <= maximum_bytes - byte_count;
  IF NOT FOUND THEN RAISE EXCEPTION 'operational admission exhausted for bucket %, lane %', bucket, capacity_lane USING ERRCODE = '53000'; END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.operational_account_insert()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE intent public.operational_task_intent%ROWTYPE; origin public.operational_outbox%ROWTYPE;
BEGIN
  IF TG_ARGV[0] = 'outbox' THEN
    PERFORM public.operational_reserve_capacity(NEW.routing_bucket, NEW.message_class || '-outbox', 1, octet_length(NEW.payload::text) + octet_length(NEW.serialized_envelope) + 2048);
  ELSIF TG_ARGV[0] = 'task' THEN
    SELECT * INTO STRICT origin FROM public.operational_outbox
      WHERE routing_bucket = NEW.routing_bucket AND message_id = NEW.origin_message_id;
    IF (origin.message_class = 'task' AND origin.payload->'payload'->>'operationId' = NEW.operation_id::text
       AND origin.payload->'payload'->>'consumerKey' = NEW.consumer_key
       AND origin.payload->'payload'->>'maximumAttempts' = NEW.maximum_attempts::text
       AND (origin.payload->'payload'->>'deadline')::timestamptz = NEW.deadline
       AND NEW.state = 'pending' AND NEW.fencing_generation = 0 AND NEW.attempt_count = 0) IS NOT TRUE THEN
      RAISE EXCEPTION 'task intent does not match admitted envelope' USING ERRCODE = '23514';
    END IF;
    PERFORM public.operational_reserve_capacity(NEW.routing_bucket, 'task-intent', 1, 2048);
    -- Reserve terminal proof at admission so full queues can still drain.
    PERFORM public.operational_reserve_capacity(NEW.routing_bucket, 'receipt', 1, 2048);
  ELSIF NEW.task_operation_id IS NULL THEN
    PERFORM public.operational_reserve_capacity(NEW.routing_bucket, 'receipt', 1, 2048);
  ELSE
    SELECT * INTO STRICT intent FROM public.operational_task_intent
    WHERE routing_bucket = NEW.routing_bucket AND operation_id = NEW.task_operation_id FOR UPDATE;
    IF intent.consumer_key <> NEW.consumer_key OR intent.request_fingerprint <> NEW.request_fingerprint OR intent.state <> NEW.outcome THEN
      RAISE EXCEPTION 'task receipt does not match terminal intent' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.operational_guard_immutable()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' OR TG_ARGV[0] <> 'task' THEN
    RAISE EXCEPTION 'operational durability row is retained and immutable' USING ERRCODE = '23514';
  END IF;
  IF ROW(NEW.routing_bucket, NEW.operation_id, NEW.consumer_key, NEW.request_fingerprint, NEW.origin_message_id, NEW.maximum_attempts, NEW.deadline, NEW.created_at)
     IS DISTINCT FROM ROW(OLD.routing_bucket, OLD.operation_id, OLD.consumer_key, OLD.request_fingerprint, OLD.origin_message_id, OLD.maximum_attempts, OLD.deadline, OLD.created_at)
     OR OLD.state IN ('succeeded','cancelled','failed','superseded')
     OR NEW.fencing_generation < OLD.fencing_generation OR NEW.attempt_count < OLD.attempt_count THEN
    RAISE EXCEPTION 'immutable task request or terminal result changed' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS operational_outbox_account ON public.operational_outbox;
CREATE TRIGGER operational_outbox_account AFTER INSERT ON public.operational_outbox FOR EACH ROW EXECUTE FUNCTION public.operational_account_insert('outbox');
DROP TRIGGER IF EXISTS operational_task_account ON public.operational_task_intent;
CREATE TRIGGER operational_task_account AFTER INSERT ON public.operational_task_intent FOR EACH ROW EXECUTE FUNCTION public.operational_account_insert('task');
DROP TRIGGER IF EXISTS operational_receipt_account ON public.operational_application_receipt;
CREATE TRIGGER operational_receipt_account AFTER INSERT ON public.operational_application_receipt FOR EACH ROW EXECUTE FUNCTION public.operational_account_insert('receipt');
DROP TRIGGER IF EXISTS operational_outbox_immutable ON public.operational_outbox;
CREATE TRIGGER operational_outbox_immutable BEFORE UPDATE OR DELETE ON public.operational_outbox FOR EACH ROW EXECUTE FUNCTION public.operational_guard_immutable('outbox');
DROP TRIGGER IF EXISTS operational_task_immutable ON public.operational_task_intent;
CREATE TRIGGER operational_task_immutable BEFORE UPDATE OR DELETE ON public.operational_task_intent FOR EACH ROW EXECUTE FUNCTION public.operational_guard_immutable('task');
DROP TRIGGER IF EXISTS operational_receipt_immutable ON public.operational_application_receipt;
CREATE TRIGGER operational_receipt_immutable BEFORE UPDATE OR DELETE ON public.operational_application_receipt FOR EACH ROW EXECUTE FUNCTION public.operational_guard_immutable('receipt');
