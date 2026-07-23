import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { CatalogDetailWorkspace } from "@/features/units/components/catalog-detail-workspace";
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
		<CatalogDetailWorkspace type={type} unitId={unit}>
			{children}
		</CatalogDetailWorkspace>
	);
}
