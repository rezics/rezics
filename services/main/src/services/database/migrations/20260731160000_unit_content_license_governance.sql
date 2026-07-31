-- Platform-only content License governance preserves the historical grant while
-- making platform recognition of that grant explicitly reversible and auditable.
ALTER TYPE "platform_capability"
  ADD VALUE 'unit.content_license.manage' AFTER 'unit.ownership.override';
--> statement-breakpoint
ALTER TYPE "moderation_action_kind"
  ADD VALUE 'invalidate_content_license' AFTER 'unlock_post_targeting';
--> statement-breakpoint
ALTER TYPE "moderation_action_kind"
  ADD VALUE 'restore_content_license' AFTER 'invalidate_content_license';
