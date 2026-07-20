ALTER TYPE "moderation_action_kind"
  RENAME VALUE 'lock' TO 'lock_post_targeting';

ALTER TYPE "moderation_action_kind"
  RENAME VALUE 'unlock' TO 'unlock_post_targeting';
