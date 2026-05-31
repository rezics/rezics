import type { Comment, Unit } from "#/prisma/client";
import type { PublicUserSelected } from "@/utils/sanitizeUser";

export type CommentWithRelations = Comment & {
  path?: string | null;
  unit: Unit & {
    user?: PublicUserSelected | null;
    contentModerationState?: { state: string } | null;
  };
};
