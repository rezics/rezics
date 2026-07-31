"use client";

import type { GetApiTagsByTagIdStatus200 } from "@rezics/openapi-tanstack-query";
import { Button, IdentityAvatar, Tooltip, TooltipContent, TooltipTrigger } from "@rezics/ui";
import { Pencil } from "lucide-react";

import { AppLink as Link } from "@/features/application-shell/components/app-link";
import { ContentLanguageVersionMenu } from "@/features/content-languages/components/content-language-version-menu";
import { LocalizedText } from "@/features/content-language-display/chinese-content-display-context";
import { ConnectedFeedEngagementBar } from "@/features/content-feed/components/feed-card-actions";
import type { FeedActionPolicy } from "@/features/content-feed/model/feed-action-policy";
import { FollowButton } from "@/features/following/components/follow-button";
import { UnitReportOverflowMenu } from "@/features/reports/components/unit-report-dialog";
import { UnitShareAction } from "@/features/units/components/unit-share-action";
import { useTranslation } from "@/i18n/client";
import { selectLocalization } from "@/lib/localization";
import { tagDetailHref, tagManagementHref } from "../routing/tag-links";

const TagActionPolicy = {
	discussion: "discussions",
	primary: "collect",
} as const satisfies FeedActionPolicy;

export function TagDetailHero({ tag }: { readonly tag: GetApiTagsByTagIdStatus200 }) {
	const { t } = useTranslation(["tags", "ui"]);
	const localization = selectLocalization(tag.localizations, tag.language);
	const title = localization?.title ?? t.tags.unnamedTag;
	const fallback = Array.from(title.trim())[0]?.toLocaleUpperCase() ?? title;

	return (
		<section className="grid gap-5 sm:grid-cols-[6rem_minmax(0,1fr)] sm:items-start">
			<IdentityAvatar
				avatar={tag.avatar}
				className="size-24 border border-border-weak text-3xl shadow-sm/5"
				fallback={fallback}
				imageAlt={title}
			/>
			<div className="grid min-w-0 gap-3">
				<div className="flex flex-wrap items-start justify-between gap-3">
					<h1 className="min-w-0 flex-1 font-heading text-3xl font-black leading-tight tracking-tight sm:text-4xl">
						<LocalizedText language={localization?.language} value={title} />
					</h1>
					<div className="flex shrink-0 items-center justify-end gap-1">
						<FollowButton size="sm" unitId={tag.id} variant="quiet" />
						{tag.capabilities.canEdit ? (
							<Tooltip>
								<TooltipTrigger asChild>
									<Button
										aria-label={t.ui.edit}
										asChild
										size="icon-md"
										variant="quiet"
									>
										<Link href={tagManagementHref(tag.id)}>
											<Pencil aria-hidden />
										</Link>
									</Button>
								</TooltipTrigger>
								<TooltipContent>{t.ui.edit}</TooltipContent>
							</Tooltip>
						) : null}
						<UnitShareAction unitId={tag.id} />
						<UnitReportOverflowMenu
							additionalItems={
								<ContentLanguageVersionMenu
									availableLanguages={tag.localizations.map(
										({ language }) => language,
									)}
									currentLanguage={tag.language}
								/>
							}
							unitId={tag.id}
						/>
					</div>
				</div>
				{localization?.summary ? (
					<p className="max-w-3xl text-base font-medium leading-7 text-foreground/88">
						<LocalizedText
							language={localization.language}
							value={localization.summary}
						/>
					</p>
				) : null}
				<ConnectedFeedEngagementBar
					discussionHref={tagDetailHref(tag.id, "discussion")}
					href={tagDetailHref(tag.id)}
					itemId={tag.id}
					policy={TagActionPolicy}
					showShare={false}
				/>
			</div>
		</section>
	);
}
