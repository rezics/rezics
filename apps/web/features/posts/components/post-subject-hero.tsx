"use client";

import { ChevronRightIcon } from "lucide-react";
import { AppLink as Link } from "@/features/application-shell/components/app-link";
import type { ContentLanguage } from "@rezics/i18n";

import { Card, Cover } from "@rezics/ui";
import { UnitCoverFallback } from "@/features/units/components/unit-cover-fallback";
import { publicUnitHref } from "@/features/units/routing/public-unit-route";
import { useTranslation } from "@/i18n/client";
import { useChineseContentText } from "@/features/content-language-display/chinese-content-display-context";

export interface PostSubjectPresentation {
	readonly id: string;
	readonly type: string;
	readonly language: ContentLanguage;
	readonly title: string | null;
	readonly summary: string | null;
	readonly cover: { readonly id: string; readonly url: string } | null;
}

export function PostSubjectHero({ subject }: { readonly subject: PostSubjectPresentation }) {
	const { t } = useTranslation(["feed", "ui"]);
	const href = publicUnitHref(subject.type, subject);
	const title = subject.title ?? t.ui.unnamed;
	const displayedTitle = useChineseContentText(title, subject.language);
	const displayedSummary = useChineseContentText(subject.summary ?? "", subject.language);
	const content = (
		<>
			<div className="bg-surface-muted p-3 sm:p-4">
				<Cover
					alt={displayedTitle}
					className="w-full rounded-xl border border-border-weak shadow-sm/5"
					fallback={<UnitCoverFallback kind={subject.type} />}
					sizes="(min-width: 640px) 96px, 72px"
					src={subject.cover?.url}
				/>
			</div>
			<div className="min-w-0 self-center py-4 pe-2 ps-1 sm:py-5 sm:pe-4">
				<p className="font-semibold text-brand text-xs">{t.feed.relatedWork}</p>
				<h2 className="mt-1 font-heading font-black text-lg leading-snug sm:text-xl">
					{displayedTitle}
				</h2>
				{subject.summary ? (
					<p className="mt-1 line-clamp-2 text-muted-foreground text-sm leading-5">
						{displayedSummary}
					</p>
				) : null}
			</div>
			{href ? (
				<ChevronRightIcon aria-hidden className="me-4 size-5 self-center text-muted-foreground" />
			) : null}
		</>
	);
	return (
		<Card className="gap-0 overflow-hidden py-0">
			{href ? (
				<Link
					className="grid grid-cols-[4.5rem_minmax(0,1fr)_auto] transition-colors hover:bg-surface-hover sm:grid-cols-[6rem_minmax(0,1fr)_auto]"
					href={href}
				>
					{content}
				</Link>
			) : (
				<div className="grid grid-cols-[4.5rem_minmax(0,1fr)] sm:grid-cols-[6rem_minmax(0,1fr)]">
					{content}
				</div>
			)}
		</Card>
	);
}
