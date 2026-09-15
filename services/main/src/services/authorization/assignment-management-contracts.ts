import { z } from "zod";
import { AccessPermissionValues, accessPermissionKey } from "@rezics/access";
import { AccessPermissionSchema } from "./permission";
const id = z.uuid().toLowerCase(),
	version = z.number().int().safe().nonnegative();
const path = z.array(z.string().regex(/^[a-z0-9][a-z0-9-]{0,255}$/)).max(8);
const permissions = z
	.array(AccessPermissionSchema)
	.max(AccessPermissionValues.length)
	.refine((values) => new Set(values.map(accessPermissionKey)).size === values.length);
const scope = z.string().startsWith("rzs1.").max(512);
/** Private subjects use purpose-bound opaque selectors; member sets retain their exact root. @alpha */
export const AssignmentRecipientSchema = z.discriminatedUnion("kind", [
	z.strictObject({
		kind: z.literal("subject"),
		recipient: z.string().startsWith("rzr1.").max(512),
	}),
	z.strictObject({ kind: z.literal("group"), scope, groupId: id }),
	z.strictObject({ kind: z.literal("all-members"), scope }),
]);
/** Complete replacement terms; null dependency explicitly selects an institutional assignment. @alpha */
export const ManagedBindingTermsSchema = z.strictObject({
	targetPath: path,
	validFrom: z.iso.datetime(),
	validUntil: z.iso.datetime().nullable(),
	recipientEligibility: z
		.strictObject({
			scope,
			generation: version.min(1),
			selection: z.strictObject({ groupId: id, version: version.min(1) }).nullable(),
		})
		.nullable(),
	permissionPolicy: z.discriminatedUnion("mode", [
		z.strictObject({ mode: z.literal("local-role") }),
		z.strictObject({ mode: z.literal("frozen-ceiling"), permissions }),
	]),
});
const base = { operationId: id, expectedVersion: version };
/** Role preparation remains a separate endpoint; this proposal selects an exact prepared revision. @alpha */
export const ActivateManagedRoleSchema = z.strictObject({
	...base,
	kind: z.literal("role"),
	operation: z.literal("activate"),
	roleId: id,
	expectedVersion: version.min(1),
	definitionRevision: version.min(1),
});
/** Terminal role retirement preserves every definition and binding record. @alpha */
export const RetireManagedRoleSchema = z.strictObject({
	...base,
	kind: z.literal("role"),
	operation: z.literal("retire"),
	roleId: id,
	expectedVersion: version.min(1),
});
/** Identity choices cannot be changed by an amendment. @alpha */
export const CreateManagedBindingSchema = z.strictObject({
	...base,
	kind: z.literal("binding"),
	operation: z.literal("create"),
	bindingId: id,
	expectedVersion: z.literal(0),
	role: z.strictObject({ scope, roleId: id, definitionRevision: version.min(1) }),
	recipient: AssignmentRecipientSchema,
	terms: ManagedBindingTermsSchema,
});
/** Amend the selected binding's complete terms at its exact current role revision. @alpha */
export const AmendManagedBindingSchema = z.strictObject({
	...base,
	kind: z.literal("binding"),
	operation: z.literal("amend"),
	bindingId: id,
	expectedVersion: version.min(1),
	definitionRevision: version.min(1),
	terms: ManagedBindingTermsSchema,
});
/** Revocation works after recipient eligibility or role effectiveness ends. @alpha */
export const RevokeManagedBindingSchema = z.strictObject({
	...base,
	kind: z.literal("binding"),
	operation: z.literal("revoke"),
	bindingId: id,
	expectedVersion: version.min(1),
});
/** Immutable explicit confer terms: replacement uses another ceiling identity. @alpha */
export const CreateManagedCeilingSchema = z.strictObject({
	...base,
	kind: z.literal("ceiling"),
	operation: z.literal("create"),
	ceilingId: id,
	expectedVersion: z.literal(0),
	managerBindingId: id,
	managerTermsRevision: version.min(1),
	role: z.strictObject({ scope, roleId: id, definitionRevision: version.min(1) }),
	targetPath: path,
	recipient: z.union([
		AssignmentRecipientSchema,
		z.strictObject({
			kind: z.literal("scope-members"),
			scope,
			subjectKind: z.enum(["principal", "entity"]),
		}),
	]),
	validFrom: z.iso.datetime(),
	validUntil: z.iso.datetime().nullable(),
	maximumGrantDurationSeconds: z.number().int().positive().max(2147483647).nullable(),
	grantNotAfter: z.iso.datetime().nullable(),
	permissions,
});
/** Explicit revocation never alters the approved permission snapshot. @alpha */
export const RevokeManagedCeilingSchema = z.strictObject({
	...base,
	kind: z.literal("ceiling"),
	operation: z.literal("revoke"),
	ceilingId: id,
	expectedVersion: version.min(1),
});
/** One complete command proposal, privately resolved and retained by the server. @alpha */
export const AssignmentProposalSchema = z.union([
	ActivateManagedRoleSchema,
	RetireManagedRoleSchema,
	CreateManagedBindingSchema,
	AmendManagedBindingSchema,
	RevokeManagedBindingSchema,
	CreateManagedCeilingSchema,
	RevokeManagedCeilingSchema,
]);
/** Exact acknowledgement binds execution to the inspected proposal and full effect set. @alpha */
export const AssignmentAcknowledgementSchema = z.strictObject({
	proposalDigest: z.string().regex(/^[0-9a-f]{64}$/),
	effectDigest: z.string().regex(/^[0-9a-f]{64}$/),
});
