"use client";

import {
	useGetApiRealmsByRealmIdTaxonomyDraft,
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
	Skeleton,
	toast,
	type EntityPickerValue,
	type EntitySearch,
} from "@rezics/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";

import { AppLink as Link } from "@/features/application-shell/components/app-link";
import { FeedQueryKey } from "@/features/content-feed/query";
import { realmSettingsHref } from "@/features/slugs/unit-route";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { useLocalizationLanguages } from "@/i18n/use-localization-languages";
import { realmPolicyTagCandidates } from "../model/realm-policy-tags";
import { realmSettingsSectionHref } from "../routing/realm-settings-routes";

const PolicyTagSearchLimit = 50;

export function RealmPolicyTagDialog({
	onOpenChange,
	open,
	realmId,
	unitId,
}: {
	readonly onOpenChange: (open: boolean) => void;
	readonly open: boolean;
	readonly realmId: string;
	readonly unitId: string;
}) {
	const { locale, t } = useTranslation([
		"actions",
		"betterAuthErrorCodes",
		"errorCodes",
		"errors",
		"realms",
		"state",
		"tags",
		"ui",
	]);
	const queryClient = useQueryClient();
	const localizationLanguages = useLocalizationLanguages();
	const taxonomy = useGetApiRealmsByRealmIdTaxonomyDraft(
		{
			path: { realmId },
			query: { localizationLanguages },
		},
		{ query: { enabled: open } },
	);
	const addPolicyTag = usePutApiRealmsByRealmIdUnitsByUnitIdPolicyTagsByTagId();
	const [selectedTag, setSelectedTag] = useState<EntityPickerValue>();
	const policyTags = useMemo(
		() => realmPolicyTagCandidates(taxonomy.data?.items ?? [], unitId, t.tags.unnamedTag),
		[t.tags.unnamedTag, taxonomy.data?.items, unitId],
	);
	const selectedPolicyTag = selectedTag
		? policyTags.find(({ id }) => id === selectedTag.id)
		: undefined;
	const searchPolicyTags = useCallback<EntitySearch>(
		(_index, query, signal) => {
			if (signal.aborted) return Promise.resolve([]);
			const normalizedQuery = query.trim().toLocaleLowerCase(locale.target);
			const matches = normalizedQuery
				? policyTags.filter((item) =>
						item.label.toLocaleLowerCase(locale.target).includes(normalizedQuery),
					)
				: policyTags;
			return Promise.resolve(matches.slice(0, PolicyTagSearchLimit));
		},
		[locale.target, policyTags],
	);

	function changeOpen(nextOpen: boolean) {
		if (!nextOpen && addPolicyTag.isPending) return;
		if (!nextOpen) setSelectedTag(undefined);
		onOpenChange(nextOpen);
	}

	async function applyPolicyTag() {
		if (!selectedPolicyTag) return;
		try {
			await addPolicyTag.mutateAsync({
				path: { realmId, unitId, tagId: selectedPolicyTag.id },
				body: {},
			});
			await queryClient.invalidateQueries({ queryKey: FeedQueryKey });
			changeOpen(false);
			toast.create({ title: t.realms.feedManagement.policyTagAdded, type: "success" });
		} catch {
			// The typed mutation state renders the localized request failure below.
		}
	}

	const copy = t.realms.feedManagement;
	const settingsHref = realmSettingsSectionHref(realmSettingsHref({ id: realmId }), "tags");
	return (
		<Dialog onOpenChange={({ open: nextOpen }) => changeOpen(nextOpen)} open={open}>
			<DialogContent showCloseButton={!addPolicyTag.isPending} size="sm">
				<DialogHeader description={copy.policyTagDescription} title={copy.addPolicyTag} />
				<DialogBody className="grid gap-3">
					{taxonomy.isPending ? (
						<div aria-busy="true" className="grid gap-3">
							<Skeleton className="h-10 rounded-lg" />
							<Skeleton className="h-16 rounded-lg" />
						</div>
					) : taxonomy.isError || !taxonomy.data ? (
						<div className="grid justify-items-start gap-3">
							<RequestFailure error={taxonomy.error} fallback={t.state.error} />
							<Button
								onClick={() => void taxonomy.refetch()}
								size="sm"
								type="button"
								variant="outline"
							>
								{t.actions.retry}
							</Button>
						</div>
					) : policyTags.length === 0 ? (
						<div className="grid justify-items-start gap-3 rounded-lg border border-dashed p-4">
							<p className="text-muted-foreground text-sm">{copy.policyTagsEmpty}</p>
							<Button asChild size="sm" variant="outline">
								<Link href={settingsHref}>{copy.configurePolicyTags}</Link>
							</Button>
						</div>
					) : (
						<>
							<EntityPicker
								ariaLabel={copy.addPolicyTag}
								index="tags"
								onChange={setSelectedTag}
								placeholder={t.ui.pickerPlaceholders.tag}
								search={searchPolicyTags}
								searchOnOpen
								value={selectedPolicyTag}
							/>
							<RequestFailure error={addPolicyTag.error} />
						</>
					)}
				</DialogBody>
				<DialogFooter>
					<Button
						disabled={addPolicyTag.isPending}
						onClick={() => changeOpen(false)}
						type="button"
						variant="secondary"
					>
						{t.realms.rulesCancel}
					</Button>
					{taxonomy.data && policyTags.length > 0 ? (
						<Button
							disabled={!selectedPolicyTag}
							isLoading={addPolicyTag.isPending}
							onClick={() => void applyPolicyTag()}
							type="button"
						>
							{copy.applyPolicyTag}
						</Button>
					) : null}
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
