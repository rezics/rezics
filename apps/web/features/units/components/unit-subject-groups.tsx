"use client";

import type {
	GetApiUnitsByTypeByUnitIdStatus200,
	GetApiUnitsByTypeByUnitIdSubjectAssociationsStatus200,
} from "@rezics/openapi-tanstack-query";
import { Button, CardContent, Cover, ShowMoreContent } from "@rezics/ui";
import { useState } from "react";

import { AppLink as Link } from "@/features/application-shell/components/app-link";
import { useChineseContentText } from "@/features/content-language-display/chinese-content-display-context";
import { LocalizedPortableTextContent } from "@/features/content-language-display/localized-portable-text-content";
import { FeedCard } from "@/features/content-feed/components/feed-card";
import { TagExpressionPreview } from "@/features/tags/components/tag-expression-preview";
import { TagReferenceBadge } from "@/features/tags/components/tag-reference-badge";
import { useTranslation } from "@/i18n/client";
import { toFiniteApiNumber } from "@/lib/api-number";
import { readPortableText } from "@/lib/block";
import { groupByAssociationRole } from "../attribution-role";
import { publicUnitHref } from "../routing/public-unit-route";
import { CompactCreditAttributionGroups } from "./unit-attribution-sections";

type PreviewSubjectAssociation = GetApiUnitsByTypeByUnitIdStatus200["subjectAssociations"][number];
type CompleteSubjectAssociation =
	GetApiUnitsByTypeByUnitIdSubjectAssociationsStatus200["items"][number];
type SubjectAssociation = PreviewSubjectAssociation | CompleteSubjectAssociation;
type CompleteMeasurement = NonNullable<CompleteSubjectAssociation["measurement"]>;

function isCompleteAssociation(
	association: SubjectAssociation,
): association is CompleteSubjectAssociation {
	return "description" in association;
}

export function UnitSubjectGroups({
	associations,
}: {
	readonly associations: readonly SubjectAssociation[];
}) {
	const { t } = useTranslation(["tags", "ui", "units"]);
	return (
		<div className="grid gap-4">
			{groupByAssociationRole(associations).map((group) => (
				<section className="grid gap-3" key={group.role}>
					<h3 className="text-sm font-semibold">{t.units.subjectAssociationRoles[group.role]}</h3>
					<ul className="grid gap-3">
						{group.items.map((association) => (
							<li key={association.id}>
								<SubjectAssociationCard association={association} />
							</li>
						))}
					</ul>
				</section>
			))}
		</div>
	);
}

