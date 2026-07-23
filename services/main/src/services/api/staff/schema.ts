import { type Static, t } from "elysia";

import { PlatformCapabilityValues } from "../../database/schema/contract-values";
import { DateTime, Uuid } from "../schema";

export const PlatformCapability = t.UnionEnum(PlatformCapabilityValues);

export const StaffAccessGrantResponse = t.Object({
	capability: PlatformCapability,
	grantedByProfileId: Uuid,
	expiresAt: t.Nullable(DateTime),
});

export const StaffAccessProfileResponse = t.Object({
	profileId: Uuid,
	name: t.Nullable(t.String()),
	email: t.String({ format: "email" }),
	grants: t.Array(StaffAccessGrantResponse),
	isSuperAdmin: t.Boolean(),
});

export const StaffAccessProfileListResponse = t.Object({
	items: t.Array(StaffAccessProfileResponse),
});

export const StaffAccessPolicyResponse = t.Object({
	capabilities: t.Array(PlatformCapability, { uniqueItems: true }),
});

export const StaffProfileSearchQuery = t.Object(
	{
		query: t.String({ minLength: 1, maxLength: 200 }),
		limit: t.Optional(t.Integer({ minimum: 1, maximum: 50, default: 20 })),
	},
	{ additionalProperties: false },
);

export const StaffMemberParams = t.Object({ profileId: Uuid });

export const ReplaceStaffAccessBody = t.Object(
	{
		capabilities: t.Array(PlatformCapability, {
			maxItems: PlatformCapabilityValues.length,
			uniqueItems: true,
		}),
		expiresAt: t.Nullable(DateTime),
	},
	{ additionalProperties: false },
);

export const StaffAuditQuery = t.Object(
	{
		limit: t.Optional(t.Integer({ minimum: 1, maximum: 100, default: 50 })),
	},
	{ additionalProperties: false },
);

export const StaffAuditEventResponse = t.Object({
	id: Uuid,
	actorProfileId: t.Nullable(Uuid),
	actorName: t.Nullable(t.String()),
	action: t.String(),
	decisionCode: t.String(),
	subjectProfileId: t.Nullable(Uuid),
	subjectName: t.Nullable(t.String()),
	metadata: t.Nullable(t.Record(t.String(), t.Unknown())),
	createdAt: DateTime,
});

export const StaffAuditListResponse = t.Object({
	items: t.Array(StaffAuditEventResponse),
});

export type ReplaceStaffAccessBody = Static<typeof ReplaceStaffAccessBody>;
