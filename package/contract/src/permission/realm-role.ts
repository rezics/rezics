import { t } from "elysia";

export const realmMemberRoles = [
  "member",
  "moderator",
  "admin",
  "owner",
] as const;
export type RealmMemberRole = (typeof realmMemberRoles)[number];

export const realmMemberRoleSchema = t.Union([
  t.Literal("member"),
  t.Literal("moderator"),
  t.Literal("admin"),
  t.Literal("owner"),
]);

export const realmMemberRoleRank = {
  member: 0,
  moderator: 1,
  admin: 2,
  owner: 3,
} as const satisfies Record<RealmMemberRole, number>;

export function compareRealmMemberRole(
  left: RealmMemberRole,
  right: RealmMemberRole,
) {
  return realmMemberRoleRank[left] - realmMemberRoleRank[right];
}

export function realmMemberRoleAtLeast(
  actual: RealmMemberRole,
  required: RealmMemberRole,
) {
  return compareRealmMemberRole(actual, required) >= 0;
}

export function wouldRemoveLastRealmOwner(options: {
  currentRole: RealmMemberRole;
  nextRole?: RealmMemberRole | null;
  ownerCount: number;
}) {
  return (
    options.currentRole === "owner" &&
    options.nextRole !== "owner" &&
    options.ownerCount <= 1
  );
}
