export const KnownAttributionRoles = [
	"publisher",
	"author",
	"editor",
	"developer",
	"director",
] as const;

export type KnownAttributionRole = (typeof KnownAttributionRoles)[number];

export function isKnownAttributionRole(role: string): role is KnownAttributionRole {
	return (KnownAttributionRoles as readonly string[]).includes(role);
}
