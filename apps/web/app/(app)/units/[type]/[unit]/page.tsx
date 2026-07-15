import { notFound } from "next/navigation";
import { UnitDetail } from "@/features/units/unit-detail";
import { isUnitType } from "@/features/units/unit-types";

export default async function Page({
	params,
}: {
	params: Promise<{ type: string; unit: string }>;
}) {
	const { type, unit } = await params;
	if (!isUnitType(type)) notFound();
	return <UnitDetail type={type} unit={unit} />;
}
