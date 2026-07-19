import { notFound } from "next/navigation";
import { UnitGovernancePage } from "@/features/governance/unit-workflows";
import { isUnitType } from "@/features/units/unit-types";

export default async function Page({
	params,
}: {
	params: Promise<{ type: string; unit: string }>;
}) {
	const { type, unit } = await params;
	if (!isUnitType(type)) notFound();
	return <UnitGovernancePage id={unit} type={type} />;
}
