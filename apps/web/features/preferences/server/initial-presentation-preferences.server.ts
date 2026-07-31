import type { QueryClient } from "@tanstack/react-query";

import type { InitialAuthSession } from "@/features/auth/server/initial-session.server";
import { getBackendOrigin } from "@/lib/backend-origin.server";
import {
	parsePresentationPreferences,
	presentationPreferencesQueryKey,
	type PresentationPreferences,
} from "../model/presentation-preferences";

const PresentationPreferencesBootstrapTimeoutMs = 5_000;

export type InitialPresentationPreferences =
	| { readonly status: "resolved"; readonly data: PresentationPreferences }
	| { readonly status: "unavailable" };

/**
 * Seeds preferences under the Better Auth account that authenticated the request.
 *
 * @remarks
 * The API response's `profileId` is a Profile Unit ID, not the Better Auth account ID.
 */
export function seedInitialPresentationPreferences(
	queryClient: QueryClient,
	initialSession: InitialAuthSession,
	initialPreferences: InitialPresentationPreferences,
) {
	if (
		initialSession.status !== "resolved" ||
		!initialSession.data ||
		initialPreferences.status !== "resolved"
	)
		return;

	queryClient.setQueryData(
		presentationPreferencesQueryKey(initialSession.data.user.id),
		initialPreferences.data,
	);
}

export async function getInitialPresentationPreferences(
	requestHeaders: Headers,
): Promise<InitialPresentationPreferences> {
	const cookie = requestHeaders.get("cookie");
	if (!cookie) return { status: "unavailable" };

	try {
		const response = await fetch(new URL("/api/v1/users/me/preferences", getBackendOrigin()), {
			cache: "no-store",
			headers: { accept: "application/json", cookie },
			signal: AbortSignal.timeout(PresentationPreferencesBootstrapTimeoutMs),
		});
		if (!response.ok) return { status: "unavailable" };

		const data = parsePresentationPreferences(await response.json());
		return data ? { status: "resolved", data } : { status: "unavailable" };
	} catch {
		return { status: "unavailable" };
	}
}
