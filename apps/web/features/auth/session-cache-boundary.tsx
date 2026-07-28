"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, type ReactNode } from "react";

import { useHydratedSession } from "@/lib/use-hydrated-session";

export function SessionCacheBoundary({ children }: { children: ReactNode }) {
	const session = useHydratedSession();
	const queryClient = useQueryClient();
	const previous = useRef<string | null | undefined>(undefined);

	useEffect(() => {
		if (session.status === "restoring" || session.status === "error") return;
		const identity = session.data?.user.id ?? null;
		if (previous.current !== undefined && previous.current !== identity) queryClient.clear();
		previous.current = identity;
	}, [queryClient, session.data, session.status]);

	return children;
}
