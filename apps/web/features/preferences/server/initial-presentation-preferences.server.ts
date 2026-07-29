import { getBackendOrigin } from "@/lib/backend-origin.server";
import {
	parsePresentationPreferences,
	type PresentationPreferences,
} from "../model/presentation-preferences";

const PresentationPreferencesBootstrapTimeoutMs = 5_000;

export type InitialPresentationPreferences =
	| { readonly status: "resolved"; readonly data: PresentationPreferences }
	| { readonly status: "unavailable" };

export async function getInitialPresentationPreferences(
	requestHeaders: Headers,
): Promise<InitialPresentationPreferences> {
	const cookie = requestHeaders.get("cookie");
	if (!cookie) return { status: "unavailable" };

	try {
		const response = await fetch(new URL("/api/users/me/preferences", getBackendOrigin()), {
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
