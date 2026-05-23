import type { UpdateUser } from "@rezics/contract";

export function userPatchToUpdateUser(
  patch: Record<string, unknown>,
): UpdateUser {
  const user =
    patch.user && typeof patch.user === "object" && !Array.isArray(patch.user)
      ? (patch.user as Record<string, unknown>)
      : {};
  return {
    name: typeof user.name === "string" ? user.name : undefined,
    avatar:
      user.avatar === null || typeof user.avatar === "string"
        ? user.avatar
        : undefined,
    bio:
      user.bio === null || typeof user.bio === "string" ? user.bio : undefined,
    description:
      user.description === null || typeof user.description === "string"
        ? user.description
        : undefined,
  };
}
