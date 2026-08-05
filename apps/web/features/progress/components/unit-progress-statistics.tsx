"use client";

import { useTranslation } from "@/i18n/client";
import { toNonNegativeApiInteger } from "@/lib/api-number";
import type { UnitProgressDomain } from "../model/progress-record";

type CountResult = {
	readonly kind: "exact" | "estimate" | "lower-bound";
	readonly value: string | number;
};

export function UnitProgressStatistics({
	active,
	backlog,
	type,
}: {
	readonly active: CountResult;
	readonly backlog: CountResult;
	readonly type: UnitProgressDomain["type"];
}) {
	const { locale, t } = useTranslation(["engagement"]);
	const statistics = t.engagement.progressByType[type].statistics;
	const numberFormat = new Intl.NumberFormat(locale.target);
	const activeValue = toNonNegativeApiInteger(active.value);
	const backlogValue = toNonNegativeApiInteger(backlog.value);
	const format = (count: CountResult, value: number) =>
		`${count.kind === "exact" ? "" : "≥"}${numberFormat.format(value)}`;

	return (
		<div className="flex flex-wrap gap-x-5 gap-y-2 border-t border-border-weak pt-4 text-sm text-muted-foreground">
			<p className="tabular-nums">
				{active.kind === "exact" && activeValue === 1
					? statistics.activeOne
					: statistics.active({ count: format(active, activeValue) })}
			</p>
			<p className="tabular-nums">
				{backlog.kind === "exact" && backlogValue === 1
					? statistics.backlogOne
					: statistics.backlog({ count: format(backlog, backlogValue) })}
			</p>
		</div>
	);
}
