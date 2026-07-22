"use client";

import { type ComponentProps, type ReactNode } from "react";
import { BookOpenIcon, ChevronRightIcon } from "lucide-react";

import {
	Avatar,
	AvatarFallback,
	AvatarGroup,
	AvatarImage,
	Button,
	Card,
	CardContent,
	CardFooter,
	CardHeader,
	Cover,
	Item,
	ItemContent,
	ItemDescription,
	ItemMedia,
	ItemTitle,
	Popover,
	PopoverContent,
	PopoverTrigger,
	cn,
} from "@rezics/ui";
import { useTranslation } from "@/i18n/client";

export interface FeedActor {
	name: string;
	href: string;
	avatarUrl?: string;
	initials: string;
}

export interface FeedRealm {
	id: string;
	name: string;
	href: string;
	avatarUrl?: string;
	initials: string;
}

export type FeedRealms = readonly [FeedRealm, ...FeedRealm[]];

export function FeedCard({ className, ...props }: ComponentProps<"article">) {
	return (
		<Card
			asChild
			className={cn(
				"group/feed-card gap-0 rounded-none py-0 sm:rounded-2xl",
				"transition-colors hover:bg-surface-hover focus-within:bg-surface-hover",
				className,
			)}
		>
			<article data-slot="feed-card" {...props} />
		</Card>
	);
}

export function FeedCardHeader({
	actor,
	realms,
	timestamp,
	recommendation,
	menu,
}: {
	actor: FeedActor;
	realms: FeedRealms;
	timestamp: string;
	recommendation?: ReactNode;
	menu?: ReactNode;
}) {
	return (
		<CardHeader className="flex flex-wrap items-center gap-x-1.5 gap-y-1 px-4 pt-4 sm:px-5">
			<FeedActorContext actor={actor} />
			<span aria-hidden className="text-muted-foreground text-xs">
				·
			</span>
			<FeedRealmContext realms={realms} />
			<span aria-hidden className="text-muted-foreground text-xs">
				·
			</span>
			<time className="text-muted-foreground text-xs">{timestamp}</time>
			{menu ? <div className="ms-auto">{menu}</div> : null}
			{recommendation ? (
				<div className="basis-full ps-8 text-muted-foreground text-xs">
					{recommendation}
				</div>
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
}: {
	href: string;
	label: string;
	title: string;
	description?: string;
	imageUrl?: string;
	imageAlt?: string;
}) {
	return (
		<CardContent className="px-4 pt-3 sm:px-5" data-slot="feed-card-target">
			<Item asChild variant="muted">
				<a href={href}>
					<ItemMedia className="aspect-[3/4] w-9 rounded-md" variant="image">
						<Cover
							alt={imageAlt || title}
							className="size-full rounded-md"
							fallback={<BookOpenIcon aria-hidden />}
							src={imageUrl}
						/>
					</ItemMedia>
					<ItemContent className="min-w-0">
						<ItemDescription className="text-xs">{label}</ItemDescription>
						<ItemTitle>{title}</ItemTitle>
						{description ? (
							<ItemDescription className="line-clamp-1 text-xs">
								{description}
							</ItemDescription>
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

function FeedActorContext({ actor }: { actor: FeedActor }) {
	return (
		<a
			className="inline-flex min-w-0 items-center gap-2 rounded-md font-semibold text-xs outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/32"
			href={actor.href}
		>
			<FeedAvatar alt={actor.name} fallback={actor.initials} src={actor.avatarUrl} />
			<span className="truncate">{actor.name}</span>
		</a>
	);
}

function FeedRealmContext({ realms }: { realms: FeedRealms }) {
	const { t } = useTranslation(["feed"]);
	const [primaryRealm, ...additionalRealms] = realms;
	const visibleRealms = [primaryRealm, ...additionalRealms.slice(0, 2)];
	const moreCount = additionalRealms.length;
	const realmSummary =
		moreCount > 0
			? t.feed.realmContextWithMore({ realm: primaryRealm.name, count: moreCount })
			: t.feed.realmContext({ realm: primaryRealm.name });

	return (
		<Popover positioning={{ placement: "bottom-start" }}>
			<PopoverTrigger asChild>
				<Button
					aria-label={t.feed.showRealmList({ summary: realmSummary })}
					className="max-w-full gap-1.5 px-1.5 data-[state=open]:bg-accent data-[state=open]:text-accent-foreground"
					size="xs"
					variant="quiet"
				>
					<AvatarGroup>
						{visibleRealms.map((realm) => (
							<FeedAvatar
								alt=""
								fallback={realm.initials}
								key={realm.id}
								src={realm.avatarUrl}
							/>
						))}
					</AvatarGroup>
					<span className="truncate text-muted-foreground">{realmSummary}</span>
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-72 p-3">
				<p className="mb-2 font-medium text-sm">
					{realms.length === 1
						? t.feed.publishedInOneRealm({ count: realms.length })
						: t.feed.publishedInRealms({ count: realms.length })}
				</p>
				<div className="flex flex-col gap-1" role="list">
					{realms.map((realm) => (
						<a
							className="flex items-center gap-2 rounded-lg p-2 text-sm outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/32"
							href={realm.href}
							key={realm.id}
							role="listitem"
						>
							<FeedAvatar alt="" fallback={realm.initials} src={realm.avatarUrl} />
							<span className="truncate">{realm.name}</span>
						</a>
					))}
				</div>
			</PopoverContent>
		</Popover>
	);
}

function FeedAvatar({ src, alt, fallback }: { src?: string; alt: string; fallback: string }) {
	return (
		<Avatar size="sm">
			{src ? <AvatarImage alt={alt} src={src} /> : null}
			<AvatarFallback>{fallback}</AvatarFallback>
		</Avatar>
	);
}
