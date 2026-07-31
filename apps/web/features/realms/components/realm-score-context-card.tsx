"use client";

import { useGetApiRealmsByRealmIdScoreContext } from "@rezics/openapi-tanstack-query";
import { Button, Card, CardContent, Skeleton } from "@rezics/ui";
import { BookOpenText } from "lucide-react";

import { AppLink as Link } from "@/features/application-shell/components/app-link";
import { realmSettingsHref, type AddressableUnit } from "@/features/slugs/unit-route";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { realmSettingsSectionHref } from "../routing/realm-settings-routes";
import { RealmScoreContextPostLink } from "./realm-score-context-link";

export function RealmScoreContextCard({
	canManage,
	realm,
}: {
	readonly canManage: boolean;
	readonly realm: AddressableUnit;
}) {
	const query = useGetApiRealmsByRealmIdScoreContext({ path: { realmId: realm.id } });
	const { t } = useTranslation(["realms"]);
	const copy = t.realms.scoreContextSettings;
	return (
		<Card appearance="outlined" className="min-w-0 max-w-full overflow-hidden">
			<CardContent className="grid min-w-0 gap-3 overflow-hidden px-5">
				<div className="flex items-center justify-between gap-3">
					<h2 className="font-serif font-semibold text-lg">{copy.title}</h2>
					<BookOpenText aria-hidden className="size-4 text-brand" />
				</div>
				{query.isPending ? (
					<Skeleton className="h-5 w-40 max-w-full" />
				) : query.isError || !query.data ? (
					<RequestFailure error={query.error} />
				) : query.data.contextPostId ? (
					<RealmScoreContextPostLink
						contextPostId={query.data.contextPostId}
						realmId={realm.id}
					/>
				) : (
					<p className="text-muted-foreground text-sm">{copy.notConfigured}</p>
				)}
				{canManage ? (
					<Button asChild className="w-fit px-0" size="sm" variant="quiet">
						<Link href={realmSettingsSectionHref(realmSettingsHref(realm), "scoring")}>
							{t.realms.settings}
						</Link>
					</Button>
				) : null}
			</CardContent>
		</Card>
	);
}
