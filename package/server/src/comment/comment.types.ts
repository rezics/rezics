import type { Comment } from "#/prisma/client";
import type { PublicUserSelected } from "@/utils/sanitizeUser";

export type CommentWithRelations = Comment & {
  path?: string | null;
  pinKind?: string | null;
  pinPosition?: string | null;
  author?: PublicUserSelected | null;
};
