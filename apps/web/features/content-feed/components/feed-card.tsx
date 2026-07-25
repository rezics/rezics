"use client";

import { type ComponentProps, type ReactNode, useState } from "react";
import type { PresentedAvatar } from "@rezics/avatar";
import { BookOpenIcon, ChevronRightIcon, StarIcon } from "lucide-react";

import {
	Button,
	Card,
	CardContent,
	CardFooter,
	CardHeader,
	Cover,
	HoverCard,
	HoverCardContent,
	HoverCardTrigger,
	IdentityAvatar,
	Item,
	ItemContent,
	ItemDescription,
	ItemTitle,
	cn,
} from "@rezics/ui";
import {
	RealmInfoCard,
	type RealmInfoCardData,
} from "@/features/realms/components/realm-info-card";
import { isKnownAttributionRole } from "@/features/units/attribution-role";
import { useTranslation } from "@/i18n/client";
import { useFineHover } from "../hooks/use-fine-hover";

interface FeedContextItem {
	readonly id: string;
	readonly name: string;
	readonly href?: string;
	readonly avatar?: PresentedAvatar | null;
	readonly initials: string;
}

export type FeedAttributionContext = FeedContextItem & {
	readonly kind: string;
	readonly role: string;
	readonly slug?: string;
	readonly summary?: string;
};
export type FeedRealmContext = FeedContextItem & RealmInfoCardData;

export interface FeedTargetScore {
	readonly contextLabel: string;
	readonly contextUnitId: string;
	readonly totalScore: number;
	readonly totalCount: number;
}

export function FeedCard({ className, ...props }: ComponentProps<"article">) {
	return (
		<Card
			asChild
			className={cn(
				"group/feed-card gap-0 rounded-none py-0 sm:rounded-2xl",
				"transition-colors hover:bg-surface-hover focus-within:bg-surface-hover",
				"has-[[data-slot=feed-card-target-link]:hover]:bg-transparent",
				"has-[[data-slot=feed-card-target-link]:focus-visible]:bg-transparent",
				className,
			)}
		>
			<article data-slot="feed-card" {...props} />
		</Card>
	);
}

export function FeedCardHeader({
	attributions,
	realms,
	timestamp,
	recommendation,
	menu,
}: {
	attributions: readonly FeedAttributionContext[];
	realms: readonly FeedRealmContext[];
	timestamp: string;
	recommendation?: ReactNode;
	menu?: ReactNode;
}) {
	const { t } = useTranslation(["feed", "posts", "units"]);
	return (
		<CardHeader className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-2 gap-y-1 px-4 pt-4 sm:px-5">
			<div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1">
				<FeedContextGroup
					emptyLabel={t.posts.unknownAttribution}
					items={attributions}
					listLabel={t.feed.attributionList({ count: attributions.length })}
					renderInfoCard={(attribution) => (
						<FeedAttributionInfoCard
							attribution={attribution}
							roleLabel={
								isKnownAttributionRole(attribution.role)
									? t.units.attributionRoles[attribution.role]
									: attribution.role
							}
						/>
					)}
					showListLabel={(primary, count) =>
						t.feed.showAttributionList({ attribution: primary.name, count })
					}
				/>
				{realms.length > 0 ? (
					<>
						<span className="text-muted-foreground text-xs">
							{t.feed.contextSeparator}
						</span>
						<FeedContextGroup
							items={realms}
							listLabel={t.feed.realmList({ count: realms.length })}
							renderInfoCard={(realm) => <RealmInfoCard realm={realm} />}
							showListLabel={(primary, count) =>
								t.feed.showRealmList({ realm: primary.name, count })
							}
						/>
					</>
				) : null}
				<span aria-hidden className="text-muted-foreground text-xs">
					·
				</span>
				<time className="text-muted-foreground text-xs">{timestamp}</time>
			</div>
			{menu ? <div className="row-span-2">{menu}</div> : null}
			{recommendation ? (
				<div className="col-start-1 text-muted-foreground text-xs">{recommendation}</div>
			) : null}
		</CardHeader>
	);
}

