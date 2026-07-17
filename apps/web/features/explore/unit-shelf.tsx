"use client";

import {
	type GetApiRecommendationsUnitsStatus200,
	useGetApiRecommendationsUnits,
	usePutApiRecommendationsExclusionsByUnitId,
} from "@rezics/openapi-tanstack-query";
import { useQueryClient } from "@tanstack/react-query";
import {
	ArrowRight,
	BookOpenIcon,
	Ellipsis,
	EyeOff,
	Gamepad2Icon,
	PlaySquareIcon,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import {
	Button,
	Card,
	CardContent,
	CardMedia,
	cn,
	Menu,
	MenuContent,
	MenuItem,
	MenuTrigger,
	Skeleton,
} from "@rezics/ui";
import { recommendationReasonLabel } from "@/features/recommendations/reason";
import { invalidateRecommendationQueries } from "@/features/recommendations/query";
import { useRecommendationTracking } from "@/features/recommendations/tracking";
import { useTranslation } from "@/i18n/client";
import { useHydratedSession } from "@/lib/use-hydrated-session";

type RecommendedUnit = GetApiRecommendationsUnitsStatus200["items"][number];

const UnitIcons = { book: BookOpenIcon, game: Gamepad2Icon, media: PlaySquareIcon };

export function UnitShelf({
	type,
	personalized,
	seedUnitId,
}: {
	type: "book" | "game" | "media";
	personalized?: boolean;
	seedUnitId?: string;
}) {
	const { t } = useTranslation({ suspense: true });
	const { data: session } = useHydratedSession();
	const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set());
	const query = useGetApiRecommendationsUnits({
		query: {
			type,
			limit: 6,
			...(personalized === undefined ? {} : { personalized }),
			...(seedUnitId ? { seedUnitId } : {}),
		},
	});
	if (query.isPending)
		return (
			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{Array.from({ length: 3 }, (_, index) => (
					<Skeleton key={index} className="h-32 rounded-xl" />
				))}
			</div>
		);
	if (query.isError) return <p className="text-destructive text-sm">{t.state.error}</p>;
	const items = (query.data?.items ?? []).filter(({ id }) => !hidden.has(id));
	if (!items.length) return <p className="text-muted-foreground text-sm">{t.state.empty}</p>;
	const setItemHidden = (id: string, value: boolean) =>
		setHidden((current) => {
			const next = new Set(current);
			if (value) next.add(id);
			else next.delete(id);
			return next;
		});
	return (
		<div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-6">
			{items.map((item, index) => (
				<UnitRecommendationCard
					key={item.id}
					item={item}
					canExclude={Boolean(session)}
					featuredMobile={index === 0}
					onHiddenChange={(value) => setItemHidden(item.id, value)}
				/>
			))}
		</div>
	);
}

function UnitRecommendationCard({
	item,
	canExclude,
	featuredMobile,
	onHiddenChange,
}: {
	item: RecommendedUnit;
	canExclude: boolean;
	featuredMobile: boolean;
	onHiddenChange: (hidden: boolean) => void;
}) {
	const { t } = useTranslation({ suspense: true });
	const { elementRef, trackOpen } = useRecommendationTracking(item.id, item.tracking);
	const queryClient = useQueryClient();
	const exclude = usePutApiRecommendationsExclusionsByUnitId({
		mutation: {
			onError: () => onHiddenChange(false),
			onSuccess: () => invalidateRecommendationQueries(queryClient),
		},
	});
	const reason = recommendationReasonLabel(item.recommendationReason, t.feed);
	const UnitIcon = UnitIcons[item.type];
	const markNotInterested = () => {
		onHiddenChange(true);
		exclude.mutate({
			path: { unitId: item.id },
			body: {
				eventId: crypto.randomUUID(),
				occurredAt: new Date().toISOString(),
				requestId: item.tracking.requestId,
				surface: item.tracking.surface,
				position: Number(item.tracking.position),
				policyVersion: item.tracking.policyVersion,
				signature: item.tracking.signature,
			},
		});
	};
	return (
		<Card
			asChild
			className={cn(
				"group relative overflow-hidden p-0",
				!featuredMobile && "hidden sm:flex",
				featuredMobile &&
					"grid grid-cols-[7.25rem_minmax(0,1fr)] sm:flex sm:grid-cols-none",
			)}
		>
			<article ref={elementRef}>
				{canExclude && (
					<Menu>
						<MenuTrigger asChild>
							<Button
								aria-label={t.feed.recommendationMenu}
								className="absolute end-2 top-2 z-10 size-11 bg-background/80 backdrop-blur sm:size-6"
								pill
								size="icon-xs"
								variant="secondary"
							>
								<Ellipsis aria-hidden />
							</Button>
						</MenuTrigger>
						<MenuContent>
							<MenuItem
								disabled={exclude.isPending}
								onSelect={markNotInterested}
								value="not-interested"
							>
								<EyeOff aria-hidden />
								{t.feed.notInterested}
							</MenuItem>
						</MenuContent>
					</Menu>
				)}
				<Link
					aria-label={item.title ?? item.slug ?? t.ui.unnamed}
					href={`/units/${item.type}/${item.id}`}
					onClick={trackOpen}
				>
					<CardMedia
						className={cn(
							item.type === "book"
								? "bg-accent aspect-[2/3]"
								: "bg-accent aspect-video",
							featuredMobile &&
								"h-full min-h-44 aspect-auto sm:h-auto sm:min-h-0 sm:aspect-[2/3]",
						)}
						variant="image"
					>
						{item.cover ? (
							<img
								alt=""
								className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
								src={item.cover.url}
								style={{
									objectPosition: `${item.cover.focalPoint.x * 100}% ${item.cover.focalPoint.y * 100}%`,
								}}
							/>
						) : (
							<div className="text-accent-foreground grid size-full place-items-center">
								<UnitIcon aria-hidden className="size-9" />
							</div>
						)}
					</CardMedia>
				</Link>
				<CardContent
					className={cn(
						"flex min-h-32 flex-col gap-2 p-3",
						featuredMobile && "min-h-44 sm:min-h-32",
					)}
				>
					<p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
						{item.type}
					</p>
					<h3
						className={cn(
							"line-clamp-2 text-sm font-semibold",
							featuredMobile && "text-base sm:text-sm",
						)}
					>
						{item.title ?? item.slug ?? t.ui.unnamed}
					</h3>
					{reason && <p className="text-primary line-clamp-1 text-xs">{reason}</p>}
					<Link
						href={`/units/${item.type}/${item.id}`}
						className="text-primary mt-auto inline-flex items-center gap-1 text-sm"
						onClick={trackOpen}
					>
						{t.actions.view}{" "}
						<ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
					</Link>
				</CardContent>
			</article>
		</Card>
	);
}
