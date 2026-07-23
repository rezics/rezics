import { notFound } from "next/navigation";

import { isUnitId } from "@/features/units/model/unit-id";
import { SoftwareRequirementsPage } from "@/features/units/pages/software-requirements-page";

export default async function Page({
	params,
}: {
	params: Promise<{ type: string; unit: string }>;
}) {
	const { type, unit } = await params;
	if (type !== "software" || !isUnitId(unit)) notFound();
	return <SoftwareRequirementsPage />;
}
