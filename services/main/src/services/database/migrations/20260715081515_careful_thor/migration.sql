CREATE TYPE "unit_revision_slot_role" AS ENUM('main', 'localizations', 'relations', 'structure', 'rules');--> statement-breakpoint
ALTER TYPE "post_kind" ADD VALUE 'reply' BEFORE 'review';--> statement-breakpoint
CREATE TABLE "post_reply" (
	"post_id" uuid PRIMARY KEY,
	"root_post_id" uuid NOT NULL,
	"parent_post_id" uuid,
	"context_realm_id" uuid,
	"depth" integer NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "post_reply_post_root_key" UNIQUE("post_id","root_post_id"),
	CONSTRAINT "post_reply_not_root_check" CHECK ("post_id" <> "root_post_id"),
	CONSTRAINT "post_reply_not_self_parent_check" CHECK ("parent_post_id" is null or "parent_post_id" <> "post_id"),
	CONSTRAINT "post_reply_depth_check" CHECK ("depth" between 0 and 64)
);
--> statement-breakpoint
CREATE TABLE "revision_content" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"model" text NOT NULL,
	"sha256" text NOT NULL,
	"byte_size" integer NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "revision_content_model_sha256_key" UNIQUE("model","sha256"),
	CONSTRAINT "revision_content_model_not_blank" CHECK (btrim("model") <> ''),
	CONSTRAINT "revision_content_sha256_check" CHECK ("sha256" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "revision_content_byte_size_check" CHECK ("byte_size" >= 0),
	CONSTRAINT "revision_content_payload_check" CHECK (jsonb_typeof("payload") in ('object', 'array'))
);
--> statement-breakpoint
CREATE TABLE "unit_revision_head" (
	"unit_id" uuid PRIMARY KEY,
	"revision_id" uuid NOT NULL CONSTRAINT "unit_revision_head_revision_key" UNIQUE
);
--> statement-breakpoint
CREATE TABLE "unit_revision_slot" (
	"revision_id" uuid,
	"unit_id" uuid NOT NULL,
	"role" "unit_revision_slot_role",
	"content_id" uuid NOT NULL,
	"origin_revision_id" uuid NOT NULL,
	CONSTRAINT "unit_revision_slot_pkey" PRIMARY KEY("revision_id","role")
);
--> statement-breakpoint
CREATE TABLE "unit_revision_tag" (
	"revision_id" uuid,
	"tag" text,
	"metadata" jsonb DEFAULT '{}' NOT NULL,
	CONSTRAINT "unit_revision_tag_pkey" PRIMARY KEY("revision_id","tag"),
	CONSTRAINT "unit_revision_tag_not_blank" CHECK (btrim("tag") <> ''),
	CONSTRAINT "unit_revision_tag_metadata_check" CHECK (jsonb_typeof("metadata") = 'object')
);
--> statement-breakpoint
ALTER TABLE "notification" DROP CONSTRAINT "notification_subject_comment_id_comment_id_fkey";--> statement-breakpoint
ALTER TABLE "comment_reaction" DROP CONSTRAINT "comment_reaction_comment_id_comment_id_fkey";--> statement-breakpoint
ALTER TABLE "feedback" DROP CONSTRAINT "feedback_subject_comment_id_comment_id_fkey";--> statement-breakpoint
DROP TABLE "comment";--> statement-breakpoint
DROP TABLE "comment_reaction";--> statement-breakpoint
ALTER TABLE "unit_revision" DROP CONSTRAINT "unit_revision_unit_sequence_key";--> statement-breakpoint
ALTER TABLE "unit_revision" DROP CONSTRAINT "unit_revision_sequence_check";--> statement-breakpoint
ALTER TABLE "unit_revision" DROP CONSTRAINT "unit_revision_restore_source_check";--> statement-breakpoint
ALTER TABLE "unit_revision" DROP CONSTRAINT "unit_revision_snapshot_json_object_check";--> statement-breakpoint
ALTER TABLE "notification" DROP CONSTRAINT "notification_subject_check";--> statement-breakpoint
ALTER TABLE "feedback" DROP CONSTRAINT "feedback_subject_check";--> statement-breakpoint
DROP INDEX "notification_subject_comment_idx";--> statement-breakpoint
DROP INDEX "feedback_subject_comment_idx";--> statement-breakpoint
ALTER TABLE "unit_revision" ADD COLUMN "parent_revision_id" uuid;--> statement-breakpoint
ALTER TABLE "unit_revision" ADD COLUMN "edit_summary" text;--> statement-breakpoint
ALTER TABLE "unit_revision" ADD COLUMN "minor" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "unit_revision" ADD COLUMN "byte_size" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "unit_revision" ADD COLUMN "content_hidden" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "unit_revision" ADD COLUMN "summary_hidden" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "unit_revision" ADD COLUMN "actor_hidden" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "unit_revision" ADD COLUMN "suppressed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "moderation_case" DROP CONSTRAINT "moderation_case_path_check";--> statement-breakpoint
ALTER TABLE "moderation_case" ALTER COLUMN "target_kind" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "moderation_target_kind";--> statement-breakpoint
CREATE TYPE "moderation_target_kind" AS ENUM('unit', 'unit_field', 'profile', 'realm_content', 'realm_member', 'feedback');--> statement-breakpoint
ALTER TABLE "moderation_case" ALTER COLUMN "target_kind" SET DATA TYPE "moderation_target_kind" USING "target_kind"::"moderation_target_kind";--> statement-breakpoint
ALTER TABLE "moderation_case" ADD CONSTRAINT "moderation_case_path_check" CHECK (("target_kind" = 'unit_field'::moderation_target_kind) = (nullif(btrim("target_path"), '') is not null));--> statement-breakpoint
ALTER TABLE "unit_revision" DROP COLUMN "sequence";--> statement-breakpoint
ALTER TABLE "unit_revision" DROP COLUMN "event";--> statement-breakpoint
ALTER TABLE "unit_revision" DROP COLUMN "snapshot";--> statement-breakpoint
ALTER TABLE "unit_revision" DROP COLUMN "message";--> statement-breakpoint
ALTER TABLE "unit_revision" DROP COLUMN "restore_from_sequence";--> statement-breakpoint
ALTER TABLE "notification" DROP COLUMN "subject_comment_id";--> statement-breakpoint
ALTER TABLE "feedback" DROP COLUMN "subject_comment_id";--> statement-breakpoint
DROP INDEX "unit_revision_actor_created_at_idx";--> statement-breakpoint
CREATE INDEX "unit_revision_actor_created_at_idx" ON "unit_revision" ("actor_profile_id","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
ALTER TABLE "unit_revision" ADD CONSTRAINT "unit_revision_id_unit_key" UNIQUE("id","unit_id");--> statement-breakpoint
CREATE INDEX "post_reply_root_created_at_idx" ON "post_reply" ("root_post_id","created_at","post_id");--> statement-breakpoint
CREATE INDEX "post_reply_parent_created_at_idx" ON "post_reply" ("parent_post_id","created_at","post_id");--> statement-breakpoint
CREATE INDEX "post_reply_context_realm_idx" ON "post_reply" ("context_realm_id");--> statement-breakpoint
CREATE INDEX "unit_revision_slot_content_idx" ON "unit_revision_slot" ("content_id");--> statement-breakpoint
CREATE INDEX "unit_revision_slot_origin_idx" ON "unit_revision_slot" ("origin_revision_id");--> statement-breakpoint
CREATE INDEX "unit_revision_tag_tag_revision_idx" ON "unit_revision_tag" ("tag","revision_id");--> statement-breakpoint
ALTER TABLE "post_reply" ADD CONSTRAINT "post_reply_post_id_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "post"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "post_reply" ADD CONSTRAINT "post_reply_root_post_id_post_id_fkey" FOREIGN KEY ("root_post_id") REFERENCES "post"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "post_reply" ADD CONSTRAINT "post_reply_context_realm_id_realm_id_fkey" FOREIGN KEY ("context_realm_id") REFERENCES "realm"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "post_reply" ADD CONSTRAINT "post_reply_parent_root_fkey" FOREIGN KEY ("parent_post_id","root_post_id") REFERENCES "post_reply"("post_id","root_post_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "unit_revision" ADD CONSTRAINT "unit_revision_parent_unit_fkey" FOREIGN KEY ("parent_revision_id","unit_id") REFERENCES "unit_revision"("id","unit_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "unit_revision_head" ADD CONSTRAINT "unit_revision_head_unit_id_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "unit"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "unit_revision_head" ADD CONSTRAINT "unit_revision_head_revision_unit_fkey" FOREIGN KEY ("revision_id","unit_id") REFERENCES "unit_revision"("id","unit_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "unit_revision_slot" ADD CONSTRAINT "unit_revision_slot_content_id_revision_content_id_fkey" FOREIGN KEY ("content_id") REFERENCES "revision_content"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "unit_revision_slot" ADD CONSTRAINT "unit_revision_slot_revision_unit_fkey" FOREIGN KEY ("revision_id","unit_id") REFERENCES "unit_revision"("id","unit_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "unit_revision_slot" ADD CONSTRAINT "unit_revision_slot_origin_unit_fkey" FOREIGN KEY ("origin_revision_id","unit_id") REFERENCES "unit_revision"("id","unit_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "unit_revision_tag" ADD CONSTRAINT "unit_revision_tag_revision_id_unit_revision_id_fkey" FOREIGN KEY ("revision_id") REFERENCES "unit_revision"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "unit_revision" ADD CONSTRAINT "unit_revision_byte_size_check" CHECK ("byte_size" >= 0);--> statement-breakpoint
ALTER TABLE "unit_revision" ADD CONSTRAINT "unit_revision_suppressed_check" CHECK (not "suppressed" or "content_hidden" or "summary_hidden" or "actor_hidden");--> statement-breakpoint
DROP TYPE "unit_revision_event";--> statement-breakpoint
CREATE FUNCTION reject_immutable_history_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
	RAISE EXCEPTION '% is append-only', TG_TABLE_NAME USING ERRCODE = '55000';
END;
$$;--> statement-breakpoint
CREATE TRIGGER audit_event_append_only
	BEFORE UPDATE OR DELETE ON "audit_event"
	FOR EACH ROW EXECUTE FUNCTION reject_immutable_history_mutation();--> statement-breakpoint
CREATE TRIGGER revision_content_immutable
	BEFORE UPDATE OR DELETE ON "revision_content"
	FOR EACH ROW EXECUTE FUNCTION reject_immutable_history_mutation();--> statement-breakpoint
CREATE TRIGGER unit_revision_slot_immutable
	BEFORE UPDATE OR DELETE ON "unit_revision_slot"
	FOR EACH ROW EXECUTE FUNCTION reject_immutable_history_mutation();--> statement-breakpoint
CREATE TRIGGER unit_revision_tag_immutable
	BEFORE UPDATE OR DELETE ON "unit_revision_tag"
	FOR EACH ROW EXECUTE FUNCTION reject_immutable_history_mutation();--> statement-breakpoint
CREATE FUNCTION protect_unit_revision_identity() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
	IF ROW(
		OLD."id",
		OLD."unit_id",
		OLD."parent_revision_id",
		OLD."actor_profile_id",
		OLD."edit_summary",
		OLD."minor",
		OLD."byte_size",
		OLD."created_at"
	) IS DISTINCT FROM ROW(
		NEW."id",
		NEW."unit_id",
		NEW."parent_revision_id",
		NEW."actor_profile_id",
		NEW."edit_summary",
		NEW."minor",
		NEW."byte_size",
		NEW."created_at"
	) THEN
		RAISE EXCEPTION 'unit_revision identity is immutable' USING ERRCODE = '55000';
	END IF;
	RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER unit_revision_identity_immutable
	BEFORE UPDATE ON "unit_revision"
	FOR EACH ROW EXECUTE FUNCTION protect_unit_revision_identity();
