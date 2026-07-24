"use client";

import { toContentLanguage } from "@rezics/i18n";
import {
	Button,
	Cover,
	PortableTextContent,
	ShowMoreContent,
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@rezics/ui";
import { BookOpen, Gamepad2, Pencil, PlaySquare } from "lucide-react";
import Link from "next/link";

import { CollectionPickerButton } from "@/features/collections/components/collection-picker-button";
import { FollowButton } from "@/features/following/components/follow-button";
import { UnitProgressAction } from "@/features/progress/components/unit-progress-action";
import { UnitProgressStatistics } from "@/features/progress/components/unit-progress-statistics";
import { UnitScoreControl } from "@/features/reviews/components/unit-score-control";
import { useTranslation } from "@/i18n/client";
import { toNonNegativeApiInteger } from "@/lib/api-number";
import { readPortableText } from "@/lib/block";
import { selectLocalization } from "@/lib/localization";
import type { CatalogDetailUnitType } from "../model/catalog-detail-section";
import type { CatalogDetailUnitFor } from "../model/catalog-detail-unit";
import { CatalogShareAction } from "./catalog-share-action";

const CatalogIcons = {
	book: BookOpen,
	media: PlaySquare,
	software: Gamepad2,
} as const;

export function CatalogDetailHero<Type extends CatalogDetailUnitType>({
	type,
	unit,
}: {
	readonly type: Type;
	readonly unit: CatalogDetailUnitFor<Type>;
}) {
	const { locale, t } = useTranslation(["ui"]);
	const localization = selectLocalization(
		unit.localizations,
		toContentLanguage(locale.target),
		unit.language,
	);

	return (
		<section className="grid items-start gap-6 lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-10">
			<div className="mx-auto grid w-full max-w-52 content-start gap-4 lg:mx-0">
				<Cover
					alt={localization?.title ?? t.ui.unnamed}
					className="rounded-xl border border-border-weak shadow-md/10"
					fallback={<CatalogIcon type={type} />}
					priority
					sizes="(min-width: 1024px) 13rem, 13rem"
					src={unit.cover?.url}
				/>
				<UnitProgressAction buttonClassName="min-h-10" className="w-full" />
				<CollectionPickerButton
					targetId={unit.id}
					triggerClassName="min-h-10 w-full"
					triggerVariant="outline"
				/>
				<UnitScoreControl targetId={unit.id} type={type} />
			</div>

			<div className="grid min-w-0 content-start gap-4">
				<div className="flex flex-wrap items-start justify-between gap-4">
					<h1 className="min-w-0 flex-1 font-heading text-3xl font-black leading-tight tracking-tight sm:text-4xl">
						{localization?.title ?? t.ui.unnamed}
					</h1>
					<div className="flex shrink-0 items-center justify-end gap-1">
						<FollowButton size="sm" unitId={unit.id} variant="quiet" />
						{unit.capabilities.canEdit ? (
							<Tooltip>
								<TooltipTrigger asChild>
									<Button
										aria-label={t.ui.edit}
										asChild
										size="icon-md"
										variant="quiet"
									>
										<Link href={`/units/${type}/${unit.id}/edit`}>
											<Pencil aria-hidden />
										</Link>
									</Button>
								</TooltipTrigger>
								<TooltipContent>{t.ui.edit}</TooltipContent>
							</Tooltip>
						) : null}
						<CatalogShareAction unitId={unit.id} />
					</div>
				</div>

				{localization?.summary ? (
					<p className="max-w-3xl text-base font-medium leading-7 text-foreground/88">
						{localization.summary}
					</p>
				) : null}

				{localization?.description ? (
					<ShowMoreContent showLessLabel={t.ui.showLess} showMoreLabel={t.ui.showMore}>
						<PortableTextContent
							className="text-base prose-p:my-4 prose-p:leading-7 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0"
							value={readPortableText(localization.description)}
							variant="article"
						/>
					</ShowMoreContent>
				) : null}

				<UnitProgressStatistics
					active={toNonNegativeApiInteger(unit.progressStatistics.active)}
					backlog={toNonNegativeApiInteger(unit.progressStatistics.backlog)}
					type={type}
				/>
			</div>
		</section>
	);
}

function CatalogIcon({ type }: { readonly type: CatalogDetailUnitType }) {
	const Icon =
		type === "book"
			? CatalogIcons.book
			: type === "media"
				? CatalogIcons.media
				: CatalogIcons.software;
	return <Icon aria-hidden className="size-9" />;
}
