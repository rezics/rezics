"use client";

import { useGetApiUnitsByTypeByUnitId } from "@rezics/openapi-tanstack-query";
import { Button, Card, CardContent, PageHeading, QueryFailure, QueryPending } from "@rezics/ui";
import { ArrowLeft } from "lucide-react";

import { AppLink as Link } from "@/features/application-shell/components/app-link";
import { SignInButton } from "@/features/auth/auth-portal";
import { UnitExcerptFeed } from "@/features/posts/components/unit-excerpt-feed";
import { SubjectPostComposer } from "@/features/posts/subject-post-composer";
import { useTranslation } from "@/i18n/client";
import { useLocalizationLanguages } from "@/i18n/use-localization-languages";
import { selectLocalization } from "@/lib/localization";
import { useHydratedSession } from "@/lib/use-hydrated-session";
import type { UnitDetailUnitType } from "../model/unit-detail-section";
import { isUnitDetailUnitFor } from "../model/unit-detail-unit";
import { unitDetailHref } from "../routing/unit-detail-routes";

export function UnitExcerptsPage({
	type,
	unitId,
}: {
	readonly type: UnitDetailUnitType;
	readonly unitId: string;
}) {
	const { t } = useTranslation(["actions", "engagement", "ui", "units"]);
	const localizationLanguages = useLocalizationLanguages();
	const { data: session } = useHydratedSession();
	const query = useGetApiUnitsByTypeByUnitId({
		path: { type, unitId },
		query: { localizationLanguages },
	});
	if (query.isPending) return <QueryPending />;
	if (query.isError || !query.data)
		return <QueryFailure error={query.error} retry={() => void query.refetch()} />;
	if (!isUnitDetailUnitFor(query.data, type))
		return (
			<QueryFailure
				error={new Error("Unit Unit type mismatch")}
				retry={() => void query.refetch()}
			/>
		);
	const localization = selectLocalization(
		query.data.localizations,
		query.data.language,
		query.data.language,
	);

	return (
		<main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-6 sm:px-6 sm:py-10">
			<Button asChild className="w-fit" variant="outline">
				<Link href={unitDetailHref(type, unitId)}>
					<ArrowLeft aria-hidden />
					{t.units.detail.backToOverview}
				</Link>
			</Button>
			<PageHeading
				description={localization?.title ?? t.ui.unnamed}
				title={t.engagement.excerpts}
			/>
			<p className="-mt-5 max-w-3xl text-sm leading-6 text-muted-foreground">
				{t.engagement.excerptPageDescription}
			</p>
			<Card>
				<CardContent className="p-5 sm:p-6">
					{session ? (
						<SubjectPostComposer postKind="excerpt" subjectId={unitId} />
					) : (
						<SignInButton
							className="h-11 w-full justify-start rounded-xl text-muted-foreground"
							variant="outline"
						>
							{t.actions.login}
						</SignInButton>
					)}
				</CardContent>
			</Card>
			<UnitExcerptFeed targetId={unitId} />
		</main>
	);
}
