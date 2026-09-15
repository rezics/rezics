import {
	PlatformCapabilityValues,
	UnitPermissionValues,
	type PlatformCapability,
	type UnitPermission,
} from "./permissions";

/** Canonical management actions for the mixed IAM target; transport activation is separately gated. @alpha */
export const AccessManagementPermissionValues = [
	"access.identity.select",
	"access.representation.manage",
	"access.group.read",
	"access.group.create",
	"access.group.update",
	"access.group.reparent",
	"access.group.retire",
	"access.role.read",
	"access.role.create",
	"access.role.update",
	"access.role.activate",
	"access.role.retire",
	"access.role-binding.manage",
	"access.assignment-ceiling.manage",
	"app.read",
	"app.create",
	"app.update",
	"app.disable",
	"app.retire",
	"app.trust.manage",
] as const;
/** A management action remains distinct from the data permissions it can assign. @alpha */
export type AccessManagementPermission = (typeof AccessManagementPermissionValues)[number];

/** Semantic boundaries used by scope policy and future API metadata. @alpha */
export const AccessManagementPermissionDefinitions = {
	"access.representation.manage": { resource: "access.representation", action: "manage", rationale: "Confer authority at the represented Entity is separate from exercising its resource permissions." },
	"app.read": { resource: "app", action: "read" },
	"app.create": { resource: "app", action: "create" },
	"app.update": { resource: "app", action: "update", rationale: "App declarations and enabling remain separate from consent and installation approval." },
	"app.disable": { resource: "app", action: "disable", rationale: "Stopping App credential use does not confer the ability to enable or expand the App." },
	"app.retire": { resource: "app", action: "retire", rationale: "Terminal App retirement retains history and does not delete installed content." },
	"app.trust.manage": { resource: "app.trust", action: "manage", rationale: "Platform trust review is independent from publisher control or a user's installation approval." },
	"access.identity.select": {
		resource: "access.identity",
		action: "select",
		rationale:
			"Selecting a controlled Entity as a private default requires current representation for this action on that Entity's identity path; it grants no data access or account administration.",
	},
	"access.group.read": { resource: "access.group", action: "read" },
	"access.group.create": { resource: "access.group", action: "create" },
	"access.group.update": { resource: "access.group", action: "update", rationale: "Presentation editing preserves topology and membership; it confers no enrollment or assignment power." },
	"access.group.reparent": { resource: "access.group", action: "reparent", rationale: "Changing inherited recipients requires separate assignment-impact and recovery admission; presentation editing cannot move a Group." },
	"access.group.retire": { resource: "access.group", action: "retire", rationale: "Terminal retirement ends Group effectiveness while retaining private history and requires recovery continuity." },
	"access.role.read": { resource: "access.role", action: "read" },
	"access.role.create": { resource: "access.role", action: "create" },
	"access.role.update": { resource: "access.role", action: "update" },
	"access.role.activate": {
		resource: "access.role",
		action: "activate",
		rationale:
			"Activating a definition changes permissions of live bindings and requires assignment-impact admission independently from preparing that definition.",
	},
	"access.role.retire": {
		resource: "access.role",
		action: "retire",
		rationale:
			"Retirement ends role authority while retaining its immutable definitions and binding history.",
	},
	"access.role-binding.manage": {
		resource: "access.role-binding",
		action: "manage",
		rationale:
			"Admitting, narrowing or revoking a named role assignment is separate from using its data permissions and defining the role.",
	},
	"access.assignment-ceiling.manage": {
		resource: "access.assignment-ceiling",
		action: "manage",
		rationale:
			"Changing what another manager may confer changes administrative authority and cannot be implied by role editing or assignment.",
	},
} as const satisfies Record<
	AccessManagementPermission,
	{ resource: string; action: string; rationale?: string }
>;

/** A permission's registry family is part of its meaning, even when spellings overlap. @internal */
export type AccessPermission =
	| { family: "unit"; key: UnitPermission }
	| { family: "platform"; key: PlatformCapability }
	| { family: "management"; key: AccessManagementPermission };

/** Complete registered references; scopes and current grantability are separate policies. @internal */
export const AccessPermissionValues: readonly AccessPermission[] = Object.freeze([
	...UnitPermissionValues.map((key) => Object.freeze({ family: "unit" as const, key })),
	...PlatformCapabilityValues.map((key) => Object.freeze({ family: "platform" as const, key })),
	...AccessManagementPermissionValues.map((key) =>
		Object.freeze({ family: "management" as const, key }),
	),
]);
/** Unambiguous identity for hashing, comparison and selection of a registered permission. @internal */
export function accessPermissionKey(permission: AccessPermission): string {
	return `${permission.family}:${permission.key}`;
}
const registeredPermissions = new Set(AccessPermissionValues.map(accessPermissionKey));
/** Validate a permission reference without erasing its registry family. @internal */
export function isAccessPermission(value: unknown): value is AccessPermission {
	if (
		!value ||
		Array.isArray(value) ||
		typeof value !== "object" ||
		!("family" in value) ||
		!("key" in value)
	)
		return false;
	return (
		typeof value.family === "string" &&
		typeof value.key === "string" &&
		Object.keys(value).length === 2 &&
		Object.keys(value).every((key) => key === "family" || key === "key") &&
		registeredPermissions.has(`${value.family}:${value.key}`)
	);
}
