"use client";
import { EntityExternalLinks } from "./entity-external-links";
import { EntityRelatedFeed } from "./entity-related-feed";
import { EntityProfile } from "./entity-profile";
import { UnitTagSummary } from "@/features/tags/components/unit-tag-summary";
import { UnitReportOverflowMenu } from "@/features/reports/components/unit-report-dialog";
export function EntityResourceDetails({ id }: { id: string }) {
	return (
		<>
			<EntityProfile id={id} />
			<UnitReportOverflowMenu unitId={id} />
			<UnitTagSummary type="entity" unitId={id} />
			<EntityExternalLinks entityId={id} />
			<EntityRelatedFeed entityId={id} />
		</>
	);
}
