import { notFound } from "next/navigation";
import { UnitCreatePage } from "@/features/units/unit-pages";
import { isWorkUnitType } from "@/features/units/unit-types";
export default async function Page({ params }: { params: Promise<{ type: string }> }) {
	const { type } = await params;
	if (!isWorkUnitType(type)) notFound();
	return <UnitCreatePage type={type} />;
}
