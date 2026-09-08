import { notFound } from "next/navigation";

import { isUnitType } from "@/features/units/unit-types";
import { isUnitId } from "@/features/units/model/unit-id";
import { UnitQuestionsPage } from "@/features/units/pages/unit-questions-page";

export default async function Page({
	params,
}: {
	params: Promise<{ type: string; unit: string }>;
}) {
	const { type, unit } = await params;
	if (!isUnitType(type) || !isUnitId(unit)) notFound();
	return <UnitQuestionsPage type={type} unitId={unit} />;
}
