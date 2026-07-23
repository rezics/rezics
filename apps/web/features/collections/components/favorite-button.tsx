"use client";

import {
	getApiCollectionsFavoritesQueryKey,
	useDeleteApiCollectionsFavoritesItemsByTargetId,
	useGetApiCollectionsFavorites,
	usePutApiCollectionsFavoritesItemsByTargetId,
} from "@rezics/openapi-tanstack-query";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@rezics/ui";
import { SignInButton } from "@/features/auth/auth-portal";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { useHydratedSession } from "@/lib/use-hydrated-session";

export function FavoriteButton({ targetId }: { targetId: string }) {
	const { data: session } = useHydratedSession();
	const favorites = useGetApiCollectionsFavorites({
		query: { enabled: Boolean(session) },
	});
	const add = usePutApiCollectionsFavoritesItemsByTargetId();
	const remove = useDeleteApiCollectionsFavoritesItemsByTargetId();
	const queryClient = useQueryClient();
	const { t } = useTranslation(["actions", "engagement", "ui"]);
	if (!session)
		return (
			<SignInButton size="sm" variant="outline">
				{t.actions.login}
			</SignInButton>
		);
	const favorited = favorites.data?.items.some((item) => item.targetId === targetId) ?? false;
	const mutation = favorited ? remove : add;

	async function toggle() {
		try {
			if (favorited) await remove.mutateAsync({ path: { targetId } });
			else await add.mutateAsync({ path: { targetId } });
			await queryClient.invalidateQueries({
				queryKey: getApiCollectionsFavoritesQueryKey(),
			});
		} catch {
			// The server query remains the only source of truth.
		}
	}

	return (
		<div className="grid justify-items-end gap-1">
			<Button
				aria-pressed={favorited}
				disabled={favorites.isError}
				isLoading={favorites.isPending || mutation.isPending}
				onClick={() => void toggle()}
				size="sm"
				variant={favorited ? "secondary" : "outline"}
			>
				{favorited ? t.engagement.unfavorite : t.engagement.favorite}
			</Button>
			<RequestFailure error={favorites.error ?? mutation.error} fallback={t.ui.retryLater} />
		</div>
	);
}
