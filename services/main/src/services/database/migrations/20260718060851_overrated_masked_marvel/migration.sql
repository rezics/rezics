CREATE TABLE "apikeys" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"config_id" text DEFAULT 'default' NOT NULL,
	"name" text,
	"start" text,
	"reference_id" uuid NOT NULL,
	"prefix" text,
	"key" text NOT NULL,
	"refill_interval" integer,
	"refill_amount" integer,
	"last_refill_at" timestamp(3) with time zone,
	"enabled" boolean DEFAULT true,
	"rate_limit_enabled" boolean DEFAULT true,
	"rate_limit_time_window" integer DEFAULT 60000,
	"rate_limit_max" integer DEFAULT 300,
	"request_count" integer DEFAULT 0,
	"remaining" integer,
	"last_request" timestamp(3) with time zone,
	"expires_at" timestamp(3) with time zone,
	"created_at" timestamp(3) with time zone NOT NULL,
	"updated_at" timestamp(3) with time zone NOT NULL,
	"permissions" text,
	"metadata" text
);
--> statement-breakpoint
DROP TABLE "api_token";--> statement-breakpoint
CREATE INDEX "apikeys_config_id_idx" ON "apikeys" ("config_id");--> statement-breakpoint
CREATE INDEX "apikeys_reference_id_idx" ON "apikeys" ("reference_id");--> statement-breakpoint
CREATE UNIQUE INDEX "apikeys_key_key" ON "apikeys" ("key");--> statement-breakpoint
ALTER TABLE "apikeys" ADD CONSTRAINT "apikeys_reference_id_users_id_fkey" FOREIGN KEY ("reference_id") REFERENCES "users"("id") ON DELETE CASCADE;