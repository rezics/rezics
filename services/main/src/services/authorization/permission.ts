import {
	AccessManagementPermissionValues,
	PlatformCapabilityValues,
	UnitPermissionValues,
	AccessPermissionValues,
	accessPermissionKey,
	type AccessPermission,
} from "@rezics/access";
import { z } from "zod";
import { createHash } from "node:crypto";

/** Registry-qualified permission references; family is never inferred from a shared spelling. @internal */
export const AccessPermissionSchema = z.discriminatedUnion("family", [
	z.strictObject({ family: z.literal("unit"), key: z.enum(UnitPermissionValues) }),
	z.strictObject({ family: z.literal("platform"), key: z.enum(PlatformCapabilityValues) }),
	z.strictObject({
		family: z.literal("management"),
		key: z.enum(AccessManagementPermissionValues),
	}),
]);

/** A sealed permission header and its decoded members do not establish a complete snapshot. @internal */
export class AccessPermissionSnapshotUnavailable extends Error {
	constructor() { super("Permission snapshot does not match its sealed header and digest"); }
}

/**
 * Decode a complete literal permission snapshot without expanding its approval.
 * @internal
 * @remarks Count, uniqueness, registry membership and the canonical digest must
 * all match the sealed header. Callers retain owning revision/freshness fences and
 * map malformed snapshots to unavailable; these members alone grant no authority.
 */
export function decodeAccessPermissionSnapshot(
	rows: readonly { family: string; permission: string }[], count: number, digest: string,
): AccessPermission[] {
	if (rows.length !== count || rows.length > AccessPermissionValues.length)
		throw new AccessPermissionSnapshotUnavailable();
	const members = rows.map(row => {
		const parsed = AccessPermissionSchema.safeParse({ family: row.family, key: row.permission });
		if (!parsed.success) throw new AccessPermissionSnapshotUnavailable();
		return parsed.data;
	});
	const keys = members.map(accessPermissionKey).sort();
	if (new Set(keys).size !== keys.length || createHash("sha256").update(keys.join("\n")).digest("hex") !== digest)
		throw new AccessPermissionSnapshotUnavailable();
	return members;
}
