"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Spinner } from "@rezics/ui";
import { authClient } from "@/lib/auth-client";

export function RequireSession({ children }: { children: ReactNode }) {
	const { data: session, isPending } = authClient.useSession();
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const router = useRouter();
	useEffect(() => {
		const query = searchParams.toString();
		const destination = query ? `${pathname}?${query}` : pathname;
		if (!isPending && !session)
			router.replace(`/login?next=${encodeURIComponent(destination)}`);
	}, [isPending, pathname, router, searchParams, session]);
	if (!session)
		return (
			<main className="grid min-h-80 place-items-center">
				<Spinner />
			</main>
		);
	return children;
}
