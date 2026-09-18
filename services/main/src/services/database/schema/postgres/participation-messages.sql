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
