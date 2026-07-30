"use client";

import {
	type GetApiRecommendationsUnitsStatus200,
	useGetApiRecommendationsUnits,
	usePutApiRecommendationsExclusionsByUnitId,
} from "@rezics/openapi-tanstack-query";
import { useQueryClient } from "@tanstack/react-query";
import { BookOpenIcon, Ellipsis, EyeOff, Gamepad2Icon, PlaySquareIcon } from "lucide-react";
import { useState } from "react";

import { Button, Menu, MenuContent, MenuItem, MenuTrigger, Skeleton, UnitCard } from "@rezics/ui";
import { recommendationReasonLabel } from "@/features/recommendations/reason";
import { invalidateRecommendationQueries } from "@/features/recommendations/query";
import { useRecommendationTracking } from "@/features/recommendations/tracking";
import { useTranslation } from "@/i18n/client";
import { useLocalizationLanguages } from "@/i18n/use-localization-languages";
import { useHydratedSession } from "@/lib/use-hydrated-session";

type RecommendedUnit = GetApiRecommendationsUnitsStatus200["items"][number];

const UnitIcons = {
	book: BookOpenIcon,
	software: Gamepad2Icon,
	media: PlaySquareIcon,
};

export function UnitShelf({
	type,
	personalized,
	seedUnitId,
}: {
	type: "book" | "software" | "media";
	personalized?: boolean;
	seedUnitId?: string;
}) {
	const { t } = useTranslation(["feed", "state", "ui"]);
	const { data: session } = useHydratedSession();
	const localizationLanguages = useLocalizationLanguages();
	const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set());
	const query = useGetApiRecommendationsUnits({
		query: {
			type,
			limit: 6,
			localizationLanguages,
			...(personalized === undefined ? {} : { personalized }),
			...(seedUnitId ? { seedUnitId } : {}),
		},
	});
	if (query.isPending)
		return (
			<div className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 lg:grid-cols-6">
				{Array.from({ length: 6 }, (_, index) => (
					<Skeleton key={index} className="aspect-[3/4] rounded-xl" />
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
		<div className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 lg:grid-cols-6">
			{items.map((item) => (
				<UnitRecommendationCard
					key={item.id}
					item={item}
					canExclude={Boolean(session)}
					onHiddenChange={(value) => setItemHidden(item.id, value)}
				/>
			))}
		</div>
	);
}

function UnitRecommendationCard({
	item,
	canExclude,
	onHiddenChange,
}: {
	item: RecommendedUnit;
	canExclude: boolean;
	onHiddenChange: (hidden: boolean) => void;
}) {
	const { t } = useTranslation(["feed", "state", "ui"]);
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
		<article className="relative min-w-0" ref={elementRef}>
			<UnitCard
				cover={item.cover}
				description={reason}
				fallback={<UnitIcon aria-hidden className="size-8" />}
				headingAs="h3"
				href={`/units/${item.type}/${item.id}`}
				onClick={trackOpen}
				sizes="(min-width: 1024px) 160px, (min-width: 640px) 30vw, 44vw"
				title={item.title ?? t.ui.unnamed}
			/>
			{canExclude ? (
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
			) : null}
		</article>
	);
}
