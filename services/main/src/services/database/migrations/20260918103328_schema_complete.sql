SET search_path TO public;

ALTER TABLE "media_blob" ALTER COLUMN "byte_length" SET DATA TYPE numeric USING "byte_length"::numeric;
ALTER TABLE "media_fragment" ALTER COLUMN "start_ticks" SET DATA TYPE numeric USING "start_ticks"::numeric;
ALTER TABLE "media_fragment" ALTER COLUMN "end_ticks" SET DATA TYPE numeric USING "end_ticks"::numeric;
ALTER TABLE "media_observation" ALTER COLUMN "byte_length" SET DATA TYPE numeric USING "byte_length"::numeric;
ALTER TABLE "media_representation" ALTER COLUMN "width" SET DATA TYPE numeric USING "width"::numeric;
ALTER TABLE "media_representation" ALTER COLUMN "height" SET DATA TYPE numeric USING "height"::numeric;
ALTER TABLE "media_representation" ALTER COLUMN "duration_ticks" SET DATA TYPE numeric USING "duration_ticks"::numeric;
ALTER TABLE "media_representation" ALTER COLUMN "byte_length" SET DATA TYPE numeric USING "byte_length"::numeric;
ALTER TABLE "media_stream" ALTER COLUMN "duration_ticks" SET DATA TYPE numeric USING "duration_ticks"::numeric;
ALTER TABLE "participation_meter" ALTER COLUMN "balance" SET DATA TYPE numeric USING "balance"::numeric;
ALTER TABLE "participation_meter_entry" ALTER COLUMN "delta" SET DATA TYPE numeric USING "delta"::numeric;
ALTER TABLE "subscription_price" ALTER COLUMN "minor_units" SET DATA TYPE numeric USING "minor_units"::numeric;
ALTER TABLE "participation_meter" ADD CONSTRAINT "participation_meter_balance_integer" CHECK ("balance"=trunc("balance") and abs("balance")<1e40);
ALTER TABLE "participation_meter_entry" ADD CONSTRAINT "participation_meter_delta_integer" CHECK ("delta"=trunc("delta") and abs("delta")<1e40);
ALTER TABLE "media_blob" DROP CONSTRAINT "media_blob_bytes", ADD CONSTRAINT "media_blob_bytes" CHECK ("byte_length">=0 and "byte_length"=trunc("byte_length") and "byte_length"<1e40);
ALTER TABLE "media_fragment" DROP CONSTRAINT "media_fragment_time", ADD CONSTRAINT "media_fragment_time" CHECK (num_nonnulls("start_ticks","end_ticks","time_scale") in (0,3) and ("time_scale" is null or ("time_scale">0 and "start_ticks">=0 and "start_ticks"=trunc("start_ticks") and "end_ticks"=trunc("end_ticks") and "end_ticks"<1e40 and "end_ticks">="start_ticks")));
ALTER TABLE "media_observation" DROP CONSTRAINT "media_observation_bytes", ADD CONSTRAINT "media_observation_bytes" CHECK ("byte_length" is null or "byte_length">=0 and "byte_length"=trunc("byte_length") and "byte_length"<1e40);
ALTER TABLE "media_representation" DROP CONSTRAINT "media_representation_values", ADD CONSTRAINT "media_representation_values" CHECK (("byte_length" is null or "byte_length">=0 and "byte_length"=trunc("byte_length") and "byte_length"<1e40) and ("channels" is null or "channels">0) and ("sample_rate" is null or "sample_rate">0));
ALTER TABLE "media_representation" DROP CONSTRAINT "media_representation_dimensions", ADD CONSTRAINT "media_representation_dimensions" CHECK (("width" is null or "width">0 and "width"=trunc("width") and "width"<1e40) and ("height" is null or "height">0 and "height"=trunc("height") and "height"<1e40));
ALTER TABLE "media_representation" DROP CONSTRAINT "media_representation_time", ADD CONSTRAINT "media_representation_time" CHECK (num_nonnulls("duration_ticks","time_scale") in (0,2) and ("duration_ticks" is null or ("duration_ticks">=0 and "duration_ticks"=trunc("duration_ticks") and "duration_ticks"<1e40 and "time_scale">0)));
ALTER TABLE "media_stream" DROP CONSTRAINT "media_stream_time", ADD CONSTRAINT "media_stream_time" CHECK (num_nonnulls("duration_ticks","time_scale") in (0,2) and ("duration_ticks" is null or ("duration_ticks">=0 and "duration_ticks"=trunc("duration_ticks") and "duration_ticks"<1e40 and "time_scale">0)));
ALTER TABLE "registry_file" DROP CONSTRAINT "registry_file_path", ADD CONSTRAINT "registry_file_path" CHECK ("path"<>'' and "path" not like '/%' and "path" !~ '(^|/)[.][.](/|$)');
ALTER TABLE "subscription_price" DROP CONSTRAINT "subscription_price_value", ADD CONSTRAINT "subscription_price_value" CHECK ("currency" ~ '^[A-Z]{3}$' and "minor_units">=0 and "minor_units"=trunc("minor_units") and "minor_units"<1e40 and "interval_count">0 and "interval_unit" in ('day','week','month','year','one-time'));

