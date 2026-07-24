"use client";

import { useTranslation } from "@/i18n/client";
import type { UnitProgressDomain } from "../model/progress-record";

export function UnitProgressStatistics({
	active,
	backlog,
	type,
}: {
	readonly active: number;
	readonly backlog: number;
	readonly type: UnitProgressDomain["type"];
}) {
	const { locale, t } = useTranslation(["engagement"]);
	const statistics = t.engagement.progressByType[type].statistics;
	const numberFormat = new Intl.NumberFormat(locale.target);

	return (
		<div className="flex flex-wrap gap-x-5 gap-y-2 border-t border-border-weak pt-4 text-sm text-muted-foreground">
			<p className="tabular-nums">
				{active === 1
					? statistics.activeOne
					: statistics.active({ count: numberFormat.format(active) })}
			</p>
			<p className="tabular-nums">
				{backlog === 1
					? statistics.backlogOne
					: statistics.backlog({ count: numberFormat.format(backlog) })}
			</p>
		</div>
	);
}
