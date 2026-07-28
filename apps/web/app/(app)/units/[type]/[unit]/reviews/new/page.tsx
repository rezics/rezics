import { notFound } from "next/navigation";

import { TargetedReviewCreatePage } from "@/features/reviews/pages/targeted-review-create-page";
import { isCatalogDetailUnitType } from "@/features/units/model/catalog-detail-section";
import { isUnitId } from "@/features/units/model/unit-id";

export default async function Page({
	params,
	searchParams,
}: {
	params: Promise<{ type: string; unit: string }>;
	searchParams: Promise<{ progressEntryId?: string }>;
}) {
	const { type, unit } = await params;
	const { progressEntryId } = await searchParams;
	if (!isCatalogDetailUnitType(type) || !isUnitId(unit)) notFound();
	if (progressEntryId !== undefined && !isUnitId(progressEntryId)) notFound();
	return (
		<TargetedReviewCreatePage progressEntryId={progressEntryId} targetId={unit} type={type} />
	);
}