-- Canonical vocabulary integrity guards. Install through the main schema_complete migration bundle.
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
    'schema_relation','schema_relation_revision','schema_relation_selection',
    'schema_node','schema_statement','schema_contract','schema_contract_field','schema_contract_keyword','schema_contract_reference','catalog_definition_binding'
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

CREATE OR REPLACE FUNCTION public.schema_statement_shape_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM schema_node WHERE release_id=NEW.release_id AND id=NEW.subject_id AND kind IN ('iri','blank'))
 OR NOT EXISTS(SELECT 1 FROM schema_node WHERE release_id=NEW.release_id AND id=NEW.graph_id AND kind IN ('iri','blank','default-graph')) THEN
 RAISE EXCEPTION 'Invalid RDF subject or graph node' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE TRIGGER schema_statement_shape_guard BEFORE INSERT ON public.schema_statement FOR EACH ROW EXECUTE FUNCTION public.schema_statement_shape_guard();


-- Domain-local revision authority. No global content/identity insert is required.
CREATE OR REPLACE FUNCTION public.description_revision_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 IF TG_OP='UPDATE' THEN
  IF NEW.payload_state='erased' AND (to_jsonb(NEW)-'payload_state')=(to_jsonb(OLD)-'payload_state') THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'Description revisions only permit payload erasure' USING ERRCODE='23514';
 END IF;
 IF NEW.parent_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.description_revision WHERE object_id=NEW.object_id AND id=NEW.parent_id) THEN
  RAISE EXCEPTION 'Description parent must already exist for this object' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE TRIGGER description_revision_guard BEFORE INSERT OR UPDATE ON public.description_revision FOR EACH ROW EXECUTE FUNCTION public.description_revision_guard();

CREATE OR REPLACE FUNCTION public.description_selection_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 PERFORM 1 FROM public.description_object WHERE id=NEW.object_id AND state<>'erased' FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Description is unavailable' USING ERRCODE='23514'; END IF;
 PERFORM 1 FROM public.description_revision WHERE object_id=NEW.object_id AND id=NEW.revision_id AND payload_state='available' FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Description revision is unavailable' USING ERRCODE='23514'; END IF;
 IF (TG_OP='INSERT' AND NEW.version<>1) OR (TG_OP='UPDATE' AND (NEW.object_id<>OLD.object_id OR NEW.version<>OLD.version+1)) THEN
  RAISE EXCEPTION 'Description selection version must advance exactly once' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE TRIGGER description_selection_guard BEFORE INSERT OR UPDATE ON public.description_selection FOR EACH ROW EXECUTE FUNCTION public.description_selection_guard();
