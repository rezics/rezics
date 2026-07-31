"use client";

import { useGetApiRealmsByRealmIdScoreContext } from "@rezics/openapi-tanstack-query";
import { Button, Card, CardContent } from "@rezics/ui";
import { BookOpenText } from "lucide-react";

import { AppLink as Link } from "@/features/application-shell/components/app-link";
import { realmSettingsHref, type AddressableUnit } from "@/features/slugs/unit-route";
import { useTranslation } from "@/i18n/client";
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
	const contextPostId = query.data?.contextPostId;
	if (!contextPostId) return null;
	const copy = t.realms.scoreContextSettings;
	return (
		<Card appearance="outlined" className="min-w-0 max-w-full overflow-hidden">
			<CardContent className="grid min-w-0 gap-3 overflow-hidden px-5">
				<div className="flex items-center justify-between gap-3">
					<h2 className="font-serif font-semibold text-lg">{copy.title}</h2>
					<BookOpenText aria-hidden className="size-4 text-brand" />
				</div>
				<RealmScoreContextPostLink contextPostId={contextPostId} realmId={realm.id} />
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
