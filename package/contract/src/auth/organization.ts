import { t } from "elysia";

export const createOrgBodySchema = t.Object({
  name: t.String(),
  slug: t.Optional(t.String()),
});
export type CreateOrgBody = (typeof createOrgBodySchema)["static"];

export const inviteMemberBodySchema = t.Object({
  email: t.String({ format: "email" }),
  role: t.String(),
  organizationId: t.String(),
});
export type InviteMemberBody = (typeof inviteMemberBodySchema)["static"];

export const acceptInvitationBodySchema = t.Object({
  invitationId: t.String(),
});
export type AcceptInvitationBody =
  (typeof acceptInvitationBodySchema)["static"];

export const removeMemberBodySchema = t.Object({
  memberIdOrEmail: t.String(),
  organizationId: t.String(),
});
export type RemoveMemberBody = (typeof removeMemberBodySchema)["static"];

export const updateMemberRoleBodySchema = t.Object({
  memberId: t.String(),
  role: t.String(),
  organizationId: t.String(),
});
export type UpdateMemberRoleBody =
  (typeof updateMemberRoleBodySchema)["static"];

export const orgMemberSchema = t.Object({
  id: t.String(),
  userId: t.String(),
  organizationId: t.String(),
  role: t.String(),
  createdAt: t.String(),
  user: t.Object({
    id: t.String(),
    name: t.String(),
    email: t.String(),
    image: t.Optional(t.Nullable(t.String())),
  }),
});
export type OrgMember = (typeof orgMemberSchema)["static"];

export const listMembersResponseSchema = t.Array(orgMemberSchema);
export type ListMembersResponse = (typeof listMembersResponseSchema)["static"];

export const organizationSchema = t.Object({
  id: t.String(),
  name: t.String(),
  slug: t.String(),
  logo: t.Optional(t.Nullable(t.String())),
  metadata: t.Optional(t.Any()),
  createdAt: t.String(),
});
export type Organization = (typeof organizationSchema)["static"];

export const organizationDetailResponseSchema = t.Object({
  id: t.String(),
  name: t.String(),
  slug: t.String(),
  logo: t.Optional(t.Nullable(t.String())),
  metadata: t.Optional(t.Any()),
  createdAt: t.String(),
  members: t.Array(orgMemberSchema),
});
export type OrganizationDetailResponse =
  (typeof organizationDetailResponseSchema)["static"];
