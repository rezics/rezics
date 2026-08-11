"use client";

import { getApiReviewsQueryKey } from "@rezics/openapi-tanstack-query";
import { useQueryClient } from "@tanstack/react-query";

import { FeedQueryKey } from "@/features/content-feed/query";
import { UnitRevisionHistory } from "@/features/history/components/unit-revision-history";
import { useTranslation } from "@/i18n/client";
import { PostManagementSectionHeader } from "../components/post-management-section-header";
import { usePostManagement } from "../components/post-management-workspace";
import { invalidatePostQueries } from "../query";
import { postManagementSectionHref } from "../routing/post-management-routes";

export function PostHistoryPage() {
	const { t } = useTranslation(["history"]);
	const queryClient = useQueryClient();
	const { resource } = usePostManagement();
	const historyHref = postManagementSectionHref(resource.item.id, "history");
	const invalidateManagedPost = () =>
		resource.item.postKind === "review"
			? Promise.all([
					queryClient.invalidateQueries({ queryKey: FeedQueryKey }),
					queryClient.invalidateQueries({ queryKey: getApiReviewsQueryKey() }),
					invalidatePostQueries(queryClient, resource.item.id),
				])
			: invalidatePostQueries(
					queryClient,
					resource.item.rootPostId ?? resource.item.id,
					resource.item.id,
				);
	return (
		<section>
			<PostManagementSectionHeader description={t.history.description} title={t.history.title} />
			<UnitRevisionHistory
				compareHref={(from, to) =>
					`${historyHref}/compare?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
				}
				onChanged={invalidateManagedPost}
				unitId={resource.item.id}
			/>
		</section>
	);
}
