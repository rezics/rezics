import { describe, expect, it, vi } from "vitest";

import type { InitialAuthSession } from "./server/initial-session.server";
import { deriveAuthSessionState } from "./session-provider";
import type { AuthSession, AuthSessionSnapshot } from "@/lib/auth-client";

const session: AuthSession = {
	session: {
		id: "session-id",
		userId: "user-id",
		token: "session-token",
		createdAt: new Date("2026-07-28T00:00:00.000Z"),
		updatedAt: new Date("2026-07-28T00:00:00.000Z"),
		expiresAt: new Date("2026-08-04T00:00:00.000Z"),
	},
	user: {
		id: "user-id",
		email: "member@example.com",
		emailVerified: true,
		name: "Member",
		createdAt: new Date("2026-07-28T00:00:00.000Z"),
		updatedAt: new Date("2026-07-28T00:00:00.000Z"),
	},
};

function snapshot(overrides: Partial<AuthSessionSnapshot> = {}): AuthSessionSnapshot {
	return {
		data: null,
		error: null,
		isPending: true,
		isRefetching: true,
		refetch: vi.fn(async () => undefined),
		...overrides,
	};
}

describe("auth session state", () => {
	it.each<{
		initial: InitialAuthSession;
		expectedStatus: "authenticated" | "anonymous" | "restoring";
	}>([
		{
			initial: { status: "resolved", data: session },
			expectedStatus: "authenticated",
		},
		{
			initial: { status: "resolved", data: null },
			expectedStatus: "anonymous",
		},
		{
			initial: { status: "unavailable" },
			expectedStatus: "restoring",
		},
	])(
		"uses the server result while the client session is pending",
		({ initial, expectedStatus }) => {
			expect(deriveAuthSessionState(initial, snapshot()).status).toBe(expectedStatus);
		},
	);

	it("uses the settled client session after bootstrap", () => {
		const initial: InitialAuthSession = { status: "resolved", data: session };
		const state = deriveAuthSessionState(
			initial,
			snapshot({ data: null, isPending: false, isRefetching: false }),
		);

		expect(state.status).toBe("anonymous");
		expect(state.data).toBeNull();
	});

	it("preserves known identity when session revalidation fails", () => {
		const error: NonNullable<AuthSessionSnapshot["error"]> = Object.assign(
			new Error("Unavailable"),
			{
				status: 503,
				statusText: "Unavailable",
				error: { code: "SERVICE_UNAVAILABLE" },
			},
		);
		const state = deriveAuthSessionState(
			{ status: "resolved", data: session },
			snapshot({
				data: session,
				error,
				isPending: false,
				isRefetching: false,
			}),
		);

		expect(state.status).toBe("error");
		expect(state.data).toBe(session);
		expect(state.error).toBe(error);
	});
});
