import { AppLink as Link } from "@/features/application-shell/components/app-link";
import type { PresentedAvatar } from "@rezics/avatar";
import type { PublicSlugAddressValue } from "@rezics/slug";

import { IdentityAvatar } from "@rezics/ui";
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
		readonly summary?: string | null;
		readonly avatar?: PresentedAvatar | null;
	};
};

/**
 * Resolves the immutable Unit identities credited as publishers on a Post.
 *
 * @internal
 */
export function getPublisherUnitIds(
	attributions: readonly AttributionSummary[],
): ReadonlySet<string> {
	const publisherUnitIds = new Set<string>();
	for (const attribution of attributions) {
		if (attribution.role === "publisher") publisherUnitIds.add(attribution.creditedUnit.id);
	}
	return publisherUnitIds;
}

export function AttributionLinks({
	attributions,
	emptyLabel,
	className,
	publisherLabel,
	resolveRoleLabel,
}: {
	readonly attributions: readonly AttributionSummary[];
	readonly emptyLabel: string;
	readonly className?: string;
	readonly publisherLabel?: string;
	readonly resolveRoleLabel?: (attribution: AttributionSummary) => string | null;
}) {
	const { t } = useTranslation(["units"]);
	if (!attributions.length) return <span className={className}>{emptyLabel}</span>;
	return attributions.map((attribution, index) => {
		const href = publicUnitHref(attribution.creditedUnit.kind, attribution.creditedUnit);
		const label = attribution.creditedUnit.title ?? emptyLabel;
		const roleLabel =
			resolveRoleLabel === undefined
				? attribution.role === "publisher" && publisherLabel
					? publisherLabel
					: isKnownAttributionRole(attribution.role)
						? t.units.attributionRoles[attribution.role]
						: attribution.role
				: resolveRoleLabel(attribution);
		const content = (
			<>
				{label}
				{roleLabel === null ? null : (
					<>
						{" "}
						<span className="text-muted-foreground">({roleLabel})</span>
					</>
				)}
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

/**
 * Renders reply credits while labeling only identities credited as publishers on the
 * displayed Post.
 *
 * @internal
 */
export function ReplyAttributionLinks({
	attributions,
	emptyLabel,
	postPublisherUnitIds,
	publisherLabel,
	className,
}: {
	readonly attributions: readonly AttributionSummary[];
	readonly emptyLabel: string;
	readonly postPublisherUnitIds: ReadonlySet<string>;
	readonly publisherLabel: string;
	readonly className?: string;
}) {
	return (
		<AttributionLinks
			attributions={attributions}
			className={className}
			emptyLabel={emptyLabel}
			resolveRoleLabel={(attribution) =>
				postPublisherUnitIds.has(attribution.creditedUnit.id) ? publisherLabel : null
			}
		/>
	);
}

export function PublisherAttributionLinks({
	attributions,
	emptyLabel,
	publisherLabel,
}: {
	readonly attributions: readonly AttributionSummary[];
	readonly emptyLabel: string;
	readonly publisherLabel: string;
}) {
	const publishers = attributions.filter(
		(attribution): attribution is AttributionSummary & { readonly role: "publisher" } =>
			attribution.role === "publisher",
	);
	if (!publishers.length) return <span className="text-sm">{emptyLabel}</span>;

	return (
		<div
			aria-label={publisherLabel}
			className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5"
			role="list"
		>
			{publishers.map((attribution) => {
				const creditedUnit = attribution.creditedUnit;
				const label = creditedUnit.title ?? emptyLabel;
				const href = publicUnitHref(creditedUnit.kind, creditedUnit);
				const initials = Array.from(label.trim())[0]?.toLocaleUpperCase() ?? label;
				const content = (
					<>
						<IdentityAvatar
							avatar={creditedUnit.avatar}
							fallback={initials}
							size="sm"
						/>
						<span className="max-w-48 truncate font-semibold text-sm">{label}</span>
					</>
				);
				return (
					<span
						className="flex min-w-0 items-center gap-1.5"
						key={attribution.id}
						role="listitem"
					>
						{href ? (
							<Link
								className="flex min-w-0 items-center gap-1.5 hover:text-link-hover hover:underline"
								href={href}
							>
								{content}
							</Link>
						) : (
							content
						)}
						<span className="text-muted-foreground text-xs">{publisherLabel}</span>
					</span>
				);
			})}
		</div>
	);
}

export function firstAttribution(attributions: readonly AttributionSummary[]) {
	return attributions[0];
}
