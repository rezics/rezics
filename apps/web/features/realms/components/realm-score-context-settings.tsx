"use client";

import {
	getApiRealmsByRealmIdScoreContextQueryKey,
	useDeleteApiRealmsByRealmIdScoreContext,
	useGetApiRealmsByRealmIdScoreContext,
	usePutApiRealmsByRealmIdScoreContext,
} from "@rezics/openapi-tanstack-query";
import {
	Button,
	Card,
	CardContent,
	Dialog,
	DialogClose,
	DialogContent,
	DialogFooter,
	DialogHeader,
	Field,
	FieldDescription,
	FieldLabel,
	QueryFailure,
	QueryPending,
	UnitPicker,
	type EntitySearch,
} from "@rezics/ui";
import { useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { useCallback, useState } from "react";

import { useTranslation } from "@/i18n/client";
import { useLocalizationLanguages } from "@/i18n/use-localization-languages";
import { RequestFailure } from "@/i18n/request-failure";
import {
	RealmScoreContextPostKinds,
	searchRealmScoreContextPosts,
} from "../data/realm-score-context-search";
import { RealmScoreContextPostLink } from "./realm-score-context-link";

export function RealmScoreContextSettings({ realmId }: { readonly realmId: string }) {
	const query = useGetApiRealmsByRealmIdScoreContext({ path: { realmId } });
	if (query.isPending) return <QueryPending />;
	if (query.isError || !query.data)
		return <QueryFailure error={query.error} retry={() => void query.refetch()} />;
	return (
		<RealmScoreContextSettingsForm
			initialContextPostId={query.data.contextPostId}
			key={query.data.contextPostId ?? "not-configured"}
			realmId={realmId}
		/>
	);
}

function RealmScoreContextSettingsForm({
	initialContextPostId,
	realmId,
}: {
	readonly initialContextPostId: string | null;
	readonly realmId: string;
}) {
	const { t } = useTranslation(["realms", "ui"]);
	const queryClient = useQueryClient();
	const save = usePutApiRealmsByRealmIdScoreContext();
	const remove = useDeleteApiRealmsByRealmIdScoreContext();
	const localizationLanguages = useLocalizationLanguages();
	const [contextPostId, setContextPostId] = useState(initialContextPostId ?? undefined);
	const [confirmRemove, setConfirmRemove] = useState(false);
	const search = useCallback<EntitySearch>(
		(_index, query, signal) =>
			searchRealmScoreContextPosts(realmId, query, signal, localizationLanguages),
		[localizationLanguages, realmId],
	);

	async function refreshContext() {
		await queryClient.invalidateQueries({
			queryKey: getApiRealmsByRealmIdScoreContextQueryKey({
				path: { realmId },
			}),
		});
	}

	async function saveContext() {
		if (!contextPostId || contextPostId === initialContextPostId) return;
		try {
			await save.mutateAsync({
				path: { realmId },
				body: { contextPostId },
			});
			await refreshContext();
		} catch {
			// The typed mutation error is rendered below.
		}
	}

	async function removeContext() {
		try {
			await remove.mutateAsync({ path: { realmId } });
			setConfirmRemove(false);
			await refreshContext();
		} catch {
			// The typed mutation error is rendered below.
		}
	}

	const copy = t.realms.scoreContextSettings;
	return (
		<div className="grid gap-4">
			<div className="grid gap-1">
				<h2 className="font-heading font-bold text-xl">{copy.title}</h2>
				<p className="text-muted-foreground text-sm">{copy.description}</p>
			</div>
			<Card appearance="outlined">
				<CardContent className="grid gap-5 p-5">
					<Field>
						<FieldLabel>{copy.post}</FieldLabel>
						<UnitPicker
							ariaLabel={copy.post}
							index="posts"
							kinds={RealmScoreContextPostKinds}
							onValueChange={(value) => {
								setContextPostId(value);
								save.reset();
								remove.reset();
							}}
							placeholder={t.ui.pickerPlaceholders.post}
							search={search}
							value={contextPostId}
						/>
						<FieldDescription>{copy.postHint}</FieldDescription>
					</Field>
					{contextPostId ? (
						<RealmScoreContextPostLink
							contextPostId={contextPostId}
							realmId={realmId}
						/>
					) : (
						<p className="text-muted-foreground text-sm">{copy.notConfigured}</p>
					)}
					<div className="flex flex-wrap justify-between gap-3">
						{initialContextPostId ? (
							<Button onClick={() => setConfirmRemove(true)} variant="outline">
								<Trash2 aria-hidden />
								{copy.remove}
							</Button>
						) : (
							<span />
						)}
						<Button
							disabled={!contextPostId || contextPostId === initialContextPostId}
							isLoading={save.isPending}
							onClick={() => void saveContext()}
						>
							{t.ui.save}
						</Button>
					</div>
					<RequestFailure error={save.error ?? remove.error} />
				</CardContent>
			</Card>
			<Dialog onOpenChange={({ open }) => setConfirmRemove(open)} open={confirmRemove}>
				<DialogContent>
					<DialogHeader description={copy.removeDescription} title={copy.removeTitle} />
					<DialogFooter>
						<DialogClose asChild>
							<Button variant="outline">{copy.cancel}</Button>
						</DialogClose>
						<Button
							isLoading={remove.isPending}
							onClick={() => void removeContext()}
							variant="destructive"
						>
							{copy.remove}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
