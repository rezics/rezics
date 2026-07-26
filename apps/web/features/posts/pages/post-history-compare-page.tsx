"use client";

import { UnitRevisionCompare } from "@/features/history/components/unit-revision-compare";
import { useTranslation } from "@/i18n/client";
import { PostManagementSectionHeader } from "../components/post-management-section-header";
import { usePostManagement } from "../components/post-management-workspace";

export function PostHistoryComparePage({ from, to }: { from: string | null; to: string | null }) {
	const { t } = useTranslation(["errors", "history"]);
	const { resource } = usePostManagement();
	return (
		<section>
			<PostManagementSectionHeader title={t.history.compareTitle} />
			{from && to ? (
				<UnitRevisionCompare from={from} to={to} unitId={resource.item.id} />
			) : (
				<p className="text-sm text-destructive">{t.errors.invalid}</p>
			)}
		</section>
	);
}
