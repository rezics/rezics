"use client";

import { ManagementWorkspaceSectionHeader } from "@rezics/ui";
import Link from "next/link";

import { UnitDockManager } from "@/features/docks";
import { useTranslation } from "@/i18n/client";
import { zoneManagementHref } from "./model";
import { useZoneManagement } from "./workspace";

export function ZoneLayoutManagement() {
	const { zoneId } = useZoneManagement();
	const { t } = useTranslation(["zones"]);
	return (
		<section>
			<ManagementWorkspaceSectionHeader
				backHref={zoneManagementHref(zoneId)}
				backLabel={t.zones.management.title}
				description={t.zones.management.sections.layout.description}
				link={Link}
				title={t.zones.management.sections.layout.label}
			/>
			<UnitDockManager
				ownerUnitId={zoneId}
				target={{ ownerKind: "zone", dockKind: "main" }}
			/>
		</section>
	);
}
