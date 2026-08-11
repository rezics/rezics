"use client";

import {
	Button,
	Cover,
	ShowMoreContent,
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@rezics/ui";
import { BookOpen, Gamepad2, LibraryBig, Pencil, PlaySquare } from "lucide-react";
import { AppLink as Link } from "@/features/application-shell/components/app-link";

import { CollectionPickerButton } from "@/features/collections/components/collection-picker-button";
import { ContentLanguageVersionMenu } from "@/features/content-languages/components/content-language-version-menu";
import { FollowButton } from "@/features/following/components/follow-button";
import { UnitProgressAction } from "@/features/progress/components/unit-progress-action";
import { UnitProgressStatistics } from "@/features/progress/components/unit-progress-statistics";
import { isProgressTrackableUnitType } from "@/features/progress/model/progress-record";
import { UnitScoreControl } from "@/features/reviews/components/unit-score-control";
import { UnitUnitOverflowMenu } from "@/features/ownership-claims/components/unit-ownership-claim-actions";
import { useTranslation } from "@/i18n/client";
import { readPortableText } from "@/lib/block";
import { selectLocalization } from "@/lib/localization";
import { LocalizedPortableTextContent } from "@/features/content-language-display/localized-portable-text-content";
import { LocalizedText } from "@/features/content-language-display/chinese-content-display-context";
import type { UnitDetailUnitType } from "../model/unit-detail-section";
import type { UnitDetailUnitFor } from "../model/unit-detail-unit";
import { UnitShareAction } from "./unit-share-action";

const UnitIcons = {
	book: BookOpen,
	media: PlaySquare,
	software: Gamepad2,
	series: LibraryBig,
} as const;

export function UnitDetailHero<Type extends UnitDetailUnitType>({
	type,
	unit,
}: {
	readonly type: Type;
	readonly unit: UnitDetailUnitFor<Type>;
}) {
	const { t } = useTranslation(["ui"]);
	const localization = selectLocalization(unit.localizations, unit.language ?? "");

	return (
		<section className="grid items-start gap-6 lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-10">
			<div className="mx-auto grid w-full max-w-52 content-start gap-4 lg:mx-0">
				<Cover
					alt={localization?.title ?? t.ui.unnamed}
					className="rounded-xl border border-border-weak shadow-md/10"
					fallback={<UnitIcon type={type} />}
					priority
					sizes="(min-width: 1024px) 13rem, 13rem"
					src={unit.cover?.url}
				/>
				{isProgressTrackableUnitType(type) ? (
					<UnitProgressAction buttonClassName="min-h-10" className="w-full" />
				) : null}
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
						<LocalizedText
							language={localization?.language}
							value={localization?.title ?? t.ui.unnamed}
						/>
					</h1>
					<div className="flex shrink-0 items-center justify-end gap-1">
						<FollowButton size="sm" unitId={unit.id} variant="quiet" />
						{unit.capabilities.canEdit ? (
							<Tooltip>
								<TooltipTrigger asChild>
									<Button aria-label={t.ui.edit} asChild size="icon-md" variant="quiet">
										<Link href={`/units/${type}/${unit.id}/edit`}>
											<Pencil aria-hidden />
										</Link>
									</Button>
								</TooltipTrigger>
								<TooltipContent>{t.ui.edit}</TooltipContent>
							</Tooltip>
						) : null}
						<UnitShareAction unitId={unit.id} />
						<UnitUnitOverflowMenu
							additionalItems={
								<ContentLanguageVersionMenu
									availableLanguages={unit.localizations.map(({ language }) => language)}
									currentLanguage={unit.language}
								/>
							}
							ownershipMode={unit.ownershipMode}
							pendingClaim={unit.ownershipClaim}
							type={type}
							unitId={unit.id}
						/>
					</div>
				</div>

				{localization?.summary ? (
					<p className="max-w-3xl text-base font-medium leading-7 text-foreground/88">
						<LocalizedText language={localization.language} value={localization.summary} />
					</p>
				) : null}

				{localization?.description ? (
					<ShowMoreContent showLessLabel={t.ui.showLess} showMoreLabel={t.ui.showMore}>
						<LocalizedPortableTextContent
							className="text-base prose-p:my-4 prose-p:leading-7 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0"
							language={localization.language}
							value={readPortableText(localization.description)}
							variant="article"
						/>
					</ShowMoreContent>
				) : null}

				{isProgressTrackableUnitType(type) && unit.progressStatistics ? (
					<UnitProgressStatistics
						active={unit.progressStatistics.active}
						backlog={unit.progressStatistics.backlog}
						type={type}
					/>
				) : null}
			</div>
		</section>
	);
}

function UnitIcon({ type }: { readonly type: UnitDetailUnitType }) {
	const Icon = UnitIcons[type];
	return <Icon aria-hidden className="size-9" />;
}
