"use client";

import { Alert, AlertAction, AlertDescription, Button } from "@rezics/ui";
import { useCallback, useEffect, useRef } from "react";

import { useTranslation } from "@/i18n/client";
import type { FeedContinuationState, FeedPaginationMode } from "../model/feed-continuation";

const InfiniteFeedRootMargin = "320px 0px";

export function FeedContinuation({
	mode,
	state,
}: {
	readonly mode: Exclude<FeedPaginationMode, "none">;
	readonly state: FeedContinuationState;
}) {
	const { t } = useTranslation(["actions", "state"]);
	const sentinelRef = useRef<HTMLDivElement>(null);
	const loadRequestedRef = useRef(false);
	const loadNextRef = useRef<(() => void | Promise<unknown>) | undefined>(undefined);
	const readyLoadNext = state.status === "ready" ? state.loadNext : undefined;

	useEffect(() => {
		loadNextRef.current = readyLoadNext;
		if (state.status !== "ready") loadRequestedRef.current = false;
	}, [readyLoadNext, state.status]);

	const requestLoad = useCallback(() => {
		const loadNext = loadNextRef.current;
		if (!loadNext || loadRequestedRef.current) return;
		loadRequestedRef.current = true;
		void loadNext();
	}, []);

	useEffect(() => {
		const sentinel = sentinelRef.current;
		if (
			mode !== "infinite" ||
			state.status !== "ready" ||
			!sentinel ||
			typeof IntersectionObserver === "undefined"
		)
			return;
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries.some((entry) => entry.isIntersecting)) requestLoad();
			},
			{ rootMargin: InfiniteFeedRootMargin },
		);
		observer.observe(sentinel);
		return () => observer.disconnect();
	}, [mode, requestLoad, state.status]);

	if (state.status === "exhausted") return null;
	if (state.status === "error")
		return (
			<Alert variant="destructive">
				<AlertDescription>{t.state.error}</AlertDescription>
				<AlertAction>
					<Button onClick={() => void state.retry()} size="sm" variant="quiet">
						{t.actions.retry}
					</Button>
				</AlertAction>
			</Alert>
		);

	const loading = state.status === "loading";
	return (
		<div aria-live="polite" className="flex min-h-10 justify-center py-2" ref={sentinelRef}>
			<Button
				disabled={state.status !== "ready"}
				isLoading={loading}
				onClick={requestLoad}
				size="sm"
				variant={mode === "infinite" ? "quiet" : "outline"}
			>
				{t.actions.loadMore}
			</Button>
		</div>
	);
}
