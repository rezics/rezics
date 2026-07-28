import type { AuthSession } from "@/lib/auth-client";
import { getBackendOrigin } from "@/lib/backend-origin.server";

const SessionBootstrapTimeoutMs = 5_000;

export type InitialAuthSession =
	| { readonly status: "resolved"; readonly data: AuthSession | null }
	| { readonly status: "unavailable" };

type AuthSessionParseResult =
	{ readonly valid: true; readonly data: AuthSession | null } | { readonly valid: false };

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseDate(value: unknown): Date | undefined {
	if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value))
		return undefined;
	const date = new Date(value);
	return Number.isNaN(date.getTime()) || date.toISOString() !== value ? undefined : date;
}

export function parseAuthSessionPayload(value: unknown): AuthSessionParseResult {
	if (value === null) return { valid: true, data: null };
	if (!isRecord(value) || !isRecord(value.session) || !isRecord(value.user))
		return { valid: false };

	const session = value.session;
	const user = value.user;
	const sessionCreatedAt = parseDate(session.createdAt);
	const sessionUpdatedAt = parseDate(session.updatedAt);
	const expiresAt = parseDate(session.expiresAt);
	const userCreatedAt = parseDate(user.createdAt);
	const userUpdatedAt = parseDate(user.updatedAt);
	const ipAddress = session.ipAddress;
	const userAgent = session.userAgent;
	const image = user.image;

	if (
		typeof session.id !== "string" ||
		typeof session.userId !== "string" ||
		typeof session.token !== "string" ||
		!sessionCreatedAt ||
		!sessionUpdatedAt ||
		!expiresAt ||
		(ipAddress !== undefined && ipAddress !== null && typeof ipAddress !== "string") ||
		(userAgent !== undefined && userAgent !== null && typeof userAgent !== "string") ||
		typeof user.id !== "string" ||
		typeof user.email !== "string" ||
		typeof user.emailVerified !== "boolean" ||
		typeof user.name !== "string" ||
		!userCreatedAt ||
		!userUpdatedAt ||
		(image !== undefined && image !== null && typeof image !== "string")
	)
		return { valid: false };

	const parsedSession: AuthSession["session"] = {
		id: session.id,
		userId: session.userId,
		token: session.token,
		createdAt: sessionCreatedAt,
		updatedAt: sessionUpdatedAt,
		expiresAt,
		ipAddress,
		userAgent,
	};
	const parsedUser: AuthSession["user"] = {
		id: user.id,
		email: user.email,
		emailVerified: user.emailVerified,
		name: user.name,
		createdAt: userCreatedAt,
		updatedAt: userUpdatedAt,
		image,
	};

	return {
		valid: true,
		data: { session: parsedSession, user: parsedUser },
	};
}

export async function getInitialAuthSession(requestHeaders: Headers): Promise<InitialAuthSession> {
	const cookie = requestHeaders.get("cookie");
	if (!cookie) return { status: "resolved", data: null };

	try {
		const url = new URL("/api/auth/get-session?disableRefresh=true", getBackendOrigin());
		const response = await fetch(url, {
			cache: "no-store",
			headers: { cookie },
			signal: AbortSignal.timeout(SessionBootstrapTimeoutMs),
		});
		if (!response.ok) return { status: "unavailable" };

		const payload: unknown = await response.json();
		const result = parseAuthSessionPayload(payload);
		return result.valid ? { status: "resolved", data: result.data } : { status: "unavailable" };
	} catch {
		return { status: "unavailable" };
	}
}