CREATE OR REPLACE TRIGGER description_change_immutable BEFORE UPDATE OR DELETE ON public.description_change FOR EACH ROW EXECUTE FUNCTION public.schema_reject_mutation();
CREATE OR REPLACE TRIGGER description_statement_immutable BEFORE UPDATE ON public.description_statement FOR EACH ROW EXECUTE FUNCTION public.schema_reject_mutation();
CREATE OR REPLACE TRIGGER description_type_immutable BEFORE UPDATE ON public.description_type FOR EACH ROW EXECUTE FUNCTION public.schema_reject_mutation();

CREATE OR REPLACE FUNCTION public.wiki_revision_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 IF NEW.parent_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.wiki_revision WHERE page_id=NEW.page_id AND id=NEW.parent_id AND language=NEW.language) THEN
  RAISE EXCEPTION 'Wiki parent must already exist in this page and language' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE TRIGGER wiki_revision_parent BEFORE INSERT ON public.wiki_revision FOR EACH ROW EXECUTE FUNCTION public.wiki_revision_guard();
CREATE OR REPLACE TRIGGER wiki_revision_immutable BEFORE UPDATE ON public.wiki_revision FOR EACH ROW EXECUTE FUNCTION public.schema_reject_mutation();
CREATE OR REPLACE TRIGGER wiki_payload_immutable BEFORE UPDATE ON public.wiki_revision_payload FOR EACH ROW EXECUTE FUNCTION public.schema_reject_mutation();

CREATE OR REPLACE FUNCTION public.wiki_selection_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 PERFORM 1 FROM public.wiki_page WHERE id=NEW.page_id AND state<>'erased' FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Wiki page is unavailable' USING ERRCODE='23514'; END IF;
 PERFORM 1 FROM public.wiki_revision_payload WHERE page_id=NEW.page_id AND revision_id=NEW.revision_id FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Wiki payload is unavailable' USING ERRCODE='23514'; END IF;
 IF (TG_OP='INSERT' AND NEW.version<>1) OR (TG_OP='UPDATE' AND (NEW.page_id<>OLD.page_id OR NEW.language<>OLD.language OR NEW.version<>OLD.version+1)) THEN
  RAISE EXCEPTION 'Wiki selection version must advance exactly once' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE TRIGGER wiki_head_guard BEFORE INSERT OR UPDATE ON public.wiki_head FOR EACH ROW EXECUTE FUNCTION public.wiki_selection_guard();
CREATE OR REPLACE TRIGGER wiki_selection_guard BEFORE INSERT OR UPDATE ON public.wiki_selection FOR EACH ROW EXECUTE FUNCTION public.wiki_selection_guard();


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


DROP TRIGGER IF EXISTS reference_value_immutable ON public.reference_value;
CREATE TRIGGER reference_value_immutable
BEFORE UPDATE OR DELETE ON public.reference_value
FOR EACH ROW EXECUTE FUNCTION public.reject_immutable_history_mutation();

-- Internal projection only: resolving a reference grants no access to its target.
-- VOLATILE observes references admitted by the calling statement, including data-modifying CTEs.
CREATE OR REPLACE FUNCTION public.reference_value_native_id(value_id uuid)
RETURNS uuid LANGUAGE sql VOLATILE STRICT SET search_path = pg_catalog, public AS $$
  SELECT coalesce(target_publishing_id, target_music_id, target_program_id,
    target_software_id, target_entity_id, target_grouping_id, target_reference_id,
    target_distribution_id, target_video_id, target_audio_id, target_post_id,
    target_poll_id, target_zone_id, target_realm_id, target_realm_rule_id,
    target_custom_theme_id, target_collection_id, target_tag_id, target_tag_path_id,
    target_label_id, target_description_id, target_wiki_id, target_indexed_media_id,
    target_vocabulary_term_id, target_semantic_relation_id)
  FROM public.reference_value WHERE id = value_id
