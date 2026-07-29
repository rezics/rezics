"use client";

import { usePostApiProgressByUnitIdNodesByNodeIdRead } from "@rezics/openapi-tanstack-query";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import { useHydratedSession } from "@/lib/use-hydrated-session";
import { invalidateProgressQueries } from "../data/progress-cache";

export function ChapterReadingProgress({
	nodeId,
	unitId,
}: {
	readonly nodeId: string;
	readonly unitId: string;
}) {
	const authenticated = Boolean(useHydratedSession().data);
	const queryClient = useQueryClient();
	const mutation = usePostApiProgressByUnitIdNodesByNodeIdRead({
		mutation: {
			onSuccess: () => invalidateProgressQueries(queryClient, unitId),
			retry: 1,
		},
	});
	const mutate = mutation.mutate;
	const recordedKey = useRef<string | undefined>(undefined);

	useEffect(() => {
		if (!authenticated) return;
		const key = `${unitId}:${nodeId}`;
		const recordWhenVisible = () => {
			if (document.visibilityState !== "visible" || recordedKey.current === key) return;
			recordedKey.current = key;
			mutate({ path: { nodeId, unitId } });
		};

		recordWhenVisible();
		document.addEventListener("visibilitychange", recordWhenVisible);
		return () => document.removeEventListener("visibilitychange", recordWhenVisible);
	}, [authenticated, mutate, nodeId, unitId]);

	return null;
}
