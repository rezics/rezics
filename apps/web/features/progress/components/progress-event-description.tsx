"use client";

import type { CatalogDetailUnitType } from "@/features/units/model/catalog-detail-section";
import { useTranslation } from "@/i18n/client";
import {
	formatProgressEntryDate,
	type ProgressDatePrecision,
	type ProgressEntryKind,
} from "../model/progress-entry";

export interface ProgressEventLike {
	readonly datePrecision: ProgressDatePrecision;
	readonly entryKind: ProgressEntryKind;
	readonly occurredAt: string | null;
	readonly progress: number;
}

export function ProgressEventDescription({
	entry,
	type,
}: {
	readonly entry: ProgressEventLike;
	readonly type: CatalogDetailUnitType;
}) {
	const { locale, t } = useTranslation(["engagement"]);
	const date = formatProgressEntryDate(
		entry.occurredAt,
		entry.datePrecision,
		locale.current,
		t.engagement.progressJournal.unknownDate,
	);
	const copy = t.engagement.progressByType[type].history;
	return (
		<>
			{entry.entryKind === "completion"
				? copy.completion({ date })
				: copy.update({
						date,
						percent: Math.round(entry.progress * 100),
					})}
		</>
	);
}
