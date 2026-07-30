import { notFound } from "next/navigation";
import { UnitCreatePage } from "@/features/units/unit-pages";
import { isCatalogUnitType } from "@/features/units/unit-types";
export default async function Page({ params }: { params: Promise<{ type: string }> }) {
	const { type } = await params;
	if (!isCatalogUnitType(type)) notFound();
	return <UnitCreatePage type={type} />;
}
