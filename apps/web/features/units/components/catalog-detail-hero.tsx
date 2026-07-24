"use client";

import { toContentLanguage } from "@rezics/i18n";
import { Button, Cover, PortableTextContent, ShowMoreContent } from "@rezics/ui";
import { BookOpen, Gamepad2, PlaySquare } from "lucide-react";
import Link from "next/link";

import { CollectionPickerButton } from "@/features/collections/components/collection-picker-button";
import { FavoriteButton } from "@/features/collections/components/favorite-button";
import { UnitProgressAction } from "@/features/progress/components/unit-progress-action";
import { UnitProgressHeroSummary } from "@/features/progress/components/unit-progress-hero-summary";
import { UnitScoreControl } from "@/features/reviews/components/unit-score-control";
import { useTranslation } from "@/i18n/client";
import { readPortableText } from "@/lib/block";
import { selectLocalization } from "@/lib/localization";
import type { CatalogDetailUnitType } from "../model/catalog-detail-section";
import type { CatalogDetailUnitFor } from "../model/catalog-detail-unit";

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
	const { locale, t } = useTranslation(["governance", "ui"]);
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
				<UnitProgressAction buttonClassName="min-h-10 w-full" className="w-full" />
				<UnitScoreControl targetId={unit.id} type={type} />
			</div>

			<div className="grid min-w-0 content-start gap-4">
				<div className="flex flex-wrap items-start justify-between gap-4">
					<h1 className="min-w-0 flex-1 font-heading text-3xl font-black leading-tight tracking-tight sm:text-4xl">
						{localization?.title ?? t.ui.unnamed}
					</h1>
					<div className="flex flex-wrap items-center justify-end gap-2">
						<FavoriteButton targetId={unit.id} />
						<CollectionPickerButton targetId={unit.id} triggerVariant="outline" />
						{unit.capabilities.canEdit ? (
							<Button asChild size="sm" variant="solid">
								<Link href={`/units/${type}/${unit.id}/edit`}>{t.ui.edit}</Link>
							</Button>
						) : null}
						{unit.capabilities.canManageAccess ||
						unit.capabilities.canManageAssociations ? (
							<Button asChild size="sm" variant="outline">
								<Link
									href={`/units/${type}/${unit.id}/edit/${unit.capabilities.canManageAccess ? "access" : "relationships"}`}
								>
									{t.governance.open}
								</Link>
							</Button>
						) : null}
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

				<UnitProgressHeroSummary />
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
