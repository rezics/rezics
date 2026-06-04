import type { Comment } from "../db/schema";
import type { PublicUserSelected } from "@/utils/sanitizeUser";

export type CommentWithRelations = typeof Comment.$inferSelect & {
  path?: string | null;
  pinKind?: string | null;
  pinPosition?: string | null;
  author?: PublicUserSelected | null;
};
