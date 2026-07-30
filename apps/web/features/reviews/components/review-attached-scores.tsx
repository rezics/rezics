"use client";

import type { GetApiPostsByPostIdStatus200 } from "@rezics/openapi-tanstack-query";
import { StarIcon } from "lucide-react";

import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
	Item,
	ItemActions,
	ItemContent,
	ItemGroup,
	ItemTitle,
} from "@rezics/ui";
import { AppLink as Link } from "@/features/application-shell/components/app-link";
import { realmHref } from "@/features/slugs/unit-route";
import { useTranslation } from "@/i18n/client";
import { apiValueToUnitScore } from "../model/score-value";

type ReviewPost = Extract<GetApiPostsByPostIdStatus200, { postKind: "review" }>;
type AttachedScore = ReviewPost["scores"][number];

export function ReviewAttachedScores({
	reviewId,
	scores,
}: {
	readonly reviewId: string;
	readonly scores: readonly AttachedScore[];
}) {
	const { t } = useTranslation(["engagement"]);
	const presentedScores = scores.flatMap((score) => {
		const value = apiValueToUnitScore(score.value);
		return value === undefined ? [] : [{ score, value }];
	});
	if (presentedScores.length === 0) return null;

	const titleId = `review-scores-${reviewId}`;
	return (
		<Card asChild>
			<section aria-labelledby={titleId}>
				<CardHeader>
					<CardTitle asChild>
						<h2 id={titleId}>{t.engagement.reviewScore}</h2>
					</CardTitle>
				</CardHeader>
				<CardContent>
					<ItemGroup>
						{presentedScores.map(({ score, value }) => {
							const realmLabel = score.realmTitle ?? score.realmId;
							return (
								<Item
									aria-label={t.engagement.scoreAssociationOption({
										realm: realmLabel,
										score: String(value),
									})}
									key={score.scoreId}
									role="listitem"
									variant="muted"
								>
									<ItemContent className="min-w-0">
										<ItemTitle className="min-w-0">
											<Link
												className="truncate underline-offset-4 hover:underline"
												href={realmHref({ id: score.realmId })}
											>
												{realmLabel}
											</Link>
										</ItemTitle>
									</ItemContent>
									<ItemActions className="shrink-0 gap-1.5">
										<StarIcon
											aria-hidden
											className="size-4 fill-warning text-warning"
										/>
										<span className="font-semibold tabular-nums">
											{t.engagement.scoreOutOfTen({ score: String(value) })}
										</span>
									</ItemActions>
								</Item>
							);
						})}
					</ItemGroup>
				</CardContent>
			</section>
		</Card>
	);
}
