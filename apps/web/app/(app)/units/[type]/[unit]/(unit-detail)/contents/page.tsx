import { notFound } from "next/navigation";

import { isUnitId } from "@/features/units/model/unit-id";
import { UnitContentsPage } from "@/features/units/pages/unit-contents-page";

export default async function Page({
	params,
}: {
	params: Promise<{ type: string; unit: string }>;
}) {
	const { type, unit } = await params;
	if ((type !== "book" && type !== "media") || !isUnitId(unit)) notFound();
	return <UnitContentsPage />;
}
