"use client";

import { useGetApiScoresByTargetId } from "@rezics/openapi-tanstack-query";
import { Card, CardContent, CardHeader } from "@rezics/ui";

import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { toFiniteApiNumber, toNonNegativeApiInteger } from "@/lib/api-number";
import { RealmScoreContextLink } from "@/features/realms/components/realm-score-context-link";

export function ScoreOverview({ realmId, targetId }: { realmId: string; targetId: string }) {
	const query = useGetApiScoresByTargetId({
		path: { targetId },
		query: { realmId },
	});
	const { t } = useTranslation(["engagement", "ui"]);
	const count = toNonNegativeApiInteger(query.data?.totalCount);
	const average = count ? (toFiniteApiNumber(query.data?.totalScore) ?? 0) / count : 0;
	return (
		<Card>
			<CardHeader title={t.engagement.scoreAverage} />
			<CardContent className="grid gap-4">
				{query.isPending ? (
					<p className="text-sm text-muted-foreground">{t.ui.loading}</p>
				) : query.data ? (
					<>
						<p className="font-heading text-3xl font-black tabular-nums">
							{average.toFixed(1)}
							<span className="ms-2 font-sans text-sm font-normal text-muted-foreground">
								{count} {t.engagement.scoreCount}
							</span>
						</p>
						<div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
							{Array.from({ length: 10 }, (_, index) => index + 1).map((score) => (
								<div
									className="grid justify-items-center gap-1 rounded-lg bg-surface-muted px-2 py-2 text-xs"
									key={score}
								>
									<strong>{score}</strong>
									<span className="text-muted-foreground">
										{toNonNegativeApiInteger(query.data.distribution[String(score)])}
									</span>
								</div>
							))}
						</div>
						<RealmScoreContextLink realmId={realmId} />
					</>
				) : null}
				<RequestFailure error={query.error} fallback={t.ui.retryLater} />
			</CardContent>
		</Card>
	);
}
