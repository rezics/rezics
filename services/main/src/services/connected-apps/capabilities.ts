import { createHash } from "node:crypto";
import { z } from "zod";
import { AccessPermissionValues } from "@rezics/access";
import { ApiPermissionValues } from "@rezics/schema/contracts/native/api-permissions";
import { AccessPermissionSchema } from "../authorization/permission";

/** API entry scopes and domain permissions remain separate members of an App declaration. @alpha */
export const AppCapabilitySchema = z.discriminatedUnion("family", [
	...AccessPermissionSchema.options,
	z.strictObject({ family: z.literal("api"), key: z.enum(ApiPermissionValues) }),
]);
/** One literal, namespace-qualified declared capability. @alpha */
export type AppCapability = z.infer<typeof AppCapabilitySchema>;
/** Maximum declaration size follows the finite registries, never an open wildcard. @internal */
export const MaximumAppCapabilities = AccessPermissionValues.length + ApiPermissionValues.length;
/** App declarations are prospective requests; publishing one grants no installation or user authority. @alpha */
export const AppDefinitionSchema = z.strictObject({
	label: z.string().min(1).max(512).refine(value => value.trim().length > 0 && Buffer.byteLength(value, "utf8") <= 512),
	description: z.string().max(4096).refine(value => Buffer.byteLength(value, "utf8") <= 4096).nullable(),
	capabilities: z.array(AppCapabilitySchema).max(MaximumAppCapabilities)
		.refine(values => new Set(values.map(appCapabilityKey)).size === values.length),
	offlineAccess: z.boolean(),
	entityDisclosure: z.boolean(),
});
/** Stable snapshot key; API scopes cannot collide with domain permission names. @internal */
export function appCapabilityKey(value: AppCapability): string { return `${value.family}:${value.key}`; }
/** Digest of the literal declaration, without implication or wildcard expansion. @internal */
export function appCapabilityDigest(values: readonly AppCapability[]): string {
	return createHash("sha256").update(values.map(appCapabilityKey).sort().join("\n")).digest("hex");
}
/** Corrupt or incompletely loaded declarations are unavailable rather than reduced approvals. @internal */
export class AppCapabilitySnapshotUnavailable extends Error {
	constructor() { super("App capability snapshot is unavailable"); }
}
/** Verify complete registered snapshot membership before downstream consent/installation evaluation. @internal */
export function decodeAppCapabilities(rows: readonly { family: string; capability: string }[], count: number, digest: string): AppCapability[] {
	if (rows.length !== count || rows.length > MaximumAppCapabilities) throw new AppCapabilitySnapshotUnavailable();
	const values = rows.map(row => {
		const parsed = AppCapabilitySchema.safeParse({ family: row.family, key: row.capability });
		if (!parsed.success) throw new AppCapabilitySnapshotUnavailable();
		return parsed.data;
	});
	if (new Set(values.map(appCapabilityKey)).size !== values.length || appCapabilityDigest(values) !== digest)
		throw new AppCapabilitySnapshotUnavailable();
	return values;
}
