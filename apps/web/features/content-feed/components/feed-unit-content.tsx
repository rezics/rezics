"use client";

import { CardContent, Cover, cn } from "@rezics/ui";
import type { ReactNode } from "react";

import { AppLink as Link } from "@/features/application-shell/components/app-link";
import { UnitCoverFallback } from "@/features/units/components/unit-cover-fallback";

export function FeedUnitContent({
	coverUrl,
	headingId,
	headingLevel = 2,
	href,
	kind,
	kindLabel,
	metadata,
	onOpen,
	rating,
	standalone = false,
	summary,
	title,
}: {
	readonly coverUrl?: string;
	readonly headingId: string;
	readonly headingLevel?: 2 | 3;
	readonly href?: string;
	readonly kind: string;
	readonly kindLabel: string;
	readonly metadata?: ReactNode;
	readonly onOpen?: () => void;
	readonly rating?: ReactNode;
	readonly standalone?: boolean;
	readonly summary?: string;
	readonly title: string;
}) {
	const Heading = headingLevel === 2 ? "h2" : "h3";
	return (
		<CardContent
			className={cn(
				"grid grid-cols-[5rem_minmax(0,1fr)] gap-4 px-4 sm:grid-cols-[7.5rem_minmax(0,1fr)] sm:px-5",
				standalone ? "py-5" : "pb-0 pt-3",
			)}
		>
			<FeedUnitContentLink className="block" href={href} onOpen={onOpen}>
				<Cover
					alt={title}
					className="w-full rounded-xl border border-border-weak shadow-sm/5"
					fallback={<UnitCoverFallback kind={kind} />}
					sizes="(min-width: 640px) 120px, 80px"
					src={coverUrl}
				/>
			</FeedUnitContentLink>
			<div className="min-w-0">
				<p className="font-semibold text-brand text-xs">{kindLabel}</p>
				<FeedUnitContentLink href={href} onOpen={onOpen}>
					<Heading
						className="mt-1 font-heading font-black text-[1.05rem] leading-snug"
						id={headingId}
					>
						{title}
					</Heading>
					{rating}
					{summary ? (
						<p className="mt-2 line-clamp-3 text-muted-foreground text-sm leading-6">{summary}</p>
					) : null}
					{metadata}
				</FeedUnitContentLink>
			</div>
		</CardContent>
	);
}

function FeedUnitContentLink({
	children,
	className,
	href,
	onOpen,
}: {
	readonly children: ReactNode;
	readonly className?: string;
	readonly href?: string;
	readonly onOpen?: () => void;
}) {
	return href ? (
		<Link className={className} href={href} onClick={onOpen}>
			{children}
		</Link>
	) : (
		<div className={className}>{children}</div>
	);
}
