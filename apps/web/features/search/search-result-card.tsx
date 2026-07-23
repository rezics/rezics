"use client";

import type { PresentedAvatar } from "@rezics/avatar";
import { IdentityAvatar, LinkBox, LinkOverlay } from "@rezics/ui";
import { useId } from "react";

import { FeedCard, FeedCardBody, FeedCardContent } from "@/features/content-feed/feed-card";
import { useTranslation } from "@/i18n/client";

export interface SearchResultCardData {
	readonly avatar?: PresentedAvatar | null;
	readonly href?: string;
	readonly summary?: string | null;
	readonly title?: string | null;
}

export function SearchResultCard({
	categoryLabel,
	result,
}: {
	readonly categoryLabel: string;
	readonly result: SearchResultCardData;
}) {
	const { t } = useTranslation("ui");
	const titleId = useId();
	const title = result.title?.trim() || t.unnamed;

	return (
		<FeedCard aria-labelledby={titleId}>
			<FeedCardContent className="pb-4 pt-4">
				<LinkBox
					className={
						result.avatar
							? "grid grid-cols-[3.5rem_minmax(0,1fr)] items-start gap-3"
							: undefined
					}
				>
					{result.avatar ? (
						<IdentityAvatar
							avatar={result.avatar}
							className="size-14 text-lg font-black"
							fallback={title.slice(0, 1)}
						/>
					) : null}
					<div className="min-w-0">
						<p className="font-semibold text-brand text-xs">{categoryLabel}</p>
						<h4
							className="mt-1 font-heading font-black text-[1.05rem] leading-snug"
							id={titleId}
						>
							{result.href ? (
								<LinkOverlay href={result.href}>{title}</LinkOverlay>
							) : (
								title
							)}
						</h4>
						{result.summary ? (
							<FeedCardBody className="mt-2 line-clamp-3 text-muted-foreground">
								{result.summary}
							</FeedCardBody>
						) : null}
					</div>
				</LinkBox>
			</FeedCardContent>
		</FeedCard>
	);
}
