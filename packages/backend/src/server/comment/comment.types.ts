import type { PublicUserSelected } from "@/utils/sanitizeUser";
import type { Comment } from "../db/schema";

export type CommentWithRelations = typeof Comment.$inferSelect & {
  pinKind?: string | null;
  pinPosition?: string | null;
  author?: PublicUserSelected | null;
};
