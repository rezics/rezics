-- This notification is emitted when someone starts following the recipient.
-- Keep it distinct from the recipient's own Unit follow relationships.
ALTER TYPE "notification_kind"
  RENAME VALUE 'follow' TO 'new_follower';
