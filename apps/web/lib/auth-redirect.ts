export const AuthPortalModes = [
	"login",
	"register",
	"forgot-password",
	"reset-password",
	"verify-email",
] as const;

export type AuthPortalMode = (typeof AuthPortalModes)[number];

export function getSafeAuthDestination(value: string | null) {
	if (!value?.startsWith("/")) return "/";

	const origin = "https://rezics.invalid";
	try {
		const destination = new URL(value, origin);
		return destination.origin === origin
			? `${destination.pathname}${destination.search}${destination.hash}`
			: "/";
	} catch {
		return "/";
	}
}

export function getAuthPortalMode(value: string | null): AuthPortalMode | null {
	return AuthPortalModes.find((mode) => mode === value) ?? null;
}
