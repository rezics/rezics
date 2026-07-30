"use client";

import {
	getApiRealmsByRealmIdPinsQueryKey,
	usePutApiRealmsByRealmIdPinsByUnitId,
	usePutApiRealmsByRealmIdUnitsByUnitIdPolicyTagsByTagId,
} from "@rezics/openapi-tanstack-query";
import {
	Button,
	Dialog,
	DialogBody,
	DialogContent,
	DialogFooter,
	DialogHeader,
	EntityPicker,
	MenuItem,
	toast,
} from "@rezics/ui";
import { useQueryClient } from "@tanstack/react-query";
import { PinIcon, TagsIcon } from "lucide-react";
import { useState } from "react";

import type { FeedItem } from "@/features/content-feed/components/feed-item-card";
import { FeedQueryKey } from "@/features/content-feed/query";
import { useTranslation } from "@/i18n/client";
import { getErrorText } from "@/i18n/errors";
import { useLocalizationLanguages } from "@/i18n/use-localization-languages";
import { RequestFailure } from "@/i18n/request-failure";

type PickedTag = { readonly id: string; readonly label: string };

export function RealmFeedManagementActions({
	canManagePins,
	canManageTags,
	item,
	realmId,
}: {
	readonly canManagePins: boolean;
	readonly canManageTags: boolean;
	readonly item: FeedItem;
	readonly realmId: string;
}) {
	const { t } = useTranslation([
		"betterAuthErrorCodes",
		"errorCodes",
		"errors",
		"realms",
		"state",
	]);
	const queryClient = useQueryClient();
	const localizationLanguages = useLocalizationLanguages();
	const pin = usePutApiRealmsByRealmIdPinsByUnitId();
	const addPolicyTag = usePutApiRealmsByRealmIdUnitsByUnitIdPolicyTagsByTagId();
	const [policyDialogOpen, setPolicyDialogOpen] = useState(false);
	const [selectedTag, setSelectedTag] = useState<PickedTag>();

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

	async function applyPolicyTag() {
		if (!selectedTag) return;
		try {
			await addPolicyTag.mutateAsync({
				path: { realmId, unitId: item.id, tagId: selectedTag.id },
				body: {},
			});
			await queryClient.invalidateQueries({ queryKey: FeedQueryKey });
			setPolicyDialogOpen(false);
			setSelectedTag(undefined);
			toast.create({ title: t.realms.feedManagement.policyTagAdded, type: "success" });
		} catch {
			// The typed mutation state renders the localized request failure below.
		}
	}

	if (!canManagePins && !canManageTags) return null;
	return (
		<>
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
				<MenuItem onSelect={() => setPolicyDialogOpen(true)} value="realm-policy-tag">
					<TagsIcon aria-hidden />
					{t.realms.feedManagement.addPolicyTag}
				</MenuItem>
			) : null}
			<Dialog
				onOpenChange={({ open }) => {
					setPolicyDialogOpen(open);
					if (!open) setSelectedTag(undefined);
				}}
				open={policyDialogOpen}
			>
				<DialogContent size="sm">
					<DialogHeader
						description={t.realms.feedManagement.policyTagDescription}
						title={t.realms.feedManagement.addPolicyTag}
					/>
					<DialogBody className="grid gap-3">
						<EntityPicker index="tags" onChange={setSelectedTag} value={selectedTag} />
						<RequestFailure error={addPolicyTag.error} />
					</DialogBody>
					<DialogFooter>
						<Button onClick={() => setPolicyDialogOpen(false)} variant="secondary">
							{t.realms.rulesCancel}
						</Button>
						<Button
							disabled={!selectedTag}
							isLoading={addPolicyTag.isPending}
							onClick={() => void applyPolicyTag()}
						>
							{t.realms.feedManagement.applyPolicyTag}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}
