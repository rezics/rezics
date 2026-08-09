"use client";

import type {
	GetApiUnitsByTypeByUnitIdExternalLinksStatus200,
	GetApiUnitsByTypeByUnitIdStatus200,
} from "@rezics/openapi-tanstack-query";
import {
	Badge,
	IdentityAvatar,
	Popover,
	PopoverClose,
	PopoverContent,
	PopoverTrigger,
} from "@rezics/ui";
import { ExternalLink } from "lucide-react";
import type { ReactNode } from "react";

import { useChineseContentText } from "@/features/content-language-display/chinese-content-display-context";
import { useTranslation } from "@/i18n/client";
import { toFiniteApiNumber } from "@/lib/api-number";

type UnitDetailExternalLinkPresentation =
	GetApiUnitsByTypeByUnitIdStatus200["externalLinks"][number];
type UnitExternalLinkListItemPresentation =
	GetApiUnitsByTypeByUnitIdExternalLinksStatus200["items"][number];

export type UnitExternalLinkPresentation =
	| UnitDetailExternalLinkPresentation
	| UnitExternalLinkListItemPresentation;

export function UnitExternalLinkBadge({
	controls,
	link,
}: {
	readonly controls?: ReactNode;
	readonly link: UnitExternalLinkPresentation;
}) {
	const { t } = useTranslation(["ui", "units"]);
	const title = useChineseContentText(
		link.sourceEntity.title ?? t.ui.unnamed,
		link.sourceEntity.title ? link.sourceEntity.language : null,
	);
	const summary = useChineseContentText(
		link.sourceEntity.summary ?? "",
		link.sourceEntity.language,
	);
	const score = toFiniteApiNumber(link.voteSummary.score) ?? 0;
	const avatarFallback = title.trim().slice(0, 1).toUpperCase() || "#";
	const variant =
		link.voteSummary.viewerVote === 1
			? "success"
			: link.voteSummary.viewerVote === -1
				? "destructive"
				: "outline";

	return (
		<Badge className="max-w-full gap-0 overflow-visible p-0" pill variant={variant}>
			<Popover
				autoFocus={false}
				closeOnEscape
				closeOnInteractOutside
				modal={false}
				positioning={{ placement: "bottom-start", gutter: 8 }}
			>
				<PopoverTrigger asChild>
					<button
						className="inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-full px-2.5 py-1.5 outline-none hover:bg-foreground/5 focus-visible:ring-2 focus-visible:ring-ring/40"
						type="button"
					>
						<IdentityAvatar
							avatar={link.sourceEntity.avatar}
							className="size-5 text-[0.625rem]"
							fallback={avatarFallback}
							size="sm"
						/>
						<span className="min-w-0 truncate">{title}</span>
						<span className="shrink-0 tabular-nums text-[0.6875rem] opacity-75">
							{score}
						</span>
					</button>
				</PopoverTrigger>
				<PopoverContent className="grid w-[min(22rem,calc(100vw-2rem))] gap-4 p-(--space)">
					<div className="flex min-w-0 items-start gap-3">
						<IdentityAvatar
							avatar={link.sourceEntity.avatar}
							className="size-11 shrink-0"
							fallback={avatarFallback}
						/>
						<div className="min-w-0">
							<p className="truncate font-semibold">{title}</p>
							{link.pinned ? (
								<div className="mt-1 flex flex-wrap gap-1">
									<Badge variant="secondary">{t.units.references.pinned}</Badge>
								</div>
							) : null}
						</div>
					</div>
					{summary ? (
						<p className="line-clamp-3 text-sm leading-6 text-muted-foreground">
							{summary}
						</p>
					) : null}
					<PopoverClose asChild>
						<a
							className="inline-flex min-w-0 items-center gap-1.5 break-all text-sm text-link hover:text-link-hover hover:underline"
							href={link.url}
							rel="ugc nofollow noreferrer"
							target="_blank"
						>
							<span>{link.url}</span>
							<ExternalLink aria-hidden className="size-3.5 shrink-0" />
						</a>
					</PopoverClose>
					{controls}
				</PopoverContent>
			</Popover>
		</Badge>
	);
}

export function UnitExternalLinkList({
	links,
}: {
	readonly links: readonly UnitDetailExternalLinkPresentation[];
}) {
	const { t } = useTranslation(["units"]);
	if (!links.length) return null;

	return (
		<section className="grid gap-2">
			<h2 className="text-sm font-semibold text-muted-foreground">
				{t.units.detail.externalLinks}
			</h2>
			<div className="flex flex-wrap gap-2">
				{links.map((link) => (
					<UnitExternalLinkBadge key={link.id} link={link} />
				))}
			</div>
		</section>
	);
}
