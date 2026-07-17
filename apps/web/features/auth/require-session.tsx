"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";

import { Spinner } from "@rezics/ui";
import { useAuthPortal } from "@/features/auth/auth-portal";
import { useHydratedSession } from "@/lib/use-hydrated-session";

export function RequireSession({ children }: { children: ReactNode }) {
	const { data: session, isPending } = useHydratedSession();
	const pathname = usePathname();
	const router = useRouter();
	const { openAuthPortal } = useAuthPortal();
	const openedDestination = useRef<string | null>(null);
	useEffect(() => {
		const destination = `${window.location.pathname}${window.location.search}${window.location.hash}`;
		if (isPending || session) {
			openedDestination.current = null;
			return;
		}
		if (openedDestination.current === destination) return;
		openedDestination.current = destination;
		openAuthPortal("login", {
			destination,
			onClose: () => router.replace("/"),
		});
	}, [isPending, openAuthPortal, pathname, router, session]);
	if (!session)
		return (
			<main className="grid min-h-80 place-items-center">
				<Spinner />
			</main>
		);
	return children;
}
