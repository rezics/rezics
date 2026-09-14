import { z } from "zod";
import { AccessManagementPermissionValues } from "@rezics/access";
import { UnitReferenceSchema } from "@rezics/reference";
import { AccessRoleDefinitionSchema } from "../../authorization/roles";

const id = z.uuid().toLowerCase();
const version = z.number().int().nonnegative().safe();
const positiveVersion = version.refine(value => value > 0);
const state = z.enum(["draft", "active", "retired"]);
const scope = z.string().startsWith("rzs1.").max(512);
/** Public management root requests never accept another account's private identifier. @alpha */
export const ResolveScopeBody = z.strictObject({
	target: z.discriminatedUnion("kind", [z.strictObject({ kind: z.literal("self-account") }),
		z.strictObject({ kind: z.literal("platform") }),
		z.strictObject({ kind: z.literal("resource"), reference: UnitReferenceSchema })]),
	permission: z.enum(AccessManagementPermissionValues),
	path: z.array(z.string().regex(/^[a-z0-9][a-z0-9-]{0,255}$/)).max(8),
});
/** Confidential, credential-bound locator; possession grants no access. @alpha */
export const ResolvedScope = z.strictObject({ scope, expiresAt: z.iso.datetime() });
/** Role directory root and selected role parameters. @alpha */
export const ScopeParams = z.strictObject({ scope });
/** Selected role inside the supplied root. @alpha */
export const RoleParams = ScopeParams.extend({ roleId: id });
/** Bounded role directory continuation. @alpha */
export const RoleListQuery = z.strictObject({ afterId: id.optional() });
/** Exact optional definition selection. @alpha */
export const RoleQuery = z.strictObject({ definitionRevision: z.coerce.number().int().positive().safe().optional() });
/** Bounded role control history continuation. @alpha */
export const RoleHistoryQuery = z.strictObject({ afterVersion: z.coerce.number().int().nonnegative().safe().optional() });
/** Stable command identity and optimistic precondition for definition creation. @alpha */
export const CreateRoleBody = z.strictObject({ operationId: id, expectedVersion: z.literal(0), definition: AccessRoleDefinitionSchema });
/** Complete next definition; changing it does not activate permissions. @alpha */
export const ReviseRoleBody = CreateRoleBody.extend({ expectedVersion: positiveVersion });
/** Stable command receipt without private issuer identity. @alpha */
export const RoleReceipt = z.strictObject({ roleId: id, operationId: id, version: positiveVersion,
	state, activeRevision: positiveVersion.nullable(), definitionRevision: positiveVersion.nullable() });
/** Role control head and selected immutable definition. @alpha */
export const ManagedRole = z.strictObject({ id, version: positiveVersion, state, activeRevision: positiveVersion.nullable(),
	definition: AccessRoleDefinitionSchema.extend({ revision: positiveVersion }) });
/** Keyset-paginated role directory. @alpha */
export const ManagedRoles = z.strictObject({ items: z.array(z.strictObject({ id, version: positiveVersion, state,
	activeRevision: positiveVersion.nullable(), definitionRevision: positiveVersion, label: z.string() })).max(100), nextCursor: id.nullable() });
/** Control events deliberately omit the private account and subject identifiers. @alpha */
export const ManagedRoleHistory = z.strictObject({ items: z.array(z.strictObject({ version: positiveVersion,
	operationId: id, operation: z.enum(["create", "revise", "activate", "retire"]), state,
	activeRevision: positiveVersion.nullable(), createdAt: z.iso.datetime() })).max(100), nextCursor: positiveVersion.nullable() });
