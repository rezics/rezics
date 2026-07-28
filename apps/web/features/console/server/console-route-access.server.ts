import { headers } from "next/headers";
import { forbidden } from "next/navigation";
import { cache } from "react";

import { getBackendOrigin } from "@/lib/backend-origin.server";
import { canAccessConsoleSection, getAccessibleConsoleSectionIds } from "../model/console-access";
import type { ConsoleSectionId } from "../model/console-section";

const ConsoleAccessTimeoutMs = 5_000;

export type ConsoleRouteAccess =
	| { readonly kind: "unauthenticated" }
	| {
			readonly kind: "authenticated";
			readonly platformCapabilities: readonly string[];
			readonly accessibleSectionIds: readonly ConsoleSectionId[];
	  };

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parsePlatformCapabilities(value: unknown): readonly string[] | undefined {
	if (!isRecord(value)) return undefined;
	const capabilities = value.platformCapabilities;
	if (!Array.isArray(capabilities) || !capabilities.every((item) => typeof item === "string"))
		return undefined;
	return capabilities;
}

/**
 * Resolves the authenticated caller's console sections from the backend authorization decision.
 */
export async function getConsoleRouteAccess(
	requestHeaders: Headers,
	fetcher: typeof fetch = fetch,
): Promise<ConsoleRouteAccess> {
	const cookie = requestHeaders.get("cookie");
	if (!cookie) return { kind: "unauthenticated" };

	const response = await fetcher(new URL("/api/users/me", getBackendOrigin()), {
		cache: "no-store",
		headers: { cookie },
		signal: AbortSignal.timeout(ConsoleAccessTimeoutMs),
	});
	if (response.status === 401) return { kind: "unauthenticated" };
	if (!response.ok) throw new Error(`Console access API failed with status ${response.status}`);

	const platformCapabilities = parsePlatformCapabilities(await response.json());
	if (!platformCapabilities)
		throw new Error("Console access API returned invalid platform capabilities");

	return {
		kind: "authenticated",
		platformCapabilities,
		accessibleSectionIds: getAccessibleConsoleSectionIds(platformCapabilities),
	};
}

const getCurrentConsoleRouteAccess = cache(async () => getConsoleRouteAccess(await headers()));

/**
 * Returns unauthenticated callers to the existing login flow and rejects authenticated callers
 * who cannot enter the requested console route.
 */
export async function requireConsoleRouteAccess(sectionId?: ConsoleSectionId): Promise<void> {
	const access = await getCurrentConsoleRouteAccess();
	if (access.kind === "unauthenticated") return;
	if (
		sectionId === undefined
			? access.accessibleSectionIds.length === 0
			: !canAccessConsoleSection(access.platformCapabilities, sectionId)
	)
		forbidden();
}
