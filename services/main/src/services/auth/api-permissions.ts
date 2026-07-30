export const ApiPermissionValues = [
	"unit:read",
	"unit:create",
	"unit:update",
	"profile:read",
	"profile:update",
	"interaction:read",
	"interaction:write",
	"realm:read",
	"realm:manage",
	"message:read",
	"message:write",
	"notification:read",
	"notification:write",
	"recommendation:read",
	"recommendation:write",
	"upload:read",
	"upload:write",
	"report:write",
] as const;

export type ApiPermission = (typeof ApiPermissionValues)[number];
export type ApiKeyPermissions = Record<string, string[]>;

const permissionParts = {
	"unit:read": ["unit", "read"],
	"unit:create": ["unit", "create"],
	"unit:update": ["unit", "update"],
	"profile:read": ["profile", "read"],
	"profile:update": ["profile", "update"],
	"interaction:read": ["interaction", "read"],
	"interaction:write": ["interaction", "write"],
	"realm:read": ["realm", "read"],
	"realm:manage": ["realm", "manage"],
	"message:read": ["message", "read"],
	"message:write": ["message", "write"],
	"notification:read": ["notification", "read"],
	"notification:write": ["notification", "write"],
	"recommendation:read": ["recommendation", "read"],
	"recommendation:write": ["recommendation", "write"],
	"upload:read": ["upload", "read"],
	"upload:write": ["upload", "write"],
	"report:write": ["report", "write"],
} as const satisfies Record<ApiPermission, readonly [string, string]>;

const permissionSet: ReadonlySet<string> = new Set(ApiPermissionValues);

export function isApiPermission(value: string): value is ApiPermission {
	return permissionSet.has(value);
}

export function toApiKeyPermissions(permission: ApiPermission): ApiKeyPermissions;
export function toApiKeyPermissions(permissions: readonly ApiPermission[]): ApiKeyPermissions;
export function toApiKeyPermissions(
	permissionOrPermissions: ApiPermission | readonly ApiPermission[],
): ApiKeyPermissions {
	const permissions =
		typeof permissionOrPermissions === "string"
			? [permissionOrPermissions]
			: permissionOrPermissions;
	const statements: ApiKeyPermissions = {};
	for (const permission of permissions) {
		const [resource, action] = permissionParts[permission];
		const existing = statements[resource] ?? [];
		statements[resource] = existing.includes(action) ? existing : [...existing, action];
	}
	return statements;
}

export function fromApiKeyPermissions(permissions: ApiKeyPermissions | null | undefined) {
	if (!permissions) return [];
	return ApiPermissionValues.filter((permission) => {
		const [resource, action] = permissionParts[permission];
		return permissions[resource]?.includes(action) ?? false;
	});
}
