SET search_path TO public;

-- Modify "software_edition" table
ALTER TABLE "software_edition" DROP CONSTRAINT "software_edition_content_id_software_content_id_fkey";
-- Drop index "software_release_content_reverse_idx" from table: "software_release_content"
DROP INDEX "software_release_content_reverse_idx";
-- Modify "software_release_content" table
ALTER TABLE "software_release_content" DROP COLUMN "edition_id";
-- Create index "software_release_content_reverse_idx" to table: "software_release_content"
CREATE INDEX "software_release_content_reverse_idx" ON "software_release_content" ("content_id", "release_id", "id");
-- Create "operational_application_receipt" table
CREATE TABLE "operational_application_receipt" (
  "consumer_key" text NOT NULL,
  "routing_bucket" integer NOT NULL,
  "operation_id" uuid NOT NULL,
  "task_operation_id" uuid NULL,
  "request_fingerprint" text NOT NULL,
  "outcome" text NOT NULL,
  "detail" text NOT NULL,
  "completed_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("routing_bucket", "consumer_key", "operation_id"),
  CONSTRAINT "operational_receipt_bucket_check" CHECK ((routing_bucket >= 0) AND (routing_bucket <= 1023)),
  CONSTRAINT "operational_receipt_fields_check" CHECK ((request_fingerprint ~ '^[a-f0-9]{64}$'::text) AND ((octet_length(consumer_key) >= 1) AND (octet_length(consumer_key) <= 128)) AND (octet_length(detail) <= 512) AND (outcome = ANY (ARRAY['succeeded'::text, 'cancelled'::text, 'failed'::text, 'superseded'::text])) AND ((task_operation_id IS NULL) OR (task_operation_id = operation_id)))
) PARTITION BY RANGE ("routing_bucket");
-- Create "operational_capacity" table
CREATE TABLE "operational_capacity" (
  "routing_bucket" integer NOT NULL,
  "lane" text NOT NULL,
  "maximum_rows" bigint NOT NULL,
  "maximum_bytes" bigint NOT NULL,
  "reserved_rows" bigint NOT NULL DEFAULT 0,
  "reserved_bytes" bigint NOT NULL DEFAULT 0,
  PRIMARY KEY ("routing_bucket", "lane"),
  CONSTRAINT "operational_capacity_bounds_check" CHECK (((maximum_rows >= 1) AND (maximum_rows <= 1000000000)) AND ((maximum_bytes >= 1) AND (maximum_bytes <= '1000000000000000'::bigint)) AND ((reserved_rows >= 0) AND (reserved_rows <= maximum_rows)) AND ((reserved_bytes >= 0) AND (reserved_bytes <= maximum_bytes))),
  CONSTRAINT "operational_capacity_bucket_check" CHECK ((routing_bucket >= 0) AND (routing_bucket <= 1023)),
  CONSTRAINT "operational_capacity_lane_check" CHECK (lane = ANY (ARRAY['event-outbox'::text, 'task-outbox'::text, 'task-intent'::text, 'receipt'::text]))
);
-- Create "operational_outbox" table
CREATE TABLE "operational_outbox" (
  "routing_bucket" integer NOT NULL,
  "message_id" uuid NOT NULL,
  "message_class" text NOT NULL,
  "kind" text NOT NULL,
  "routing_epoch" bigint NOT NULL,
  "subject" text NOT NULL,
  "aggregate_key" text NOT NULL,
  "occurred_at" timestamptz NOT NULL,
  "payload" jsonb NOT NULL,
  "serialized_envelope" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("routing_bucket", "message_id"),
  CONSTRAINT "operational_outbox_bucket_check" CHECK ((routing_bucket >= 0) AND (routing_bucket <= 1023)),
  CONSTRAINT "operational_outbox_fields_check" CHECK ((message_class = ANY (ARRAY['event'::text, 'task'::text])) AND ((octet_length(kind) >= 1) AND (octet_length(kind) <= 128)) AND (kind ~ '^[a-z][a-z0-9_-]*(\.[a-z][a-z0-9_-]*)*$'::text) AND ((routing_epoch >= 1) AND (routing_epoch <= '9007199254740991'::bigint)) AND ((octet_length(subject) >= 1) AND (octet_length(subject) <= 256)) AND ((octet_length(aggregate_key) >= 1) AND (octet_length(aggregate_key) <= 1024)) AND (subject = ((((((('rezics.'::text ||
CASE
    WHEN (message_class = 'event'::text) THEN 'events'::text
    ELSE 'tasks'::text
END) || '.e'::text) || (routing_epoch)::text) || '.b'::text) || (routing_bucket)::text) || '.'::text) || kind))),
  CONSTRAINT "operational_outbox_payload_check" CHECK (((jsonb_typeof(payload) = 'object'::text) AND (octet_length(serialized_envelope) <= 65536) AND ((serialized_envelope)::jsonb = payload) AND ((payload ->> 'version'::text) = '1'::text) AND ((payload ->> 'messageId'::text) = (message_id)::text) AND ((payload ->> 'class'::text) = message_class) AND ((payload ->> 'kind'::text) = kind) AND ((payload ->> 'routingBucket'::text) = (routing_bucket)::text) AND ((payload ->> 'routingEpoch'::text) = (routing_epoch)::text) AND (((payload -> 'aggregate'::text) ->> 'key'::text) = aggregate_key) AND (((payload ->> 'occurredAt'::text))::timestamp with time zone = occurred_at)) IS TRUE),
  CONSTRAINT "operational_outbox_route_check" CHECK ((routing_bucket = mod(((get_byte(sha256(convert_to(((((payload -> 'aggregate'::text) ->> 'owner'::text) || ':'::text) || aggregate_key), 'UTF8'::name)), 0) * 256) + get_byte(sha256(convert_to(((((payload -> 'aggregate'::text) ->> 'owner'::text) || ':'::text) || aggregate_key), 'UTF8'::name)), 1)), 1024)) IS TRUE)
) PARTITION BY RANGE ("routing_bucket");
-- Create "operational_task_intent" table
CREATE TABLE "operational_task_intent" (
  "routing_bucket" integer NOT NULL,
  "operation_id" uuid NOT NULL,
  "consumer_key" text NOT NULL,
  "request_fingerprint" text NOT NULL,
  "origin_message_id" uuid NOT NULL,
  "state" text NOT NULL DEFAULT 'pending',
  "fencing_generation" bigint NOT NULL DEFAULT 0,
  "attempt_count" integer NOT NULL DEFAULT 0,
  "maximum_attempts" integer NOT NULL,
  "deadline" timestamptz NOT NULL,
  "available_at" timestamptz NOT NULL DEFAULT now(),
  "lease_expires_at" timestamptz NULL,
  "last_error" text NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("routing_bucket", "operation_id"),
  CONSTRAINT "operational_task_bucket_check" CHECK ((routing_bucket >= 0) AND (routing_bucket <= 1023)),
  CONSTRAINT "operational_task_request_check" CHECK ((request_fingerprint ~ '^[a-f0-9]{64}$'::text) AND ((octet_length(consumer_key) >= 1) AND (octet_length(consumer_key) <= 128)) AND ((maximum_attempts >= 1) AND (maximum_attempts <= 32)) AND ((attempt_count >= 0) AND (attempt_count <= maximum_attempts)) AND (fencing_generation >= 0) AND (deadline > created_at) AND (deadline <= (created_at + '7 days'::interval)) AND ((last_error IS NULL) OR (octet_length(last_error) <= 512))),
  CONSTRAINT "operational_task_state_check" CHECK ((state = ANY (ARRAY['pending'::text, 'running'::text, 'succeeded'::text, 'cancelled'::text, 'failed'::text, 'superseded'::text])) AND (((state = 'running'::text) AND (lease_expires_at IS NOT NULL) AND (fencing_generation > 0) AND (attempt_count > 0)) OR ((state <> 'running'::text) AND (lease_expires_at IS NULL))))
) PARTITION BY RANGE ("routing_bucket");
-- Create "software_participation_context" table
CREATE TABLE "software_participation_context" (
  "content_id" uuid NOT NULL,
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "current_revision" bigint NULL,
  PRIMARY KEY ("content_id", "id"),
  CONSTRAINT "software_context_revision_check" CHECK ((current_revision IS NULL) OR ((current_revision >= 1) AND (current_revision <= '9007199254740991'::bigint)))
);
-- Create "software_participation_context_revision" table
CREATE TABLE "software_participation_context_revision" (
  "content_id" uuid NOT NULL,
  "context_id" uuid NOT NULL,
  "revision" bigint NOT NULL,
  "label" text NULL,
  "language_tag" text NULL,
  "state" text NOT NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "created_by_auth_user_id" uuid NOT NULL,
  PRIMARY KEY ("content_id", "context_id", "revision"),
  CONSTRAINT "software_context_revision_label_check" CHECK ((label IS NULL) OR ((octet_length(label) >= 1) AND (octet_length(label) <= 4096))),
  CONSTRAINT "software_context_revision_language_check" CHECK ((language_tag IS NULL) OR ((octet_length(language_tag) >= 1) AND (octet_length(language_tag) <= 255))),
  CONSTRAINT "software_context_revision_number_check" CHECK ((revision >= 1) AND (revision <= '9007199254740991'::bigint)),
  CONSTRAINT "software_context_revision_state_check" CHECK (state = ANY (ARRAY['active'::text, 'withdrawn'::text]))
);
-- Create index "software_context_revision_actor_idx" to table: "software_participation_context_revision"
CREATE INDEX "software_context_revision_actor_idx" ON "software_participation_context_revision" ("created_by_auth_user_id", "content_id", "context_id", "revision");
-- Create "software_participation_source_occurrence" table
CREATE TABLE "software_participation_source_occurrence" (
  "source_record_id" uuid NOT NULL,
  "snapshot_id" uuid NOT NULL,
  "namespace" text NOT NULL,
  "local_key" text NOT NULL,
  "content_id" uuid NOT NULL,
  "context_id" uuid NOT NULL,
  "context_revision" bigint NOT NULL,
  "source_pointer" text NOT NULL,
  "source_label" text NOT NULL,
  "source_language" text NULL,
  "source_language_tag" text NULL,
  "source_claimed_official" boolean NOT NULL,
  PRIMARY KEY ("source_record_id", "snapshot_id", "namespace", "local_key"),
  CONSTRAINT "software_context_occurrence_key_check" CHECK (((octet_length(namespace) >= 1) AND (octet_length(namespace) <= 96)) AND ((octet_length(local_key) >= 1) AND (octet_length(local_key) <= 128)) AND ((octet_length(source_pointer) >= 1) AND (octet_length(source_pointer) <= 512))),
  CONSTRAINT "software_context_occurrence_label_check" CHECK (octet_length(source_label) <= 4096),
  CONSTRAINT "software_context_occurrence_language_check" CHECK (((source_language IS NULL) AND (source_language_tag IS NULL)) OR ((source_language IS NOT NULL) AND (source_language_tag IS NOT NULL) AND ((octet_length(source_language) >= 1) AND (octet_length(source_language) <= 255)) AND ((octet_length(source_language_tag) >= 1) AND (octet_length(source_language_tag) <= 255))))
);
-- Create index "software_context_occurrence_target_idx" to table: "software_participation_source_occurrence"
CREATE INDEX "software_context_occurrence_target_idx" ON "software_participation_source_occurrence" ("content_id", "context_id", "context_revision", "source_record_id", "snapshot_id");
-- Modify "operational_application_receipt" table
ALTER TABLE "operational_application_receipt" ADD CONSTRAINT "operational_receipt_task_fk" FOREIGN KEY ("routing_bucket", "task_operation_id") REFERENCES "operational_task_intent" ("routing_bucket", "operation_id") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Modify "operational_task_intent" table
ALTER TABLE "operational_task_intent" ADD CONSTRAINT "operational_task_origin_fk" FOREIGN KEY ("routing_bucket", "origin_message_id") REFERENCES "operational_outbox" ("routing_bucket", "message_id") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Modify "software_participation_context" table
ALTER TABLE "software_participation_context" ADD CONSTRAINT "software_context_current_revision_fk" FOREIGN KEY ("content_id", "id", "current_revision") REFERENCES "software_participation_context_revision" ("content_id", "context_id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT, ADD CONSTRAINT "software_participation_context_FQqo0jt7mLip_fkey" FOREIGN KEY ("content_id") REFERENCES "software_content" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Modify "software_participation_context_revision" table
ALTER TABLE "software_participation_context_revision" ADD CONSTRAINT "software_context_revision_context_fk" FOREIGN KEY ("content_id", "context_id") REFERENCES "software_participation_context" ("content_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT, ADD CONSTRAINT "software_participation_context_revision_RGiE2PRE282e_fkey" FOREIGN KEY ("created_by_auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Modify "software_participation_source_occurrence" table
ALTER TABLE "software_participation_source_occurrence" ADD CONSTRAINT "software_context_occurrence_revision_fk" FOREIGN KEY ("content_id", "context_id", "context_revision") REFERENCES "software_participation_context_revision" ("content_id", "context_id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT, ADD CONSTRAINT "software_context_occurrence_snapshot_fk" FOREIGN KEY ("source_record_id", "snapshot_id") REFERENCES "catalog_source_snapshot" ("source_record_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Drop "software_edition" table
DROP TABLE "software_edition";

CREATE OR REPLACE FUNCTION public.catalog_guard_software_context()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF TG_OP = 'DELETE' OR (TG_OP = 'UPDATE' AND
      (NEW.content_id <> OLD.content_id OR NEW.id <> OLD.id OR
       NEW.current_revision IS NULL OR
       NEW.current_revision <> coalesce(OLD.current_revision, 0) + 1)) THEN
    RAISE EXCEPTION 'Participation context identity is immutable and its head must advance by one'
      USING ERRCODE = '23514', CONSTRAINT = 'software_context_transition_check';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.catalog_require_software_context_head()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.software_participation_context
             WHERE content_id = NEW.content_id AND id = NEW.id AND current_revision IS NULL) THEN
    RAISE EXCEPTION 'Participation context must have a current revision at commit'
      USING ERRCODE = '23514', CONSTRAINT = 'software_context_committed_head_check';
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.catalog_guard_software_context_revision()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE current_head bigint;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'Participation context revisions and source occurrences are immutable'
      USING ERRCODE = '23514', CONSTRAINT = 'software_context_history_immutable';
  END IF;
  SELECT current_revision INTO current_head FROM public.software_participation_context
    WHERE content_id = NEW.content_id AND id = NEW.context_id FOR UPDATE;
  IF FOUND AND NEW.revision <> coalesce(current_head, 0) + 1 THEN
    RAISE EXCEPTION 'Participation context revisions must append at the current head'
      USING ERRCODE = '23514', CONSTRAINT = 'software_context_revision_sequence_check';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS software_context_guard ON public.software_participation_context;
CREATE TRIGGER software_context_guard BEFORE UPDATE OR DELETE ON public.software_participation_context
FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_software_context();

DROP TRIGGER IF EXISTS software_context_head_required ON public.software_participation_context;
CREATE CONSTRAINT TRIGGER software_context_head_required AFTER INSERT OR UPDATE ON public.software_participation_context
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.catalog_require_software_context_head();

DROP TRIGGER IF EXISTS software_context_revision_guard ON public.software_participation_context_revision;
CREATE TRIGGER software_context_revision_guard BEFORE INSERT OR UPDATE OR DELETE ON public.software_participation_context_revision
FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_software_context_revision();

DROP TRIGGER IF EXISTS software_context_occurrence_guard ON public.software_participation_source_occurrence;
CREATE TRIGGER software_context_occurrence_guard BEFORE UPDATE OR DELETE ON public.software_participation_source_occurrence
FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_software_context_revision();

CREATE OR REPLACE FUNCTION public.catalog_require_software_context_revision_head()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.software_participation_context
             WHERE content_id = NEW.content_id AND id = NEW.context_id
             AND (current_revision IS NULL OR current_revision < NEW.revision)) THEN
    RAISE EXCEPTION 'Participation context appended revision must become current in its transaction'
      USING ERRCODE = '23514', CONSTRAINT = 'software_context_appended_head_check';
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS software_context_revision_head_required ON public.software_participation_context_revision;
CREATE CONSTRAINT TRIGGER software_context_revision_head_required AFTER INSERT ON public.software_participation_context_revision
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.catalog_require_software_context_revision_head();


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

-- Atlas Community inspects partitioned parents but omits their physical children.
-- All parent keys/constraints come from the typed exporter; this overlay owns only placement.
DO $$
DECLARE owner_table text; partition_number integer;
BEGIN
  FOREACH owner_table IN ARRAY ARRAY['operational_outbox', 'operational_task_intent', 'operational_application_receipt'] LOOP
    FOR partition_number IN 0..63 LOOP
      EXECUTE format('CREATE TABLE IF NOT EXISTS public.%I PARTITION OF public.%I FOR VALUES FROM (%s) TO (%s)',
        owner_table || '_p' || lpad(partition_number::text, 2, '0'), owner_table,
        partition_number * 16, (partition_number + 1) * 16);
    END LOOP;
  END LOOP;
END;
$$;