export function FeedCardContent({ className, ...props }: ComponentProps<typeof CardContent>) {
	return (
		<CardContent
			className={cn("flex flex-col gap-2 px-4 pt-3 sm:px-5", className)}
			data-slot="feed-card-content"
			{...props}
		/>
	);
}

export function FeedCardTitle({ className, ...props }: ComponentProps<"h2">) {
	return (
		<h2
			className={cn(
				"font-heading font-bold text-lg leading-snug tracking-tight sm:text-xl",
				className,
			)}
			data-slot="feed-card-title"
			{...props}
		/>
	);
}

export function FeedCardBody({ className, ...props }: ComponentProps<"div">) {
	return (
		<div
			className={cn("text-foreground/88 text-sm leading-6", className)}
			data-slot="feed-card-body"
			{...props}
		/>
	);
}

export function FeedCardMedia({
	src,
	alt,
	className,
	...props
}: Omit<ComponentProps<"img">, "src" | "alt"> & {
	src: string;
	alt: string;
}) {
	return (
		<figure className="mt-1 overflow-hidden rounded-xl bg-muted">
			<img
				alt={alt}
				className={cn("max-h-96 w-full object-cover", className)}
				loading="lazy"
				src={src}
				{...props}
			/>
		</figure>
	);
}

export function FeedCardTarget({
	href,
	label,
	title,
	description,
	imageUrl,
	imageAlt = "",
	score,
}: {
	href: string;
	label: string;
	title: string;
	description?: string;
	imageUrl?: string;
	imageAlt?: string;
	score?: FeedTargetScore;
}) {
	const { locale, t } = useTranslation(["feed"]);
	const averageScore = score && score.totalCount > 0 ? score.totalScore / score.totalCount : null;
	return (
		<CardContent className="px-4 pt-3 sm:px-5" data-slot="feed-card-target">
			<div className="mb-3 border-border-weak border-t" />
			<Item asChild className="p-2.5 hover:bg-surface-hover" variant="muted">
				<a data-slot="feed-card-target-link" href={href}>
					<Cover
						alt={imageAlt || title}
						className="w-12 rounded-md"
						fallback={<BookOpenIcon aria-hidden />}
						src={imageUrl}
					/>
					<ItemContent className="min-w-0">
						<ItemDescription className="text-xs">{label}</ItemDescription>
						<ItemTitle>{title}</ItemTitle>
						{description ? (
							<ItemDescription className="line-clamp-1 text-xs">
								{description}
							</ItemDescription>
						) : null}
						{score && averageScore !== null ? (
							<p className="mt-0.5 flex items-center gap-1 text-muted-foreground text-xs">
								<span>{score.contextLabel}</span>
								<StarIcon aria-hidden className="size-3 fill-current" />
								<span>
									{t.feed.targetScore({
										score: new Intl.NumberFormat(locale.target, {
											maximumFractionDigits: 1,
											minimumFractionDigits: 1,
										}).format(averageScore),
										count: score.totalCount,
									})}
								</span>
							</p>
						) : null}
					</ItemContent>
					<ChevronRightIcon aria-hidden className="text-muted-foreground" />
				</a>
			</Item>
		</CardContent>
	);
}

export function FeedCardActionBar({ className, ...props }: ComponentProps<typeof CardFooter>) {
	return (
		<CardFooter
			className={cn(
				"mt-1 flex gap-1.5 overflow-x-auto rounded-none border-0 bg-transparent px-4 pb-4 pt-3 sm:px-5",
				className,
			)}
			data-slot="feed-card-action-bar"
			{...props}
		/>
	);
}

