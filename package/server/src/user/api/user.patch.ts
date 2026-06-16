import type { UpdateUser } from "@rezics/contract";
import { assertMediaUrl } from "../../upload/media-url.guard";

export function userPatchToUpdateUser(
  patch: Record<string, unknown>,
): UpdateUser {
  const user =
    patch.user && typeof patch.user === "object" && !Array.isArray(patch.user)
      ? (patch.user as Record<string, unknown>)
      : {};
  const avatar =
    user.avatar === null || typeof user.avatar === "string"
      ? user.avatar
      : undefined;
  assertMediaUrl(avatar);
  return {
    name: typeof user.name === "string" ? user.name : undefined,
    avatar,
    bio:
      user.bio === null || typeof user.bio === "string" ? user.bio : undefined,
    description:
      user.description === null ||
      (typeof user.description === "object" && !Array.isArray(user.description))
        ? user.description
        : undefined,
  } as UpdateUser;
}
