import {
	AccessPermissionValues,
	accessPermissionKey,
	isAccessPermission,
	type AccessPermission,
} from "./management";
import { expandUnitPermissions, expandPlatformCapabilities } from "./permissions";
function validate(values: readonly AccessPermission[]): Set<string> {
	if (!Array.isArray(values) || values.length > AccessPermissionValues.length)
		throw new TypeError("Permission set exceeds the registered vocabulary");
	const keys = new Set<string>();
	for (const value of values) {
		if (!isAccessPermission(value))
			throw new TypeError("Unknown or malformed permission reference");
		keys.add(accessPermissionKey(value));
	}
	return keys;
}
function closure(permission: AccessPermission): readonly AccessPermission[] {
	switch (permission.family) {
		case "unit":
			return expandUnitPermissions([permission.key]).map((key) => ({ family: "unit", key }));
		case "platform":
			return expandPlatformCapabilities([permission.key]).map((key) => ({
				family: "platform",
				key,
			}));
		case "management":
			return [permission];
	}
}
function canonical(keys: ReadonlySet<string>): readonly AccessPermission[] {
	return Object.freeze(
		AccessPermissionValues.filter((value) => keys.has(accessPermissionKey(value))).map((value) =>
			Object.freeze({ ...value }),
		),
	);
}
/**
 * Capture the complete registered permission closure when an owner approves authority.
 * @internal
 * @remarks Persist these explicit references, not a wildcard or a role-head link.
 * Scope, recipient, validity, grantability and current assigning authority must be
 * checked independently. This pure snapshot does not authorize its caller.
 */
export function snapshotAccessPermissionCeiling(
	authored: readonly AccessPermission[],
): readonly AccessPermission[] {
	validate(authored);
	const keys = new Set<string>();
	for (const permission of authored)
		for (const implied of closure(permission)) keys.add(accessPermissionKey(implied));
	return canonical(keys);
}
/**
 * Limit current role/grant permissions to a previously recorded explicit approval.
 * @internal
 * @remarks Never expand the stored approval. If a current permission requires a
 * prerequisite absent from that approval, omit that permission too. Re-expanding
 * the result would bypass the approval and is forbidden. Empty approval permits
 * nothing; a ceiling by itself grants nothing. Policy restrictions remain separate.
 */
export function constrainAccessPermissions(
	authored: readonly AccessPermission[],
	approved: readonly AccessPermission[],
): readonly AccessPermission[] {
	const candidates = snapshotAccessPermissionCeiling(authored),
		allowed = validate(approved),
		effective = new Set<string>();
	for (const permission of candidates) {
		const required = closure(permission);
		if (required.every((value) => allowed.has(accessPermissionKey(value))))
			effective.add(accessPermissionKey(permission));
	}
	return canonical(effective);
}
/**
 * Test whether an entire proposed permission closure fits an explicit recorded ceiling.
 * @internal
 * @remarks Use for all-or-nothing assignment-impact admission rather than silently
 * clipping the requested assignment. This says nothing about recipient, target,
 * condition, lifetime, membership, representation or manager authority.
 */
export function accessPermissionCeilingCovers(
	proposed: readonly AccessPermission[],
	approved: readonly AccessPermission[],
): boolean {
	const candidates = snapshotAccessPermissionCeiling(proposed),
		allowed = validate(approved);
	return candidates.every((value) => allowed.has(accessPermissionKey(value)));
}
