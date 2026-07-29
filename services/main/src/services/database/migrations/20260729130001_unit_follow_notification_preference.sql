-- Create "unit_follow_notification_preference" table
CREATE TABLE "unit_follow_notification_preference" (
  "follower_profile_id" uuid NOT NULL,
  "unit_id" uuid NOT NULL,
  "in_app" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "updated_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("follower_profile_id", "unit_id"),
  CONSTRAINT "unit_follow_notification_preference_follow_fkey" FOREIGN KEY ("follower_profile_id", "unit_id") REFERENCES "unit_follow" ("follower_profile_id", "unit_id") ON UPDATE NO ACTION ON DELETE CASCADE
);
-- Create index "unit_follow_notification_preference_enabled_unit_idx" to table: "unit_follow_notification_preference"
CREATE INDEX "unit_follow_notification_preference_enabled_unit_idx" ON "unit_follow_notification_preference" ("unit_id", "follower_profile_id") WHERE in_app;
