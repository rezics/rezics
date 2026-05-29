import type { BlockedUser } from "@rezics/contract";

type BlockRow = { blockedId: string; createdAt: Date };
type UserRow = {
  name: string | null;
  bio: string | null;
  avatar: string | null;
};

export function mapBlockedUser(
  block: BlockRow,
  user: UserRow | undefined,
  slug: string | null,
): BlockedUser {
  return {
    unitId: block.blockedId,
    name: user?.name ?? undefined,
    slug: slug ?? undefined,
    bio: user?.bio ?? undefined,
    avatar: user?.avatar ?? undefined,
    blockedAt: block.createdAt.toISOString(),
  };
}
