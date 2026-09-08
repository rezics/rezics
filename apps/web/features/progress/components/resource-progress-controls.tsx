"use client";
import type { UnitReference } from "@rezics/reference";
import { Button } from "@rezics/ui";
import { AppLink } from "@/features/application-shell/components/app-link";
import { useTranslation } from "@/i18n/client";
import { isProgressTrackableUnitType } from "../model/progress-record";
import { unitProgressHref } from "../routing/progress-routes";
import { UnitProgressProvider } from "./unit-progress-provider";
import { UnitProgressAction } from "./unit-progress-action";
import { UnitProgressDialog } from "./unit-progress-dialog";
import { UnitProgressSummaryCard } from "./unit-progress-summary-card";
export function ResourceProgressControls({
	reference,
	shape,
}: {
	reference: UnitReference;
	shape: string;
}) {
	const { t } = useTranslation(["engagement"]);
	if (!isProgressTrackableUnitType(reference.owner)) return null;
	return (
		<UnitProgressProvider domain={{ type: reference.owner, unitId: reference.id, shape }}>
			<section className="grid gap-3">
				<UnitProgressAction metadataOnly={false} />
				<Button asChild variant="outline">
					<AppLink href={unitProgressHref(reference.owner, reference.id)}>
						{t.engagement.viewProgressHistory}
					</AppLink>
				</Button>
				<UnitProgressSummaryCard />
				<UnitProgressDialog />
			</section>
		</UnitProgressProvider>
	);
}
