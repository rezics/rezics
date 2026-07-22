import Link from "next/link";
import type { PublicSlugAddressValue } from "@rezics/slug";

import { isKnownAttributionRole } from "@/features/units/attribution-role";
import { publicUnitHref } from "@/features/units/routing/public-unit-route";
import { useTranslation } from "@/i18n/client";

export type AttributionSummary = {
	readonly id: string;
	readonly role: string;
	readonly creditedUnit: {
		readonly id: string;
		readonly kind: string;
		readonly slugAddress?: PublicSlugAddressValue | null;
		readonly title: string | null;
	};
};

export function AttributionLinks({
	attributions,
	emptyLabel,
	className,
}: {
	readonly attributions: readonly AttributionSummary[];
	readonly emptyLabel: string;
	readonly className?: string;
}) {
	const { t } = useTranslation(["units"]);
	if (!attributions.length) return <span className={className}>{emptyLabel}</span>;
	return attributions.map((attribution, index) => {
		const href = publicUnitHref(attribution.creditedUnit.kind, attribution.creditedUnit);
		const label = attribution.creditedUnit.title ?? emptyLabel;
		const content = (
			<>
				{label}{" "}
				<span className="text-muted-foreground">
					(
					{isKnownAttributionRole(attribution.role)
						? t.units.attributionRoles[attribution.role]
						: attribution.role}
					)
				</span>
			</>
		);
		return (
			<span key={attribution.id}>
				{index > 0 ? ", " : null}
				{href ? (
					<Link className={className} href={href}>
						{content}
					</Link>
				) : (
					<span className={className}>{content}</span>
				)}
			</span>
		);
	});
}

export function firstAttribution(attributions: readonly AttributionSummary[]) {
	return attributions[0];
}
