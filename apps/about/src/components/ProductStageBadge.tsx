import { Badge, type BadgeVariant } from "@rezics/ui";

import type { ProductStageId } from "../content/productTypes";

const StageBadgeVariants = {
	available: "success",
	development: "warning",
	planned: "secondary",
} as const satisfies Record<ProductStageId, BadgeVariant>;

export function ProductStageBadge({
	label,
	stage,
}: {
	readonly label: string;
	readonly stage: ProductStageId;
}) {
	return (
		<Badge data-stage={stage} variant={StageBadgeVariants[stage]}>
			{label}
		</Badge>
	);
}
