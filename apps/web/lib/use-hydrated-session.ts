"use client";

import { useSyncExternalStore } from "react";

import { authClient } from "./auth-client";

const subscribe = () => () => undefined;

export function useHydratedSession() {
	const session = authClient.useSession();
	const hydrated = useSyncExternalStore(
		subscribe,
		() => true,
		() => false,
	);

	return hydrated ? session : { ...session, data: null, isPending: true };
}
