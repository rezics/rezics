"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo, useTransition } from "react";

import { useNavigationProgressSignal } from "../navigation-progress-context";

type AppRouter = ReturnType<typeof useRouter>;

export function useApplicationRouter(): AppRouter {
	const router = useRouter();
	const [pending, startTransition] = useTransition();
	useNavigationProgressSignal(pending);

	const push = useCallback<AppRouter["push"]>(
		(href, options) => {
			startTransition(() => router.push(href, options));
		},
		[router, startTransition],
	);
	const replace = useCallback<AppRouter["replace"]>(
		(href, options) => {
			startTransition(() => router.replace(href, options));
		},
		[router, startTransition],
	);
	const refresh = useCallback<AppRouter["refresh"]>(() => {
		startTransition(() => router.refresh());
	}, [router, startTransition]);

	return useMemo(
		() => ({
			...router,
			push,
			refresh,
			replace,
		}),
		[push, refresh, replace, router],
	);
}
