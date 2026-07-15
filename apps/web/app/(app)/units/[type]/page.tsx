import { notFound } from "next/navigation";
import { UnitBrowsePage } from "@/features/units/unit-pages";
import { isUnitType } from "@/features/units/unit-types";

export default async function Page({ params }: { params: Promise<{ type: string }> }) {
	const { type } = await params;
	if (!isUnitType(type)) notFound();
	return <UnitBrowsePage type={type} />;
}
