import { ContentLanguageValues } from "../database/schema/contract-values";
import { z } from "zod";
import { MembershipRecipientSchema } from "../participation/membership-contracts";
import { RealmEnrollmentStateValues } from "../database/schema/realm-enrollment";
const id = z.uuid().toLowerCase(),
	version = z
		.number()
		.int()
		.nonnegative()
		.max(Number.MAX_SAFE_INTEGER - 1);
export const RealmEnrollmentExpectedSchema = z.strictObject({
	operationId: id,
	expectedControlRevision: version.min(1),
	expectedRevision: version,
	expectedMembershipVersion: version,
	expectedEnforcementRevision: version,
});
export const JoinRealmSchema = RealmEnrollmentExpectedSchema.extend({
	consent: z.literal(true),
	ruleRevisionId: id.nullable(),
});
export const RealmEnrollmentCommandSchema = RealmEnrollmentExpectedSchema.extend({
	recipient: MembershipRecipientSchema,
	contactId: id.optional(),
	operation: z.enum(["invite", "approve", "reject", "remove", "mute", "ban", "clear"]),
});
export const RealmRuleConsentSchema = RealmEnrollmentExpectedSchema.extend({
	consent: z.literal(true),
	language: z.enum(ContentLanguageValues).nullable(),
});
export const RealmEnrollmentReceiptSchema = z.strictObject({
	state: z.enum(RealmEnrollmentStateValues),
	revision: version,
	membershipId: id,
	version,
	activeGeneration: version.nullable(),
	lastGeneration: version,
	enforcement: z.enum(["clear", "muted", "banned"]),
	enforcementRevision: version,
});
export const RealmEnrollmentStatusSchema = z.strictObject({
	controlRevision: version.min(1),
	joinPolicy: z.enum(["open", "approval"]),
	ruleRevisionId: id.nullable(),
	acknowledgedRuleRevisionId: id.nullable(),
	isOwner: z.boolean(),
	recipient: MembershipRecipientSchema,
	receipt: RealmEnrollmentReceiptSchema.nullable(),
});
export const RealmEnrollmentPageQuerySchema = z.strictObject({
	afterId: z.string().max(512).optional(),
	view: z.enum(["public", "operational"]).default("public"),
});
export const RealmEnrollmentPageSchema = z.strictObject({
	items: z
		.array(
			z.strictObject({
				recipient: MembershipRecipientSchema,
				receipt: RealmEnrollmentReceiptSchema,
			}),
		)
		.max(50),
	nextCursor: z.string().max(512).nullable(),
});
