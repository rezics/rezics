import { notFound } from "next/navigation";
import { UnitEditWorkspace } from "@/features/units/unit-edit";
import { isUnitType } from "@/features/units/unit-types";
export default async function Page({
	params,
}: {
	params: Promise<{ type: string; unit: string }>;
}) {
	const value = await params;
	if (!isUnitType(value.type)) notFound();
	return <UnitEditWorkspace type={value.type} id={value.unit} />;
}
