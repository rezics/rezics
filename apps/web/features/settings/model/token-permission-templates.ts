import type { PostApiApiTokensRequestPermissionsEnum } from "@rezics/openapi-tanstack-query";

export type ApiTokenPermission =
	(typeof PostApiApiTokensRequestPermissionsEnum)[keyof typeof PostApiApiTokensRequestPermissionsEnum];

/** Permissions needed by an automated content contributor, including community reference voting. */
export const ContentAgentPermissions = [
	"unit:read",
	"unit:create",
	"unit:update",
	"interaction:write",
	"profile:read",
	"upload:read",
	"upload:write",
] as const satisfies readonly ApiTokenPermission[];

export const ReadOnlyPermissions = [
	"unit:read",
	"profile:read",
	"interaction:read",
	"realm:read",
	"message:read",
	"notification:read",
	"recommendation:read",
	"upload:read",
] as const satisfies readonly ApiTokenPermission[];
