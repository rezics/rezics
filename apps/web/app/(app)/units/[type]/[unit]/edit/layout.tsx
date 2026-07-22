import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { UnitManagementWorkspace } from "@/features/units/components/unit-management-workspace";
import { isUnitType } from "@/features/units/unit-types";

export default async function Layout({
	children,
	params,
}: {
	children: ReactNode;
	params: Promise<{ type: string; unit: string }>;
}) {
	const { type, unit } = await params;
	if (!isUnitType(type)) notFound();
	return (
		<UnitManagementWorkspace type={type} unitId={unit}>
			{children}
		</UnitManagementWorkspace>
	);
}
