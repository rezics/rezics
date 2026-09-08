SET search_path TO public;

-- Modify "account_erasure" table
ALTER TABLE "account_erasure" DROP CONSTRAINT "account_erasure_stage_check", ADD CONSTRAINT "account_erasure_stage_check" CHECK (stage = ANY (ARRAY['sessions'::text, 'credentials'::text, 'quota_account_leases'::text, 'quota_account_daily'::text, 'quota_account_rates'::text, 'quota_reservations'::text, 'quota_account_binding'::text, 'api_tokens'::text, 'verification'::text, 'auth_mail'::text, 'preferences'::text, 'notifications'::text, 'notification_preferences'::text, 'notification_stats'::text, 'sent_messages'::text, 'conversation_reads'::text, 'conversation_stats'::text, 'account_blocks'::text, 'progress'::text, 'progress_entries'::text, 'progress_nodes'::text, 'progress_stats'::text, 'recommendation_events'::text, 'recommendation_exclusions'::text, 'studio_visits'::text, 'studio_candidates'::text, 'follow_preferences'::text, 'favorite_history'::text, 'favorites'::text, 'favorites_state'::text, 'tag_subscriptions'::text, 'personal_tags'::text, 'private_images'::text, 'complete'::text]));
-- Modify "unit_follow" table
ALTER TABLE "unit_follow" DROP CONSTRAINT "unit_follow_position_byte_length_check", DROP COLUMN "position", DROP COLUMN "favorite";
-- Create "account_follow_preference" table
CREATE TABLE "account_follow_preference" (
  "auth_user_id" uuid NOT NULL,
  "follower_entity_id" uuid NOT NULL,
  "unit_id" uuid NOT NULL,
  "position" text NOT NULL DEFAULT (('a0'::text || replace((uuidv7())::text, '-'::text, ''::text)) || 'V'::text) COLLATE "C",
  "favorite" boolean NOT NULL DEFAULT false,
  "in_app" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "updated_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("auth_user_id", "unit_id"),
  CONSTRAINT "account_follow_preference_follow_key" UNIQUE ("follower_entity_id", "unit_id"),
  CONSTRAINT "account_follow_preference_auth_user_id_users_id_fkey" FOREIGN KEY ("auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "account_follow_preference_follow_fk" FOREIGN KEY ("follower_entity_id", "unit_id") REFERENCES "unit_follow" ("follower_profile_id", "unit_id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "account_follow_preference_position_check" CHECK (octet_length("position") <= 1024)
);
-- Create index "account_follow_preference_auth_order_idx" to table: "account_follow_preference"
CREATE INDEX "account_follow_preference_auth_order_idx" ON "account_follow_preference" ("auth_user_id", "favorite" DESC NULLS LAST, "position", "unit_id");
-- Create index "account_follow_preference_enabled_unit_idx" to table: "account_follow_preference"
CREATE INDEX "account_follow_preference_enabled_unit_idx" ON "account_follow_preference" ("unit_id", "auth_user_id") WHERE in_app;
-- Drop "unit_follow_notification_preference" table
DROP TABLE "unit_follow_notification_preference";

-- A public follow has at most one private preference row, owned by its human account.
CREATE OR REPLACE FUNCTION public.participation_guard_follow_preference()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND (NEW.auth_user_id, NEW.follower_entity_id, NEW.unit_id) IS DISTINCT FROM
    (OLD.auth_user_id, OLD.follower_entity_id, OLD.unit_id) THEN
    RAISE EXCEPTION 'Private following ownership is immutable' USING ERRCODE = '23514';
  END IF;
  PERFORM 1 FROM public.users WHERE id = NEW.auth_user_id AND erased_at IS NULL FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Private following requires an active Auth account' USING ERRCODE = '23514', CONSTRAINT = 'active_account_required'; END IF;
  PERFORM 1 FROM public.auth_entity WHERE auth_user_id = NEW.auth_user_id AND entity_id = NEW.follower_entity_id AND state = 'active' FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Private following belongs to the account self identity' USING ERRCODE = '23514'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS participation_follow_preference_guard ON public.account_follow_preference;
CREATE TRIGGER participation_follow_preference_guard BEFORE INSERT OR UPDATE ON public.account_follow_preference
FOR EACH ROW EXECUTE FUNCTION public.participation_guard_follow_preference();
