"use client";

import {
	getApiRealmsByRealmIdPinsQueryKey,
	usePutApiRealmsByRealmIdPinsByUnitId,
} from "@rezics/openapi-tanstack-query";
import { MenuItem, toast } from "@rezics/ui";
import { useQueryClient } from "@tanstack/react-query";
import { PinIcon, ShieldCheckIcon, TagsIcon } from "lucide-react";

import type { FeedItem } from "@/features/content-feed/components/feed-item-card";
import { useTranslation } from "@/i18n/client";
import { getErrorText } from "@/i18n/errors";
import { useLocalizationLanguages } from "@/i18n/use-localization-languages";

export function RealmFeedManagementActions({
	canModerateUnits,
	canManagePins,
	canManageTags,
	item,
	onAddPolicyTag,
	onModerate,
	realmId,
}: {
	readonly canModerateUnits: boolean;
	readonly canManagePins: boolean;
	readonly canManageTags: boolean;
	readonly item: FeedItem;
	readonly onAddPolicyTag: () => void;
	readonly onModerate: () => void;
	readonly realmId: string;
}) {
	const { t } = useTranslation([
		"betterAuthErrorCodes",
		"errorCodes",
		"errors",
		"realms",
		"state",
		"ui",
	]);
	const queryClient = useQueryClient();
	const localizationLanguages = useLocalizationLanguages();
	const pin = usePutApiRealmsByRealmIdPinsByUnitId();

	async function pinItem() {
		try {
			await pin.mutateAsync({
				path: { realmId, unitId: item.id },
				body: { kind: "pinned" },
			});
			await queryClient.invalidateQueries({
				queryKey: getApiRealmsByRealmIdPinsQueryKey({
					path: { realmId },
					query: { localizationLanguages },
				}),
			});
			toast.create({ title: t.realms.feedManagement.pinned, type: "success" });
		} catch (error) {
			toast.create({
				title: getErrorText(t, error, t.state.error),
				type: "error",
			});
		}
	}

	if (!canModerateUnits && !canManagePins && !canManageTags) return null;
	return (
		<>
			{canModerateUnits ? (
				<MenuItem onSelect={onModerate} value="realm-moderate">
					<ShieldCheckIcon aria-hidden />
					{t.realms.feedManagement.manageContent}
				</MenuItem>
			) : null}
			{canManagePins ? (
				<MenuItem
					disabled={pin.isPending}
					onSelect={() => void pinItem()}
					value="realm-pin"
				>
					<PinIcon aria-hidden />
					{t.realms.feedManagement.pin}
				</MenuItem>
			) : null}
			{canManageTags ? (
				<MenuItem onSelect={onAddPolicyTag} value="realm-policy-tag">
					<TagsIcon aria-hidden />
					{t.realms.feedManagement.addPolicyTagAction}
				</MenuItem>
			) : null}
		</>
	);
}
