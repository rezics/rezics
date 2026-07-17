import { redirect } from "next/navigation";

import type { AuthPortalMode } from "@/lib/auth-redirect";
import { serializeAuthSearchParams } from "@/lib/search-params.server";

export type AuthRouteSearchParams = Promise<Record<string, string | string[] | undefined>>;

const ForwardedParams = ["next", "email", "token", "error"] as const;

export async function redirectToAuthPortal(
	mode: AuthPortalMode,
	searchParams: AuthRouteSearchParams,
) {
	const source = await searchParams;
	const forwarded: Record<(typeof ForwardedParams)[number], string | undefined> = {
		next: undefined,
		email: undefined,
		token: undefined,
		error: undefined,
	};
	for (const key of ForwardedParams) {
		const value = source[key];
		if (typeof value === "string") forwarded[key] = value;
	}
	redirect(serializeAuthSearchParams("/", { auth: mode, ...forwarded }));
}
