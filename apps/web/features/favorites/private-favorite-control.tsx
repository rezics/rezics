"use client";

import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import {
	useDeleteApiFavoritesByTargetUnitId,
	useGetApiFavoritesByTargetUnitId,
	usePutApiFavoritesByTargetUnitId,
} from "@rezics/openapi-tanstack-query";
import { Button, QueryFailure } from "@rezics/ui";
import { useQueryClient } from "@tanstack/react-query";
import { BookmarkIcon, CheckIcon } from "lucide-react";
import { useState } from "react";
import { invalidateFavorites } from "./favorite-cache";
import { FavoriteHistory } from "./favorite-history";

export function PrivateFavoriteControl({ targetUnitId }: { targetUnitId: string }) {
	const { t } = useTranslation(["collections"]);
	const client = useQueryClient();
	const [historyOpen, setHistoryOpen] = useState(false);
	const state = useGetApiFavoritesByTargetUnitId({ path: { targetUnitId } });
	const save = usePutApiFavoritesByTargetUnitId();
	const remove = useDeleteApiFavoritesByTargetUnitId();
	async function toggle() {
		if (!state.data) return;
		try {
			const input = { path: { targetUnitId }, body: { expectedRevision: state.data.revision } };
			if (state.data.entry) await remove.mutateAsync(input);
			else await save.mutateAsync(input);
			await invalidateFavorites(client);
		} catch {
			await state.refetch();
		}
	}
	if (state.isError) return <QueryFailure error={state.error} retry={() => void state.refetch()} />;
	return (
		<div className="grid gap-2">
			<Button
				aria-pressed={Boolean(state.data?.entry)}
				disabled={!state.data}
				isLoading={save.isPending || remove.isPending || state.isPending}
				onClick={() => void toggle()}
				variant={state.data?.entry ? "secondary" : "outline"}
			>
				{state.data?.entry ? <CheckIcon aria-hidden /> : <BookmarkIcon aria-hidden />}
				{state.data?.entry
					? t.collections.privateFavorites.remove
					: t.collections.privateFavorites.save}
			</Button>
			<RequestFailure error={save.error ?? remove.error} />
			<Button
				variant="quiet"
				aria-expanded={historyOpen}
				onClick={() => setHistoryOpen((open) => !open)}
			>
				{t.collections.privateFavorites.history}
			</Button>
			{historyOpen && state.data ? (
				<FavoriteHistory targetUnitId={targetUnitId} revision={state.data.revision} />
			) : null}
		</div>
	);
}
