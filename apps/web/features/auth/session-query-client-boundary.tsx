"use client";

import {
	HydrationBoundary,
	QueryClientProvider,
	type DehydratedState,
} from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

import type { AuthSessionState } from "./session-provider";
import type { InitialAuthSession } from "./server/initial-session.server";
import { createQueryClient } from "@/lib/query-client";
import { useHydratedSession } from "@/lib/use-hydrated-session";

const AnonymousIdentity = "session:anonymous";
const UnavailableIdentity = "session:unavailable";

export function getInitialQueryCacheIdentity(initialSession: InitialAuthSession): string {
	if (initialSession.status === "unavailable") return UnavailableIdentity;
	return initialSession.data ? `account:${initialSession.data.user.id}` : AnonymousIdentity;
}

export function getQueryCacheIdentity(session: AuthSessionState): string {
	switch (session.status) {
		case "authenticated":
			return `account:${session.data.user.id}`;
		case "anonymous":
			return AnonymousIdentity;
		case "restoring":
			return UnavailableIdentity;
		case "error":
			return session.data ? `account:${session.data.user.id}` : UnavailableIdentity;
	}
}

function IdentityQueryClientBoundary({
	children,
	dehydratedState,
}: {
	readonly children: ReactNode;
	readonly dehydratedState?: DehydratedState;
}) {
	const [queryClient] = useState(createQueryClient);

	return (
		<QueryClientProvider client={queryClient}>
			{dehydratedState ? (
				<HydrationBoundary state={dehydratedState}>{children}</HydrationBoundary>
			) : (
				children
			)}
		</QueryClientProvider>
	);
}

export function SessionQueryClientBoundary({
	children,
	dehydratedState,
	initialSession,
}: {
	readonly children: ReactNode;
	readonly dehydratedState: DehydratedState;
	readonly initialSession: InitialAuthSession;
}) {
	const session = useHydratedSession();
	const identity = getQueryCacheIdentity(session);
	const initialIdentity = getInitialQueryCacheIdentity(initialSession);

	return (
		<IdentityQueryClientBoundary
			dehydratedState={identity === initialIdentity ? dehydratedState : undefined}
			key={identity}
		>
			{children}
		</IdentityQueryClientBoundary>
	);
}