$$;


-- Private conversation membership uses Auth; public sender identity is an immutable snapshot.
CREATE OR REPLACE FUNCTION public.participation_guard_conversation()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE admitted integer;
BEGIN
  IF NEW.kind='group' THEN RETURN NEW; END IF;
  SELECT count(*) INTO admitted FROM (
    SELECT account.id FROM public.users account JOIN public.auth_entity self ON self.auth_user_id = account.id
    WHERE account.erased_at IS NULL AND self.state = 'active' AND
      ((account.id = NEW.participant_low_auth_user_id AND self.entity_id = NEW.participant_low_entity_id) OR
       (account.id = NEW.participant_high_auth_user_id AND self.entity_id = NEW.participant_high_entity_id))
    ORDER BY account.id FOR SHARE OF account, self
  ) admitted_accounts;
  IF admitted <> 2 THEN RAISE EXCEPTION 'Conversation participants require two current private accounts' USING ERRCODE = '23514', CONSTRAINT = 'active_account_required'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('direct-message:' || NEW.participant_low_auth_user_id::text || ':' || NEW.participant_high_auth_user_id::text, 0));
  IF EXISTS(SELECT 1 FROM public.account_entity_block WHERE
      (blocker_auth_user_id = NEW.participant_low_auth_user_id AND blocked_entity_id = NEW.participant_high_entity_id) OR
      (blocker_auth_user_id = NEW.participant_high_auth_user_id AND blocked_entity_id = NEW.participant_low_entity_id)) THEN
    RAISE EXCEPTION 'Direct messaging is blocked' USING ERRCODE = '23514', CONSTRAINT = 'direct_message_blocked';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS participation_conversation_guard ON public.conversation;
CREATE TRIGGER participation_conversation_guard BEFORE INSERT ON public.conversation
FOR EACH ROW EXECUTE FUNCTION public.participation_guard_conversation();

CREATE OR REPLACE FUNCTION public.participation_guard_message()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE pair public.conversation%ROWTYPE; admitted integer;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.content IS NULL AND NEW.deleted_at IS NOT NULL THEN RETURN NEW; END IF;
  SELECT * INTO pair FROM public.conversation WHERE id = NEW.conversation_id;
  IF pair.kind='group' THEN
    PERFORM 1 FROM public.conversation_member member
    JOIN public.users account ON account.id=member.user_id
    JOIN public.auth_entity self ON self.auth_user_id=account.id AND self.entity_id=member.entity_id
    WHERE member.conversation_id=NEW.conversation_id AND member.user_id=NEW.sender_auth_user_id
      AND member.entity_id=NEW.sender_entity_id AND member.left_at IS NULL
      AND account.erased_at IS NULL AND self.state='active' FOR SHARE OF member, account, self;
    IF NOT FOUND THEN RAISE EXCEPTION 'Group message requires a current admitted member' USING ERRCODE='23514'; END IF;
    RETURN NEW;
  END IF;
  IF NOT FOUND OR NOT ((NEW.sender_auth_user_id = pair.participant_low_auth_user_id AND NEW.sender_entity_id = pair.participant_low_entity_id) OR
    (NEW.sender_auth_user_id = pair.participant_high_auth_user_id AND NEW.sender_entity_id = pair.participant_high_entity_id)) THEN
    RAISE EXCEPTION 'Message sender is not the admitted participant' USING ERRCODE = '23514';
  END IF;
  SELECT count(*) INTO admitted FROM (
    SELECT id FROM public.users WHERE id IN (pair.participant_low_auth_user_id, pair.participant_high_auth_user_id)
      AND erased_at IS NULL ORDER BY id FOR SHARE
  ) accounts;
  IF admitted <> 2 THEN RAISE EXCEPTION 'Conversation account is unavailable' USING ERRCODE = '23514', CONSTRAINT = 'active_account_required'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('direct-message:' || pair.participant_low_auth_user_id::text || ':' || pair.participant_high_auth_user_id::text, 0));
  IF EXISTS(SELECT 1 FROM public.account_entity_block WHERE
    (blocker_auth_user_id = pair.participant_low_auth_user_id AND blocked_entity_id = pair.participant_high_entity_id) OR
    (blocker_auth_user_id = pair.participant_high_auth_user_id AND blocked_entity_id = pair.participant_low_entity_id)) THEN
    RAISE EXCEPTION 'Direct messaging is blocked' USING ERRCODE = '23514', CONSTRAINT = 'direct_message_blocked';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS participation_message_guard ON public.message;
