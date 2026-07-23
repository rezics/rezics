import { notFound } from "next/navigation";

import { isUnitId } from "@/features/units/model/unit-id";
import { CatalogVariantsPage } from "@/features/units/pages/catalog-variants-page";

export default async function Page({
	params,
}: {
	params: Promise<{ type: string; unit: string }>;
}) {
	const { type, unit } = await params;
	if (type !== "book" || !isUnitId(unit)) notFound();
	return <CatalogVariantsPage />;
}