function SubjectAssociationCard({ association }: { readonly association: SubjectAssociation }) {
	const { t } = useTranslation(["editor", "tags", "ui", "units"]);
	const [revealed, setRevealed] = useState(false);
	const title = useChineseContentText(
		association.title ?? t.ui.unnamed,
		association.title ? association.language : null,
	);
	const summary = useChineseContentText(association.summary ?? "", association.language);
	const href = publicUnitHref("entity", { id: association.entityEntryId });
	const headingId = `subject-association-${association.id}`;
	const complete = isCompleteAssociation(association);
	if (association.spoiler.concealed && !revealed)
		return (
			<FeedCard>
				<CardContent className="flex min-h-28 items-center justify-center p-5">
					<Button onClick={() => setRevealed(true)} type="button" variant="outline">
						{t.editor.showSpoiler}
					</Button>
				</CardContent>
			</FeedCard>
		);

	return (
		<FeedCard aria-labelledby={headingId}>
			<CardContent className="grid grid-cols-[5rem_minmax(0,1fr)] gap-4 px-4 py-5 sm:grid-cols-[7.5rem_minmax(0,1fr)] sm:px-5">
				<Link className="block self-start" href={href}>
					<Cover
						alt={title}
						className="w-full rounded-xl border border-border-weak shadow-sm/5"
						sizes="(min-width: 640px) 120px, 80px"
						src={association.cover?.url}
					/>
				</Link>
				<div className="min-w-0 self-start">
					<h4 className="font-heading font-black text-[1.05rem] leading-snug" id={headingId}>
						<Link className="text-link hover:text-link-hover hover:underline" href={href}>
							{title}
						</Link>
					</h4>
					{summary ? (
						<p className="mt-2 text-muted-foreground text-sm leading-6">{summary}</p>
					) : null}
					{complete && association.description ? (
						<div className="mt-3">
							<ShowMoreContent showLessLabel={t.ui.showLess} showMoreLabel={t.ui.showMore}>
								<LocalizedPortableTextContent
									className="text-sm prose-p:my-3 prose-p:leading-6 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0"
									language={association.language}
									value={readPortableText(association.description)}
									variant="article"
								/>
							</ShowMoreContent>
						</div>
					) : null}
					{complete && association.measurement ? (
						<AssociationMeasurementDetails measurement={association.measurement} />
					) : null}
					{complete && association.attributions.length ? (
						<div className="mt-4 border-border-weak border-t pt-4">
							<CompactCreditAttributionGroups attributions={association.attributions} />
						</div>
					) : null}
					<TagExpressionPreview compact={!complete} expressions={association.expressions} />
					{complete && !association.expressionsComplete ? (
						<p className="mt-2 text-muted-foreground text-xs">{t.tags.expressions.partial}</p>
					) : null}
					{association.contextPost ? (
						<div className="mt-3 grid gap-2">
							<Link
								className="w-fit text-muted-foreground text-xs hover:text-link hover:underline"
								href={`/posts/${association.contextPost.id}`}
							>
								{association.contextPost.title ?? t.units.editor.contextWikiPost}
							</Link>
							{association.contextPost.tags.length ? (
								<div className="flex flex-wrap gap-2">
									{association.contextPost.tags.map((tag) => (
										<TagReferenceBadge
											key={tag.tagId}
											pinned={tag.pinned}
											score={tag.score}
											tagId={tag.tagId}
											title={tag.title}
										/>
									))}
								</div>
							) : null}
						</div>
					) : null}
				</div>
			</CardContent>
		</FeedCard>
	);
}

function AssociationMeasurementDetails({
	measurement,
}: {
	readonly measurement: CompleteMeasurement;
}) {
	const { locale, t } = useTranslation(["entities"]);
	const numberFormat = new Intl.NumberFormat(locale.target, { maximumFractionDigits: 1 });
	const present = (
		label: string,
		value: string | number | null | undefined,
		divisor: number,
		unit: string,
	) => {
		const numericValue = toFiniteApiNumber(value);
		return numericValue === undefined
			? null
			: { label, value: `${numberFormat.format(numericValue / divisor)} ${unit}` };
	};
	const values = [
		present(t.entities.height, measurement.heightMillimetres, 10, t.entities.centimetreUnit),
		present(t.entities.weight, measurement.weightGrams, 1_000, t.entities.kilogramUnit),
		present(t.entities.bust, measurement.bustMillimetres, 10, t.entities.centimetreUnit),
		present(t.entities.waist, measurement.waistMillimetres, 10, t.entities.centimetreUnit),
		present(t.entities.hips, measurement.hipsMillimetres, 10, t.entities.centimetreUnit),
	].filter((value): value is { readonly label: string; readonly value: string } => value !== null);
	if (!values.length) return null;
	return (
		<section className="mt-4 grid gap-2 border-border-weak border-t pt-4">
			<h5 className="text-sm font-semibold">{t.entities.measurements}</h5>
			<dl className="grid gap-x-8 gap-y-2 sm:grid-cols-2">
				{values.map((value) => (
					<div className="flex items-baseline justify-between gap-4" key={value.label}>
						<dt className="text-xs text-muted-foreground">{value.label}</dt>
						<dd className="font-medium text-sm tabular-nums">{value.value}</dd>
					</div>
				))}
			</dl>
		</section>
	);
}
