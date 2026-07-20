"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, type ReactNode } from "react";

import { authClient } from "@/lib/auth-client";

export function SessionCacheBoundary({ children }: { children: ReactNode }) {
	const { data: session, isPending } = authClient.useSession();
	const queryClient = useQueryClient();
	const identity = session?.user.id ?? null;
	const previous = useRef<string | null | undefined>(undefined);

	useEffect(() => {
		if (isPending) return;
		if (previous.current !== undefined && previous.current !== identity) queryClient.clear();
		previous.current = identity;
	}, [identity, isPending, queryClient]);

	return children;
}
