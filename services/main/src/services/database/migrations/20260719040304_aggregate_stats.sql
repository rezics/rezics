-- Create enum type "recommendation_signal_kind"
CREATE TYPE "recommendation_signal_kind" AS ENUM ('impression', 'open', 'dwell_30s', 'not_interested', 'upvote', 'downvote', 'reply', 'favorite', 'share', 'score_high', 'score_medium', 'score_low', 'progress_active', 'progress_completed', 'progress_dropped');
-- Create "conversation_participant_stat" table
CREATE TABLE "conversation_participant_stat" (
  "conversation_id" uuid NOT NULL,
  "profile_id" uuid NOT NULL,
  "last_message_id" uuid NULL,
  "last_message_at" timestamptz(3) NULL,
  "sort_at" timestamptz(3) NOT NULL,
  "unread_count" bigint NOT NULL DEFAULT 0,
  "updated_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("conversation_id", "profile_id"),
  CONSTRAINT "conversation_participant_stat_DiJvtVmN2IBI_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversation" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "conversation_participant_stat_last_message_id_message_id_fkey" FOREIGN KEY ("last_message_id") REFERENCES "message" ("id") ON UPDATE NO ACTION ON DELETE SET NULL,
  CONSTRAINT "conversation_participant_stat_profile_id_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profile" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "conversation_participant_stat_count_check" CHECK (unread_count >= 0)
);
-- Create index "conversation_participant_stat_last_message_idx" to table: "conversation_participant_stat"
CREATE INDEX "conversation_participant_stat_last_message_idx" ON "conversation_participant_stat" ("last_message_id");
-- Create index "conversation_participant_stat_profile_sort_idx" to table: "conversation_participant_stat"
CREATE INDEX "conversation_participant_stat_profile_sort_idx" ON "conversation_participant_stat" ("profile_id", "sort_at" DESC NULLS LAST, "conversation_id" DESC NULLS LAST);
-- Create "conversation_stat" table
CREATE TABLE "conversation_stat" (
  "conversation_id" uuid NOT NULL,
  "last_message_id" uuid NULL,
  "last_message_at" timestamptz(3) NULL,
  "updated_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("conversation_id"),
  CONSTRAINT "conversation_stat_conversation_id_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversation" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "conversation_stat_last_message_id_message_id_fkey" FOREIGN KEY ("last_message_id") REFERENCES "message" ("id") ON UPDATE NO ACTION ON DELETE SET NULL
);
-- Create index "conversation_stat_last_message_idx" to table: "conversation_stat"
CREATE INDEX "conversation_stat_last_message_idx" ON "conversation_stat" ("last_message_id");
-- Create "post_reply_stat" table
CREATE TABLE "post_reply_stat" (
  "post_id" uuid NOT NULL,
  "undeleted_direct_count" bigint NOT NULL DEFAULT 0,
  "undeleted_descendant_count" bigint NOT NULL DEFAULT 0,
  "visible_direct_count" bigint NOT NULL DEFAULT 0,
  "visible_descendant_count" bigint NOT NULL DEFAULT 0,
  "updated_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("post_id"),
  CONSTRAINT "post_reply_stat_post_id_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "post" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "post_reply_stat_count_check" CHECK ((undeleted_direct_count >= 0) AND (undeleted_descendant_count >= 0) AND (visible_direct_count >= 0) AND (visible_descendant_count >= 0))
);
-- Create "realm_tag_vote_stat" table
CREATE TABLE "realm_tag_vote_stat" (
  "realm_id" uuid NOT NULL,
  "unit_id" uuid NOT NULL,
  "tag_id" uuid NOT NULL,
  "score" bigint NOT NULL DEFAULT 0,
  "vote_count" bigint NOT NULL DEFAULT 0,
  "updated_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("realm_id", "unit_id", "tag_id"),
  CONSTRAINT "realm_tag_vote_stat_context_fkey" FOREIGN KEY ("realm_id", "unit_id", "tag_id") REFERENCES "realm_tag_context" ("realm_id", "unit_id", "tag_id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "realm_tag_vote_stat_count_check" CHECK (vote_count >= 0),
  CONSTRAINT "realm_tag_vote_stat_score_check" CHECK (abs(score) <= vote_count)
);
-- Create "recommendation_profile_signal_hourly" table
CREATE TABLE "recommendation_profile_signal_hourly" (
  "profile_id" uuid NOT NULL,
  "unit_id" uuid NOT NULL,
  "bucket_start" timestamptz(3) NOT NULL,
  "kind" "recommendation_signal_kind" NOT NULL,
  "signal_count" bigint NOT NULL DEFAULT 0,
  "weight" double precision NOT NULL DEFAULT 0,
  "updated_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("profile_id", "unit_id", "bucket_start", "kind"),
  CONSTRAINT "recommendation_profile_signal_hourly_profile_id_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profile" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "recommendation_profile_signal_hourly_unit_id_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "unit" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "recommendation_profile_signal_hourly_count_check" CHECK (signal_count >= 0)
);
-- Create index "recommendation_profile_signal_hourly_bucket_idx" to table: "recommendation_profile_signal_hourly"
CREATE INDEX "recommendation_profile_signal_hourly_bucket_idx" ON "recommendation_profile_signal_hourly" ("bucket_start", "profile_id");
-- Create "recommendation_unit_signal_hourly" table
CREATE TABLE "recommendation_unit_signal_hourly" (
  "unit_id" uuid NOT NULL,
  "bucket_start" timestamptz(3) NOT NULL,
  "kind" "recommendation_signal_kind" NOT NULL,
  "signal_count" bigint NOT NULL DEFAULT 0,
  "weight" double precision NOT NULL DEFAULT 0,
  "updated_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("unit_id", "bucket_start", "kind"),
  CONSTRAINT "recommendation_unit_signal_hourly_unit_id_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "unit" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "recommendation_unit_signal_hourly_count_check" CHECK (signal_count >= 0),
  CONSTRAINT "recommendation_unit_signal_hourly_weight_check" CHECK (weight >= (0)::double precision)
);
-- Create index "recommendation_unit_signal_hourly_bucket_idx" to table: "recommendation_unit_signal_hourly"
CREATE INDEX "recommendation_unit_signal_hourly_bucket_idx" ON "recommendation_unit_signal_hourly" ("bucket_start", "unit_id");
-- Create "score_stat" table
CREATE TABLE "score_stat" (
  "unit_id" uuid NOT NULL,
  "realm_id" uuid NOT NULL,
  "total_count" bigint NOT NULL DEFAULT 0,
  "total_score" bigint NOT NULL DEFAULT 0,
  "score_1_count" bigint NOT NULL DEFAULT 0,
  "score_2_count" bigint NOT NULL DEFAULT 0,
  "score_3_count" bigint NOT NULL DEFAULT 0,
  "score_4_count" bigint NOT NULL DEFAULT 0,
  "score_5_count" bigint NOT NULL DEFAULT 0,
  "score_6_count" bigint NOT NULL DEFAULT 0,
  "score_7_count" bigint NOT NULL DEFAULT 0,
  "score_8_count" bigint NOT NULL DEFAULT 0,
  "score_9_count" bigint NOT NULL DEFAULT 0,
  "score_10_count" bigint NOT NULL DEFAULT 0,
  "updated_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("unit_id", "realm_id"),
  CONSTRAINT "score_stat_realm_id_realm_id_fkey" FOREIGN KEY ("realm_id") REFERENCES "realm" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "score_stat_unit_id_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "unit" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "score_stat_nonnegative_check" CHECK ((total_count >= 0) AND (total_score >= 0) AND (score_1_count >= 0) AND (score_2_count >= 0) AND (score_3_count >= 0) AND (score_4_count >= 0) AND (score_5_count >= 0) AND (score_6_count >= 0) AND (score_7_count >= 0) AND (score_8_count >= 0) AND (score_9_count >= 0) AND (score_10_count >= 0)),
  CONSTRAINT "score_stat_total_count_check" CHECK (total_count = (((((((((score_1_count + score_2_count) + score_3_count) + score_4_count) + score_5_count) + score_6_count) + score_7_count) + score_8_count) + score_9_count) + score_10_count)),
  CONSTRAINT "score_stat_total_score_check" CHECK (total_score = (((((((((score_1_count + (2 * score_2_count)) + (3 * score_3_count)) + (4 * score_4_count)) + (5 * score_5_count)) + (6 * score_6_count)) + (7 * score_7_count)) + (8 * score_8_count)) + (9 * score_9_count)) + (10 * score_10_count)))
);
-- Create index "score_stat_realm_idx" to table: "score_stat"
CREATE INDEX "score_stat_realm_idx" ON "score_stat" ("realm_id", "unit_id");
-- Create "unit_alias_vote_stat" table
CREATE TABLE "unit_alias_vote_stat" (
  "alias_id" uuid NOT NULL,
  "score" bigint NOT NULL DEFAULT 0,
  "vote_count" bigint NOT NULL DEFAULT 0,
  "updated_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("alias_id"),
  CONSTRAINT "unit_alias_vote_stat_alias_id_unit_alias_id_fkey" FOREIGN KEY ("alias_id") REFERENCES "unit_alias" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "unit_alias_vote_stat_count_check" CHECK (vote_count >= 0),
  CONSTRAINT "unit_alias_vote_stat_score_check" CHECK (abs(score) <= vote_count)
);
-- Create "unit_engagement_stat" table
CREATE TABLE "unit_engagement_stat" (
  "unit_id" uuid NOT NULL,
  "upvotes" bigint NOT NULL DEFAULT 0,
  "downvotes" bigint NOT NULL DEFAULT 0,
  "replies" bigint NOT NULL DEFAULT 0,
  "favorites" bigint NOT NULL DEFAULT 0,
  "shares" bigint NOT NULL DEFAULT 0,
  "high_scores" bigint NOT NULL DEFAULT 0,
  "active_progress" bigint NOT NULL DEFAULT 0,
  "completions" bigint NOT NULL DEFAULT 0,
  "negative_progress" bigint NOT NULL DEFAULT 0,
  "updated_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("unit_id"),
  CONSTRAINT "unit_engagement_stat_unit_id_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "unit" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "unit_engagement_stat_count_check" CHECK ((upvotes >= 0) AND (downvotes >= 0) AND (replies >= 0) AND (favorites >= 0) AND (shares >= 0) AND (high_scores >= 0) AND (active_progress >= 0) AND (completions >= 0) AND (negative_progress >= 0))
);
-- Create "unit_follow_stat" table
CREATE TABLE "unit_follow_stat" (
  "unit_id" uuid NOT NULL,
  "follower_count" bigint NOT NULL DEFAULT 0,
  "updated_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("unit_id"),
  CONSTRAINT "unit_follow_stat_unit_id_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "unit" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "unit_follow_stat_count_check" CHECK (follower_count >= 0)
);
-- Create "unit_reaction_global_stat" table
CREATE TABLE "unit_reaction_global_stat" (
  "unit_id" uuid NOT NULL,
  "reaction" "reaction_kind" NOT NULL,
  "reaction_count" bigint NOT NULL DEFAULT 0,
  "updated_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("unit_id", "reaction"),
  CONSTRAINT "unit_reaction_global_stat_unit_id_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "unit" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "unit_reaction_global_stat_count_check" CHECK (reaction_count >= 0)
);
-- Create "unit_reaction_stat" table
CREATE TABLE "unit_reaction_stat" (
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "unit_id" uuid NOT NULL,
  "realm_id" uuid NULL,
  "reaction" "reaction_kind" NOT NULL,
  "reaction_count" bigint NOT NULL DEFAULT 0,
  "updated_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "unit_reaction_stat_identity_key" UNIQUE NULLS NOT DISTINCT ("unit_id", "realm_id", "reaction"),
  CONSTRAINT "unit_reaction_stat_realm_id_realm_id_fkey" FOREIGN KEY ("realm_id") REFERENCES "realm" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "unit_reaction_stat_unit_id_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "unit" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "unit_reaction_stat_count_check" CHECK (reaction_count >= 0)
);
-- Create index "unit_reaction_stat_realm_idx" to table: "unit_reaction_stat"
CREATE INDEX "unit_reaction_stat_realm_idx" ON "unit_reaction_stat" ("realm_id", "unit_id");
-- Create "unit_tag_vote_stat" table
CREATE TABLE "unit_tag_vote_stat" (
  "unit_id" uuid NOT NULL,
  "tag_id" uuid NOT NULL,
  "score" bigint NOT NULL DEFAULT 0,
  "vote_count" bigint NOT NULL DEFAULT 0,
  "updated_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("unit_id", "tag_id"),
  CONSTRAINT "unit_tag_vote_stat_unit_tag_fkey" FOREIGN KEY ("unit_id", "tag_id") REFERENCES "unit_tag" ("unit_id", "tag_id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "unit_tag_vote_stat_count_check" CHECK (vote_count >= 0),
  CONSTRAINT "unit_tag_vote_stat_score_check" CHECK (abs(score) <= vote_count)
);
