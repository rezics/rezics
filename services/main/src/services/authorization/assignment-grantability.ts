import {
	isUnitPermissionApplicable,
	isUnitPermissionDelegable,
	snapshotAccessPermissionCeiling,
	type AccessPermission,
} from "@rezics/access";
import type { DatabaseTransaction } from "../database";
import { resolveReferenceValue } from "../units/reference-value";
import { resolveAccessScope } from "./identities";
import { AccessDenied, AccessUnavailable } from "./http-errors";
const control = new Set([
	"access.role.read",
	"access.role.create",
	"access.role.update",
	"access.role.activate",
	"access.role.retire",
	"access.role-binding.manage",
	"access.assignment-ceiling.manage",
]);
const resourceControl = new Set([
	"access.group.read",
	"access.group.create",
	"access.group.update",
	"access.group.reparent",
	"access.group.retire",
	"access.group.membership.manage",
	"access.membership.read",
	"access.membership.manage",
	"access.membership.participate",
	"app.read",
	"app.create",
	"app.update",
	"app.disable",
	"app.retire",
]);
/** Explicit root applicability, independent from management authority and data possession. @internal */
export async function requireAssignmentApplicability(
	tx: DatabaseTransaction,
	scopeId: string,
	permissions: readonly AccessPermission[],
) {
	const target = await resolveAccessScope(tx, scopeId);
	if (!target) throw new AccessUnavailable();
	const reference =
		target.kind === "resource" ? await resolveReferenceValue(tx, target.referenceValueId) : null;
	if (target.kind === "resource" && !reference) throw new AccessUnavailable();
	for (const permission of snapshotAccessPermissionCeiling(permissions)) {
		if (permission.family === "platform") {
			if (target.kind !== "platform") throw new AccessDenied();
			continue;
		}
		if (permission.family === "unit") {
			if (
				!reference ||
				!isUnitPermissionDelegable(permission.key) ||
				!isUnitPermissionApplicable(
					reference.owner === "realm" || reference.owner === "entity" || reference.owner === "zone"
						? reference.owner
						: "unit",
					permission.key,
				)
			)
				throw new AccessDenied();
			continue;
		}
		if (control.has(permission.key)) continue;
		if (target.kind === "resource" && resourceControl.has(permission.key)) continue;
		if (
			reference?.owner === "entity" &&
			["access.identity.select", "access.representation.manage"].includes(permission.key)
		)
			continue;
		if (
			target.kind === "account" &&
			["app.read", "app.create", "app.update", "app.disable", "app.retire"].includes(permission.key)
		)
			continue;
		if (
			target.kind === "platform" &&
			["access.membership.recover", "app.trust.manage", "app.read"].includes(permission.key)
		)
			continue;
		throw new AccessDenied();
	}
}
