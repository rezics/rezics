"use client";

import { useGetApiRealmsByRealmIdUnitsByUnitId } from "@rezics/openapi-tanstack-query";
import { Button, Sheet, SheetBody, SheetContent, SheetHeader, Skeleton } from "@rezics/ui";

import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { useLocalizationLanguages } from "@/i18n/use-localization-languages";
import { RealmModerationSheet } from "./realm-moderation-sheet";

export function RealmFeedModerationSheet({
	onOpenChange,
	realmId,
	target,
}: {
	readonly onOpenChange: (open: boolean) => void;
	readonly realmId: string;
	readonly target: Readonly<{ id: string; title: string | null }>;
}) {
	const { t } = useTranslation(["actions", "posts", "realms", "state"]);
	const localizationLanguages = useLocalizationLanguages();
	const query = useGetApiRealmsByRealmIdUnitsByUnitId({
		path: { realmId, unitId: target.id },
		query: { localizationLanguages },
	});
	if (query.data)
		return <RealmModerationSheet onOpenChange={onOpenChange} realmId={realmId} unit={query.data} />;

	const title = target.title ?? t.posts.untitled;
	const copy = t.realms.feedManagement;
	return (
		<Sheet onOpenChange={({ open }) => onOpenChange(open)} open>
			<SheetContent className="sm:max-w-2xl" placement="right">
				<SheetHeader
					description={query.isPending ? copy.loadingModeration : copy.moderationLoadFailed}
					title={title}
				/>
				<SheetBody>
					{query.isPending ? (
						<div aria-busy="true" className="grid gap-4">
							<Skeleton className="h-24 rounded-xl" />
							<Skeleton className="h-48 rounded-xl" />
						</div>
					) : (
						<div className="grid justify-items-start gap-3">
							<RequestFailure error={query.error} fallback={t.state.error} />
							<Button
								onClick={() => void query.refetch()}
								size="sm"
								type="button"
								variant="outline"
							>
								{t.actions.retry}
							</Button>
						</div>
					)}
				</SheetBody>
			</SheetContent>
		</Sheet>
	);
}