CREATE TRIGGER participation_message_guard BEFORE INSERT OR UPDATE OF content, deleted_at ON public.message
FOR EACH ROW EXECUTE FUNCTION public.participation_guard_message();

CREATE OR REPLACE FUNCTION public.participation_guard_account_block()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE target_auth uuid;
BEGIN
  SELECT auth_user_id INTO target_auth FROM public.auth_entity WHERE entity_id = NEW.blocked_entity_id;
  IF target_auth = NEW.blocker_auth_user_id THEN
    RAISE EXCEPTION 'An account cannot block its own self identity' USING ERRCODE = '23514';
  END IF;
  IF target_auth IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended('direct-message:' || least(target_auth, NEW.blocker_auth_user_id)::text || ':' || greatest(target_auth, NEW.blocker_auth_user_id)::text, 0));
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS participation_account_block_guard ON public.account_entity_block;
CREATE TRIGGER participation_account_block_guard BEFORE INSERT ON public.account_entity_block
FOR EACH ROW EXECUTE FUNCTION public.participation_guard_account_block();

DROP TRIGGER IF EXISTS participation_private_account_guard ON public.account_entity_block;
CREATE TRIGGER participation_private_account_guard BEFORE INSERT OR UPDATE OF blocker_auth_user_id ON public.account_entity_block
FOR EACH ROW EXECUTE FUNCTION public.participation_require_unerased_account('blocker_auth_user_id');
DROP TRIGGER IF EXISTS participation_private_account_guard ON public.conversation_read;
CREATE TRIGGER participation_private_account_guard BEFORE INSERT OR UPDATE OF auth_user_id ON public.conversation_read
FOR EACH ROW EXECUTE FUNCTION public.participation_require_unerased_account('auth_user_id');
CREATE OR REPLACE FUNCTION public.initialize_conversation_stats()
 RETURNS trigger
 LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $function$
BEGIN
  INSERT INTO conversation_stat (conversation_id) VALUES (NEW.id);
  IF NEW.kind='group' THEN RETURN NULL; END IF;
  INSERT INTO conversation_participant_stat (conversation_id, auth_user_id, sort_at)
  VALUES (NEW.id, NEW.kind, NEW.participant_low_auth_user_id, NEW.created_at),
    (NEW.id, NEW.participant_high_auth_user_id, NEW.created_at);
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.maintain_message_stats()
 RETURNS trigger
 LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $function$
