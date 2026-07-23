import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { UnitManagementWorkspace } from "@/features/units/components/unit-management-workspace";
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
	return (
		<UnitManagementWorkspace type={type} unitId={unit}>
			{children}
		</UnitManagementWorkspace>
	);
}