function FeedContextGroup<T extends FeedContextItem>({
	items,
	emptyLabel,
	listLabel,
	renderInfoCard,
	showListLabel,
}: {
	items: readonly T[];
	emptyLabel?: string;
	listLabel: string;
	renderInfoCard: (item: T) => ReactNode;
	showListLabel: (primary: T, count: number) => string;
}) {
	const supportsFineHover = useFineHover();
	const [listOpen, setListOpen] = useState(false);
	const primary = items[0];
	if (!primary) return emptyLabel ? <span className="text-xs">{emptyLabel}</span> : null;
	if (items.length === 1)
		return (
			<HoverCard
				closeDelay={160}
				disabled={!supportsFineHover}
				openDelay={320}
				positioning={{ placement: "bottom-start" }}
			>
				<HoverCardTrigger asChild>
					{primary.href ? (
						<a
							className="inline-flex min-w-0 items-center gap-2 rounded-md font-semibold text-xs outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/32"
							href={primary.href}
						>
							<FeedAvatar item={primary} />
							<span className="max-w-40 truncate sm:max-w-56">{primary.name}</span>
						</a>
					) : (
						<span className="inline-flex min-w-0 items-center gap-2 font-semibold text-xs">
							<FeedAvatar item={primary} />
							<span className="max-w-40 truncate sm:max-w-56">{primary.name}</span>
						</span>
					)}
				</HoverCardTrigger>
				<HoverCardContent className="w-72">{renderInfoCard(primary)}</HoverCardContent>
			</HoverCard>
		);
	const additionalCount = items.length - 1;
	return (
		<HoverCard
			closeDelay={180}
			onOpenChange={({ open }) => setListOpen(open)}
			open={listOpen}
			openDelay={220}
			positioning={{ placement: "bottom-start" }}
		>
			<HoverCardTrigger asChild>
				<Button
					aria-expanded={listOpen}
					aria-haspopup="dialog"
					aria-label={showListLabel(primary, additionalCount)}
					className="h-auto max-w-full gap-2 px-0 py-0 font-semibold hover:bg-transparent hover:underline"
					onClick={() => setListOpen(true)}
					size="xs"
					variant="quiet"
				>
					<FeedAvatar item={primary} />
					<span className="max-w-36 truncate sm:max-w-52">{primary.name}</span>
					<span className="shrink-0 text-muted-foreground">+{additionalCount}</span>
				</Button>
			</HoverCardTrigger>
			<HoverCardContent className="w-72 p-2">
				<div aria-label={listLabel} className="grid gap-0.5" role="list">
					{items.map((item) => (
						<div key={item.id} role="listitem">
							<HoverCard
								closeDelay={160}
								disabled={!supportsFineHover}
								openDelay={260}
								positioning={{ placement: "right-start" }}
							>
								<HoverCardTrigger asChild>
									{item.href ? (
										<a
											className="flex min-h-11 items-center gap-2 rounded-lg px-2 py-1.5 text-sm outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/32"
											href={item.href}
										>
											<FeedAvatar item={item} />
											<span className="truncate">{item.name}</span>
										</a>
									) : (
										<span className="flex min-h-11 items-center gap-2 px-2 py-1.5 text-sm">
											<FeedAvatar item={item} />
											<span className="truncate">{item.name}</span>
										</span>
									)}
								</HoverCardTrigger>
								<HoverCardContent className="w-72">
									{renderInfoCard(item)}
								</HoverCardContent>
							</HoverCard>
						</div>
					))}
				</div>
			</HoverCardContent>
		</HoverCard>
	);
}

function FeedAvatar({ item }: { item: FeedContextItem }) {
	return <IdentityAvatar avatar={item.avatar} fallback={item.initials} size="sm" />;
}

function FeedAttributionInfoCard({
	attribution,
	roleLabel,
}: {
	attribution: FeedAttributionContext;
	roleLabel: string;
}) {
	return (
		<div className="grid gap-3" data-slot="attribution-info-card">
			<div className="flex min-w-0 items-center gap-3">
				<IdentityAvatar
					avatar={attribution.avatar}
					className="size-12 text-base"
					fallback={attribution.initials}
					size="lg"
				/>
				<div className="min-w-0">
					<p className="truncate font-heading font-bold text-base">{attribution.name}</p>
					<p className="truncate text-muted-foreground text-xs">
						{roleLabel}
						{attribution.kind === "profile" && attribution.slug
							? ` · @${attribution.slug}`
							: null}
					</p>
				</div>
			</div>
			{attribution.summary ? (
				<p className="line-clamp-3 text-muted-foreground text-sm leading-5">
					{attribution.summary}
				</p>
			) : null}
		</div>
	);
}
