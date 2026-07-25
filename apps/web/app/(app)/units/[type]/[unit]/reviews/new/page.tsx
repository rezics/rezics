import { notFound } from "next/navigation";

import { TargetedReviewCreatePage } from "@/features/reviews/pages/targeted-review-create-page";
import { isCatalogDetailUnitType } from "@/features/units/model/catalog-detail-section";
import { isUnitId } from "@/features/units/model/unit-id";

export default async function Page({
	params,
}: {
	params: Promise<{ type: string; unit: string }>;
}) {
	const { type, unit } = await params;
	if (!isCatalogDetailUnitType(type) || !isUnitId(unit)) notFound();
	return <TargetedReviewCreatePage targetId={unit} type={type} />;
}
