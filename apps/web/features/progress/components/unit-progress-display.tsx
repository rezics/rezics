"use client";

import { FieldLabel, Progress, ProgressValue } from "@rezics/ui";

export function UnitProgressDisplay({
	label,
	percentage,
}: {
	readonly label: string;
	readonly percentage: number;
}) {
	return (
		<Progress max={100} value={percentage}>
			<FieldLabel>{label}</FieldLabel>
			<ProgressValue />
		</Progress>
	);
}
