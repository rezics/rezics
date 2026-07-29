/** @vitest-environment jsdom */

import { cleanup, render } from "@testing-library/react";
import {
	dehydrate,
	QueryClient,
	useQueryClient,
	type DehydratedState,
} from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AuthSessionState } from "./session-provider";
import {
	getInitialQueryCacheIdentity,
	getQueryCacheIdentity,
	SessionQueryClientBoundary,
} from "./session-query-client-boundary";
import type { InitialAuthSession } from "./server/initial-session.server";
import type { AuthSession } from "@/lib/auth-client";

const sessionSnapshot = vi.hoisted(() => ({
	current: null as AuthSessionState | null,
}));

vi.mock("@/lib/use-hydrated-session", () => ({
	useHydratedSession: () => {
		if (!sessionSnapshot.current) throw new Error("Missing test session");
		return sessionSnapshot.current;
	},
}));

const EmptyDehydratedState: DehydratedState = { mutations: [], queries: [] };

function authSession(accountId: string): AuthSession {
	return {
		session: {
			id: `session-${accountId}`,
			userId: accountId,
			token: `token-${accountId}`,
			createdAt: new Date("2026-07-28T00:00:00.000Z"),
			updatedAt: new Date("2026-07-28T00:00:00.000Z"),
			expiresAt: new Date("2026-08-04T00:00:00.000Z"),
		},
		user: {
			id: accountId,
			email: `${accountId}@example.com`,
			emailVerified: true,
			name: accountId,
			createdAt: new Date("2026-07-28T00:00:00.000Z"),
			updatedAt: new Date("2026-07-28T00:00:00.000Z"),
		},
	};
}

function authenticated(accountId: string): AuthSessionState {
	return {
		status: "authenticated",
		data: authSession(accountId),
		error: null,
		isPending: false,
		isRefetching: false,
		refetch: vi.fn(async () => undefined),
	};
}

function anonymous(): AuthSessionState {
	return {
		status: "anonymous",
		data: null,
		error: null,
		isPending: false,
		isRefetching: false,
		refetch: vi.fn(async () => undefined),
	};
}

function initialSession(accountId: string | null): InitialAuthSession {
	return {
		status: "resolved",
		data: accountId ? authSession(accountId) : null,
	};
}

afterEach(() => {
	cleanup();
	sessionSnapshot.current = null;
});

describe("session query cache identity", () => {
	it("distinguishes anonymous, unavailable, and profile caches", () => {
		expect(getInitialQueryCacheIdentity({ status: "unavailable" })).toBe("session:unavailable");
		expect(getInitialQueryCacheIdentity(initialSession(null))).toBe("session:anonymous");
		expect(getInitialQueryCacheIdentity(initialSession("account-a"))).toBe("account:account-a");
		expect(getQueryCacheIdentity(anonymous())).toBe("session:anonymous");
		expect(getQueryCacheIdentity(authenticated("account-a"))).toBe("account:account-a");
	});
});

describe("SessionQueryClientBoundary", () => {
	it("replaces the entire cache before rendering a newly authenticated identity", () => {
		sessionSnapshot.current = anonymous();
		const observedClients: QueryClient[] = [];

		function Probe() {
			observedClients.push(useQueryClient());
			return null;
		}

		const initial = initialSession(null);
		const view = render(
			<SessionQueryClientBoundary
				dehydratedState={EmptyDehydratedState}
				initialSession={initial}
			>
				<Probe />
			</SessionQueryClientBoundary>,
		);
		const anonymousClient = observedClients.at(-1);
		expect(anonymousClient).toBeDefined();
		anonymousClient?.setQueryData(["private"], "anonymous data");

		sessionSnapshot.current = authenticated("account-a");
		view.rerender(
			<SessionQueryClientBoundary
				dehydratedState={EmptyDehydratedState}
				initialSession={initial}
			>
				<Probe />
			</SessionQueryClientBoundary>,
		);

		const accountClient = observedClients.at(-1);
		expect(accountClient).toBeDefined();
		expect(accountClient).not.toBe(anonymousClient);
		expect(accountClient?.getQueryData(["private"])).toBeUndefined();
	});

	it("does not hydrate server data into a different account cache", () => {
		const serverClient = new QueryClient();
		serverClient.setQueryData(["private"], "account-a data");
		sessionSnapshot.current = authenticated("account-b");
		let hydratedValue: unknown;

		function Probe() {
			hydratedValue = useQueryClient().getQueryData(["private"]);
			return null;
		}

		render(
			<SessionQueryClientBoundary
				dehydratedState={dehydrate(serverClient)}
				initialSession={initialSession("account-a")}
			>
				<Probe />
			</SessionQueryClientBoundary>,
		);

		expect(hydratedValue).toBeUndefined();
	});
});
