UPDATE "Reaction"
SET "reaction" = CASE "reaction"
  WHEN 'like' THEN 'upvote'
  WHEN 'dislike' THEN 'downvote'
  ELSE "reaction"
END
WHERE "reaction" IN ('like', 'dislike');--> statement-breakpoint

UPDATE "ReactionSummary"
SET "reaction" = CASE "reaction"
  WHEN 'like' THEN 'upvote'
  WHEN 'dislike' THEN 'downvote'
  ELSE "reaction"
END
WHERE "reaction" IN ('like', 'dislike');
