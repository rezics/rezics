CREATE TYPE "recommendation_event_type" AS ENUM('impression', 'open', 'dwell_30s', 'not_interested');--> statement-breakpoint
CREATE TYPE "recommendation_snapshot_state" AS ENUM('building', 'ready', 'failed');--> statement-breakpoint
CREATE TYPE "recommendation_surface" AS ENUM('home_feed', 'home_book', 'home_game', 'home_media', 'unit_related', 'post_related');--> statement-breakpoint
CREATE TABLE "recommendation_event" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"profile_id" uuid,
	"request_id" uuid NOT NULL,
	"surface" "recommendation_surface" NOT NULL,
	"type" "recommendation_event_type" NOT NULL,
	"target_unit_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"policy_version" text NOT NULL,
	"occurred_at" timestamp(3) with time zone NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recommendation_event_request_target_type_key" UNIQUE("request_id","target_unit_id","type"),
	CONSTRAINT "recommendation_event_position_check" CHECK ("position" between 0 and 999),
	CONSTRAINT "recommendation_event_policy_version_not_blank" CHECK (btrim("policy_version") <> '')
);
--> statement-breakpoint
CREATE TABLE "recommendation_exclusion" (
	"profile_id" uuid,
	"unit_id" uuid,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recommendation_exclusion_pkey" PRIMARY KEY("profile_id","unit_id")
);
--> statement-breakpoint
CREATE TABLE "recommendation_metric_daily" (
	"day" date,
	"surface" "recommendation_surface",
	"policy_version" text,
	"impressions" integer DEFAULT 0 NOT NULL,
	"opens" integer DEFAULT 0 NOT NULL,
	"dwell_30s" integer DEFAULT 0 NOT NULL,
	"not_interested" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recommendation_metric_daily_pkey" PRIMARY KEY("day","surface","policy_version"),
	CONSTRAINT "recommendation_metric_daily_policy_version_not_blank" CHECK (btrim("policy_version") <> ''),
	CONSTRAINT "recommendation_metric_daily_counts_check" CHECK ("impressions" >= 0 and "opens" >= 0 and "dwell_30s" >= 0 and "not_interested" >= 0)
);
--> statement-breakpoint
CREATE TABLE "recommendation_profile_interest" (
	"snapshot_id" uuid,
	"profile_id" uuid,
	"unit_id" uuid,
	"weight" double precision NOT NULL,
	"rank" integer NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recommendation_profile_interest_pkey" PRIMARY KEY("snapshot_id","profile_id","unit_id"),
	CONSTRAINT "recommendation_profile_interest_value_check" CHECK ("weight" > 0 and "rank" between 1 and 50)
);
--> statement-breakpoint
CREATE TABLE "recommendation_snapshot" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"policy_version" text NOT NULL,
	"state" "recommendation_snapshot_state" DEFAULT 'building'::"recommendation_snapshot_state" NOT NULL,
	"active" boolean DEFAULT false NOT NULL,
	"source_watermark" timestamp(3) with time zone,
	"started_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp(3) with time zone,
	"error" text,
	CONSTRAINT "recommendation_snapshot_policy_version_not_blank" CHECK (btrim("policy_version") <> ''),
	CONSTRAINT "recommendation_snapshot_active_ready_check" CHECK (not "active" or ("state" = 'ready'::recommendation_snapshot_state and "completed_at" is not null)),
	CONSTRAINT "recommendation_snapshot_completion_check" CHECK (("state" = 'building'::recommendation_snapshot_state and "completed_at" is null) or ("state" <> 'building'::recommendation_snapshot_state and "completed_at" is not null))
);
--> statement-breakpoint
CREATE TABLE "recommendation_unit_edge" (
	"snapshot_id" uuid,
	"source_unit_id" uuid,
	"target_unit_id" uuid,
	"structural_score" double precision DEFAULT 0 NOT NULL,
	"behavioral_score" double precision DEFAULT 0 NOT NULL,
	"score" double precision NOT NULL,
	"rank" integer NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recommendation_unit_edge_pkey" PRIMARY KEY("snapshot_id","source_unit_id","target_unit_id"),
	CONSTRAINT "recommendation_unit_edge_not_self_check" CHECK ("source_unit_id" <> "target_unit_id"),
	CONSTRAINT "recommendation_unit_edge_score_check" CHECK ("structural_score" >= 0 and "behavioral_score" >= 0 and "score" > 0 and "rank" between 1 and 100)
);
--> statement-breakpoint
CREATE TABLE "recommendation_unit_stat" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"snapshot_id" uuid NOT NULL,
	"unit_id" uuid NOT NULL,
	"context_realm_id" uuid,
	"impressions" integer DEFAULT 0 NOT NULL,
	"opens" integer DEFAULT 0 NOT NULL,
	"dwell_30s" integer DEFAULT 0 NOT NULL,
	"upvotes" integer DEFAULT 0 NOT NULL,
	"downvotes" integer DEFAULT 0 NOT NULL,
	"replies" integer DEFAULT 0 NOT NULL,
	"favorites" integer DEFAULT 0 NOT NULL,
	"shares" integer DEFAULT 0 NOT NULL,
	"high_scores" integer DEFAULT 0 NOT NULL,
	"active_progress" integer DEFAULT 0 NOT NULL,
	"completions" integer DEFAULT 0 NOT NULL,
	"negative_progress" integer DEFAULT 0 NOT NULL,
	"engagement_6h" double precision DEFAULT 0 NOT NULL,
	"engagement_24h" double precision DEFAULT 0 NOT NULL,
	"engagement_7d" double precision DEFAULT 0 NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recommendation_unit_stat_identity_key" UNIQUE NULLS NOT DISTINCT("snapshot_id","unit_id","context_realm_id"),
	CONSTRAINT "recommendation_unit_stat_counts_check" CHECK ("impressions" >= 0 and "opens" >= 0 and "dwell_30s" >= 0 and "upvotes" >= 0 and "downvotes" >= 0 and "replies" >= 0 and "favorites" >= 0 and "shares" >= 0 and "high_scores" >= 0 and "active_progress" >= 0 and "completions" >= 0 and "negative_progress" >= 0),
	CONSTRAINT "recommendation_unit_stat_engagement_check" CHECK ("engagement_6h" >= 0 and "engagement_24h" >= 0 and "engagement_7d" >= 0)
);
--> statement-breakpoint
ALTER TABLE "profile_preference" ALTER COLUMN "personalized_feed" SET DEFAULT true;--> statement-breakpoint
CREATE INDEX "recommendation_event_occurred_at_idx" ON "recommendation_event" ("occurred_at","id");--> statement-breakpoint
CREATE INDEX "recommendation_event_profile_occurred_at_idx" ON "recommendation_event" ("profile_id","occurred_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "recommendation_event_target_occurred_at_idx" ON "recommendation_event" ("target_unit_id","occurred_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "recommendation_exclusion_unit_idx" ON "recommendation_exclusion" ("unit_id","profile_id");--> statement-breakpoint
CREATE INDEX "recommendation_profile_interest_profile_rank_idx" ON "recommendation_profile_interest" ("snapshot_id","profile_id","rank");--> statement-breakpoint
CREATE UNIQUE INDEX "recommendation_snapshot_active_key" ON "recommendation_snapshot" ("active") WHERE "active";--> statement-breakpoint
CREATE INDEX "recommendation_snapshot_state_started_at_idx" ON "recommendation_snapshot" ("state","started_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "recommendation_unit_edge_source_rank_idx" ON "recommendation_unit_edge" ("snapshot_id","source_unit_id","rank");--> statement-breakpoint
CREATE INDEX "recommendation_unit_edge_target_idx" ON "recommendation_unit_edge" ("snapshot_id","target_unit_id");--> statement-breakpoint
CREATE INDEX "recommendation_unit_stat_snapshot_unit_idx" ON "recommendation_unit_stat" ("snapshot_id","unit_id");--> statement-breakpoint
CREATE INDEX "recommendation_unit_stat_snapshot_hot_idx" ON "recommendation_unit_stat" ("snapshot_id","engagement_24h" DESC NULLS LAST,"unit_id");--> statement-breakpoint
ALTER TABLE "recommendation_event" ADD CONSTRAINT "recommendation_event_profile_id_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profile"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "recommendation_event" ADD CONSTRAINT "recommendation_event_target_unit_id_unit_id_fkey" FOREIGN KEY ("target_unit_id") REFERENCES "unit"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "recommendation_exclusion" ADD CONSTRAINT "recommendation_exclusion_profile_id_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profile"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "recommendation_exclusion" ADD CONSTRAINT "recommendation_exclusion_unit_id_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "unit"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "recommendation_profile_interest" ADD CONSTRAINT "recommendation_profile_interest_profile_id_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profile"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "recommendation_profile_interest" ADD CONSTRAINT "recommendation_profile_interest_unit_id_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "unit"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "recommendation_profile_interest" ADD CONSTRAINT "recommendation_interest_snapshot_fkey" FOREIGN KEY ("snapshot_id") REFERENCES "recommendation_snapshot"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "recommendation_unit_edge" ADD CONSTRAINT "recommendation_unit_edge_source_unit_id_unit_id_fkey" FOREIGN KEY ("source_unit_id") REFERENCES "unit"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "recommendation_unit_edge" ADD CONSTRAINT "recommendation_unit_edge_target_unit_id_unit_id_fkey" FOREIGN KEY ("target_unit_id") REFERENCES "unit"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "recommendation_unit_edge" ADD CONSTRAINT "recommendation_edge_snapshot_fkey" FOREIGN KEY ("snapshot_id") REFERENCES "recommendation_snapshot"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "recommendation_unit_stat" ADD CONSTRAINT "recommendation_unit_stat_unit_id_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "unit"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "recommendation_unit_stat" ADD CONSTRAINT "recommendation_unit_stat_context_realm_id_realm_id_fkey" FOREIGN KEY ("context_realm_id") REFERENCES "realm"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "recommendation_unit_stat" ADD CONSTRAINT "recommendation_stat_snapshot_fkey" FOREIGN KEY ("snapshot_id") REFERENCES "recommendation_snapshot"("id") ON DELETE CASCADE;