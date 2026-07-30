import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { UnitDetailWorkspace } from "@/features/units/components/unit-detail-workspace";
import { isUnitDetailUnitType } from "@/features/units/model/unit-detail-section";
import { isUnitId } from "@/features/units/model/unit-id";
import { isUnitType } from "@/features/units/unit-types";

export default async function Layout({
	children,
	params,
}: {
	children: ReactNode;
	params: Promise<{ type: string; unit: string }>;
}) {
	const { type, unit } = await params;
	if (!isUnitType(type) || !isUnitId(unit)) notFound();
	return isUnitDetailUnitType(type) ? (
		<UnitDetailWorkspace type={type} unitId={unit}>
			{children}
		</UnitDetailWorkspace>
	) : (
		children
	);
}
