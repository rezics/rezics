"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

import type { InitialAuthSession } from "./server/initial-session.server";
import { authClient, type AuthSession, type AuthSessionSnapshot } from "@/lib/auth-client";

type AuthSessionError = AuthSessionSnapshot["error"];
type AuthSessionRefetch = AuthSessionSnapshot["refetch"];

export type AuthSessionState =
	| {
			readonly status: "restoring";
			readonly data: null;
			readonly error: null;
			readonly isPending: true;
			readonly isRefetching: boolean;
			readonly refetch: AuthSessionRefetch;
	  }
	| {
			readonly status: "authenticated";
			readonly data: AuthSession;
			readonly error: null;
			readonly isPending: false;
			readonly isRefetching: boolean;
			readonly refetch: AuthSessionRefetch;
	  }
	| {
			readonly status: "anonymous";
			readonly data: null;
			readonly error: null;
			readonly isPending: false;
			readonly isRefetching: boolean;
			readonly refetch: AuthSessionRefetch;
	  }
	| {
			readonly status: "error";
			readonly data: AuthSession | null;
			readonly error: NonNullable<AuthSessionError>;
			readonly isPending: false;
			readonly isRefetching: boolean;
			readonly refetch: AuthSessionRefetch;
	  };

const AuthSessionContext = createContext<AuthSessionState | undefined>(undefined);

export function deriveAuthSessionState(
	initial: InitialAuthSession,
	current: AuthSessionSnapshot,
): AuthSessionState {
	const shared = {
		isRefetching: current.isRefetching,
		refetch: current.refetch,
	};

	if (current.isPending) {
		if (initial.status === "unavailable")
			return {
				status: "restoring",
				data: null,
				error: null,
				isPending: true,
				...shared,
			};
		if (initial.data)
			return {
				status: "authenticated",
				data: initial.data,
				error: null,
				isPending: false,
				...shared,
			};
		return {
			status: "anonymous",
			data: null,
			error: null,
			isPending: false,
			...shared,
		};
	}

	if (current.error)
		return {
			status: "error",
			data: current.data,
			error: current.error,
			isPending: false,
			...shared,
		};
	if (current.data)
		return {
			status: "authenticated",
			data: current.data,
			error: null,
			isPending: false,
			...shared,
		};
	return {
		status: "anonymous",
		data: null,
		error: null,
		isPending: false,
		...shared,
	};
}

export function AuthSessionProvider({
	children,
	initialSession,
}: {
	readonly children: ReactNode;
	readonly initialSession: InitialAuthSession;
}) {
	const [initial] = useState(() => {
		if (initialSession.status === "resolved" && initialSession.data)
			authClient.hydrateSession(initialSession.data);
		return initialSession;
	});
	const current = authClient.useSession();

	return (
		<AuthSessionContext value={deriveAuthSessionState(initial, current)}>
			{children}
		</AuthSessionContext>
	);
}

export function useAuthSession(): AuthSessionState {
	const session = useContext(AuthSessionContext);
	if (!session) throw new Error("useAuthSession must be used within AuthSessionProvider");
	return session;
}