DECLARE recipient_id uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE conversation_stat SET last_message_id = NEW.id, last_message_at = NEW.created_at,
      updated_at = now()
    WHERE conversation_id = NEW.conversation_id
      AND (last_message_at IS NULL OR (last_message_at, last_message_id) < (NEW.created_at, NEW.id));
    IF EXISTS(SELECT 1 FROM conversation WHERE id=NEW.conversation_id AND kind='group') THEN RETURN NULL; END IF;
    UPDATE conversation_participant_stat SET last_message_id = NEW.id,
      last_message_at = NEW.created_at, sort_at = NEW.created_at, updated_at = now()
    WHERE conversation_id = NEW.conversation_id
      AND (last_message_at IS NULL OR (last_message_at, last_message_id) < (NEW.created_at, NEW.id));
    SELECT CASE WHEN participant_low_auth_user_id = NEW.sender_auth_user_id
      THEN participant_high_auth_user_id ELSE participant_low_auth_user_id END
    INTO recipient_id FROM conversation WHERE id = NEW.conversation_id;
    IF NEW.deleted_at IS NULL AND message_is_unread(
      NEW.conversation_id, recipient_id, NEW.created_at, NEW.id
    ) THEN
      UPDATE conversation_participant_stat SET unread_count = unread_count + 1,
        updated_at = now()
      WHERE conversation_id = NEW.conversation_id AND auth_user_id = recipient_id;
    END IF;
  ELSIF TG_OP = 'UPDATE' AND OLD.deleted_at IS DISTINCT FROM NEW.deleted_at THEN
    SELECT CASE WHEN participant_low_auth_user_id = NEW.sender_auth_user_id
      THEN participant_high_auth_user_id ELSE participant_low_auth_user_id END
    INTO recipient_id FROM conversation WHERE id = NEW.conversation_id;
    IF message_is_unread(NEW.conversation_id, recipient_id, NEW.created_at, NEW.id) THEN
      UPDATE conversation_participant_stat SET
        unread_count = unread_count + CASE
          WHEN OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN -1
          WHEN OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL THEN 1 ELSE 0 END,
        updated_at = now()
      WHERE conversation_id = NEW.conversation_id AND auth_user_id = recipient_id;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    SELECT CASE WHEN participant_low_auth_user_id = OLD.sender_auth_user_id
      THEN participant_high_auth_user_id ELSE participant_low_auth_user_id END
    INTO recipient_id FROM conversation WHERE id = OLD.conversation_id;
    IF recipient_id IS NOT NULL AND OLD.deleted_at IS NULL AND message_is_unread(
      OLD.conversation_id, recipient_id, OLD.created_at, OLD.id
    ) THEN
      UPDATE conversation_participant_stat SET unread_count = unread_count - 1,
        updated_at = now()
      WHERE conversation_id = OLD.conversation_id AND auth_user_id = recipient_id;
    END IF;
    PERFORM refresh_conversation_last_message(OLD.conversation_id);
  END IF;
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.message_is_unread(p_conversation_id uuid, p_recipient_id uuid, p_message_created_at timestamp with time zone, p_message_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
SET search_path = pg_catalog, public
AS $function$
  SELECT marker.id IS NULL OR (p_message_created_at, p_message_id) > (marker.created_at, marker.id)
  FROM (SELECT 1) seed
  LEFT JOIN conversation_read read_state
    ON read_state.conversation_id = p_conversation_id AND read_state.auth_user_id = p_recipient_id
  LEFT JOIN message marker ON marker.id = read_state.last_read_message_id;
$function$;

CREATE OR REPLACE FUNCTION public.protect_conversation_aggregate_identity()
 RETURNS trigger
 LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $function$
BEGIN
  IF (OLD.id, OLD.kind, OLD.participant_low_auth_user_id, OLD.participant_high_auth_user_id, OLD.participant_low_entity_id, OLD.participant_high_entity_id, OLD.created_at)
    IS DISTINCT FROM
    (NEW.id, NEW.kind, NEW.participant_low_auth_user_id, NEW.participant_high_auth_user_id, NEW.participant_low_entity_id, NEW.participant_high_entity_id, NEW.created_at) THEN
    RAISE EXCEPTION 'conversation aggregate identity is immutable' USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.protect_conversation_read_identity()
 RETURNS trigger
 LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $function$
BEGIN
  IF (OLD.conversation_id, OLD.auth_user_id) IS DISTINCT FROM (NEW.conversation_id, NEW.auth_user_id) THEN
    RAISE EXCEPTION 'conversation read identity is immutable' USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.protect_message_aggregate_identity()
 RETURNS trigger
 LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $function$
BEGIN
  IF (OLD.id, OLD.conversation_id, OLD.sender_auth_user_id, OLD.sender_entity_id, OLD.created_at)
    IS DISTINCT FROM (NEW.id, NEW.conversation_id, NEW.sender_auth_user_id, NEW.sender_entity_id, NEW.created_at) THEN
    RAISE EXCEPTION 'message aggregate identity is immutable' USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.refresh_conversation_last_message(p_conversation_id uuid)
 RETURNS void
 LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $function$
DECLARE latest message%ROWTYPE;
created_at_value timestamptz;
BEGIN
  SELECT * INTO latest FROM message
  WHERE conversation_id = p_conversation_id
  ORDER BY created_at DESC, id DESC LIMIT 1;
  SELECT created_at INTO created_at_value FROM conversation WHERE id = p_conversation_id;
  IF created_at_value IS NULL THEN RETURN; END IF;
  UPDATE conversation_stat SET last_message_id = latest.id,
    last_message_at = latest.created_at, updated_at = now()
  WHERE conversation_id = p_conversation_id;
  UPDATE conversation_participant_stat SET last_message_id = latest.id,
    last_message_at = latest.created_at,
    sort_at = coalesce(latest.created_at, created_at_value), updated_at = now()
  WHERE conversation_id = p_conversation_id;
END;
$function$;

DROP TRIGGER IF EXISTS conversation_aggregate_identity_protect ON public.conversation;
CREATE TRIGGER conversation_aggregate_identity_protect BEFORE UPDATE ON public.conversation FOR EACH ROW EXECUTE FUNCTION protect_conversation_aggregate_identity();

DROP TRIGGER IF EXISTS conversation_stats_initialize ON public.conversation;
CREATE TRIGGER conversation_stats_initialize AFTER INSERT ON public.conversation FOR EACH ROW EXECUTE FUNCTION initialize_conversation_stats();

DROP TRIGGER IF EXISTS conversation_read_identity_protect ON public.conversation_read;
CREATE TRIGGER conversation_read_identity_protect BEFORE UPDATE ON public.conversation_read FOR EACH ROW EXECUTE FUNCTION protect_conversation_read_identity();

DROP TRIGGER IF EXISTS message_aggregate_identity_protect ON public.message;
CREATE TRIGGER message_aggregate_identity_protect BEFORE UPDATE ON public.message FOR EACH ROW EXECUTE FUNCTION protect_message_aggregate_identity();

DROP TRIGGER IF EXISTS message_stats_maintain ON public.message;
CREATE TRIGGER message_stats_maintain AFTER INSERT OR DELETE OR UPDATE OF deleted_at ON public.message FOR EACH ROW EXECUTE FUNCTION maintain_message_stats();


CREATE OR REPLACE FUNCTION public.conversation_member_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 PERFORM 1 FROM public.conversation WHERE id=NEW.conversation_id AND kind='group' FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Explicit membership belongs to group conversations' USING ERRCODE='23514'; END IF;
 PERFORM 1 FROM public.users account JOIN public.auth_entity self ON self.auth_user_id=account.id
 WHERE account.id=NEW.user_id AND account.erased_at IS NULL AND self.entity_id=NEW.entity_id AND self.state='active' FOR SHARE OF account,self;
 IF NOT FOUND AND NEW.left_at IS NULL THEN RAISE EXCEPTION 'Group membership requires a current identity' USING ERRCODE='23514'; END IF;
 IF TG_OP='UPDATE' AND (NEW.conversation_id<>OLD.conversation_id OR NEW.user_id<>OLD.user_id OR NEW.entity_id<>OLD.entity_id OR NEW.revision<>OLD.revision+1) THEN
  RAISE EXCEPTION 'Member identity is immutable and revision must advance' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE TRIGGER conversation_member_guard BEFORE INSERT OR UPDATE ON public.conversation_member FOR EACH ROW EXECUTE FUNCTION public.conversation_member_guard();
