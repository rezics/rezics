"use client";

import {
	useDeleteApiUnitsByIdByUnitIdContentStructuresByStructureIdNodesByNodeId,
	useGetApiRealmsByRealmIdTaxonomy,
	usePatchApiUnitsByIdByUnitIdContentStructuresByStructureIdNodesByNodeId,
	usePostApiUnitsByIdByUnitIdContentStructuresByStructureIdNodes,
	usePutApiRealmsByRealmIdPages,
	type GetApiRealmsByRealmIdStatus200,
} from "@rezics/openapi-tanstack-query";
import {
	Button,
	Card,
	CardContent,
	EntityPicker,
	Field,
	FieldContent,
	FieldDescription,
	FieldLabel,
	IdentityAvatar,
	NativeSelect,
	NativeSelectOption,
	QueryFailure,
	QueryPending,
	Switch,
} from "@rezics/ui";
import { ArrowDownIcon, ArrowUpIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { useLocalizationLanguages } from "@/i18n/use-localization-languages";
import { invalidateRealmDetails } from "../query";

type RealmPage = GetApiRealmsByRealmIdStatus200["pages"][number];
type PickedTag = { readonly id: string; readonly label: string };
const QueryStrategyValues = ["global_effective", "realm_community", "realm_policy"] as const;
type QueryStrategy = (typeof QueryStrategyValues)[number];

function isQueryStrategy(value: string): value is QueryStrategy {
	return QueryStrategyValues.some((candidate) => candidate === value);
}

export function RealmPagesSettings({ realm }: { readonly realm: GetApiRealmsByRealmIdStatus200 }) {
	const { t } = useTranslation(["realms", "ui"]);
	const queryClient = useQueryClient();
	const save = usePutApiRealmsByRealmIdPages();
	const [pages, setPages] = useState<RealmPage[]>(() => [...realm.pages]);
	useEffect(() => setPages([...realm.pages]), [realm.pages]);

	function setEnabled(page: Exclude<RealmPage, "main">, enabled: boolean) {
		setPages((current) =>
			enabled
				? current.includes(page)
					? current
					: [...current, page]
				: current.filter((candidate) => candidate !== page),
		);
	}

	function move(page: RealmPage, direction: -1 | 1) {
		setPages((current) => {
			const source = current.indexOf(page);
			const target = source + direction;
			if (source < 0 || target < 0 || target >= current.length) return current;
			const next = [...current];
			[next[source], next[target]] = [next[target]!, next[source]!];
			return next;
		});
	}

	async function savePages() {
		try {
			await save.mutateAsync({
				path: { realmId: realm.id },
				body: { pages, baseRevisionId: realm.latestRevisionId },
			});
			await invalidateRealmDetails(queryClient, realm.id);
		} catch {
			// The typed mutation error is rendered below.
		}
	}

	return (
		<div className="grid gap-4">
			<div className="grid gap-1">
				<h2 className="font-heading font-bold text-xl">{t.realms.pageSettings.title}</h2>
				<p className="text-muted-foreground text-sm">{t.realms.pageSettings.description}</p>
			</div>
			<div className="grid gap-2">
				{pages.map((page, index) => (
					<Card appearance="outlined" key={page}>
						<CardContent className="flex items-center gap-3 p-4">
							<div className="min-w-0 flex-1">
								<p className="font-semibold">{t.realms.pages[page]}</p>
								{page === "main" ? (
									<p className="text-muted-foreground text-xs">
										{t.realms.pageSettings.mainRequired}
									</p>
								) : null}
							</div>
							<Button
								aria-label={t.realms.pageSettings.moveUp}
								disabled={index === 0}
								onClick={() => move(page, -1)}
								size="icon-sm"
								variant="outline"
							>
								<ArrowUpIcon aria-hidden />
							</Button>
							<Button
								aria-label={t.realms.pageSettings.moveDown}
								disabled={index === pages.length - 1}
								onClick={() => move(page, 1)}
								size="icon-sm"
								variant="outline"
							>
								<ArrowDownIcon aria-hidden />
							</Button>
							{page !== "main" ? (
								<Button
									aria-label={t.realms.pageSettings.disable}
									onClick={() => setEnabled(page, false)}
									size="icon-sm"
									variant="quiet"
								>
									<Trash2Icon aria-hidden />
								</Button>
							) : null}
						</CardContent>
					</Card>
				))}
			</div>
			{(["tags", "wiki"] as const).map((page) =>
				pages.includes(page) ? null : (
					<Field
						className="rounded-xl border bg-muted/24 p-4"
						key={page}
						orientation="horizontal"
					>
						<FieldContent>
							<FieldLabel>{t.realms.pages[page]}</FieldLabel>
							<FieldDescription>
								{t.realms.pageSettings.enableDescription}
							</FieldDescription>
						</FieldContent>
						<Switch
							checked={false}
							onCheckedChange={({ checked }) => setEnabled(page, checked === true)}
						/>
					</Field>
				),
			)}
			<div className="flex justify-end">
				<Button isLoading={save.isPending} onClick={() => void savePages()}>
					{t.ui.save}
				</Button>
			</div>
			<RequestFailure error={save.error} />
		</div>
	);
}

export function RealmTaxonomySettings({ realmId }: { readonly realmId: string }) {
	const { t } = useTranslation(["realms", "tags"]);
	const localizationLanguages = useLocalizationLanguages();
	const taxonomy = useGetApiRealmsByRealmIdTaxonomy({
		path: { realmId },
		query: { localizationLanguages },
	});
	const addNode = usePostApiUnitsByIdByUnitIdContentStructuresByStructureIdNodes();
	const updateNode = usePatchApiUnitsByIdByUnitIdContentStructuresByStructureIdNodesByNodeId();
	const deleteNode = useDeleteApiUnitsByIdByUnitIdContentStructuresByStructureIdNodesByNodeId();
	const [selectedTag, setSelectedTag] = useState<PickedTag>();
	const busy = addNode.isPending || updateNode.isPending || deleteNode.isPending;

	async function addTag() {
		if (!selectedTag || !taxonomy.data) return;
		try {
			await addNode.mutateAsync({
				path: { unitId: realmId, structureId: taxonomy.data.structureId },
				body: {
					baseRevisionId: taxonomy.data.latestRevisionId,
					content: { kind: "unit", unitId: selectedTag.id },
					realmTagQueryStrategy: "global_effective",
				},
			});
			setSelectedTag(undefined);
			await taxonomy.refetch();
		} catch {
			// The typed mutation error is rendered below.
		}
	}

	async function updateStrategy(nodeId: string, strategy: QueryStrategy) {
		if (!taxonomy.data) return;
		try {
			await updateNode.mutateAsync({
				path: {
					unitId: realmId,
					structureId: taxonomy.data.structureId,
					nodeId,
				},
				body: {
					baseRevisionId: taxonomy.data.latestRevisionId,
					realmTagQueryStrategy: strategy,
				},
			});
			await taxonomy.refetch();
		} catch {
			// The typed mutation error is rendered below.
		}
	}

	async function removeNode(nodeId: string) {
		if (!taxonomy.data) return;
		try {
			await deleteNode.mutateAsync({
				path: {
					unitId: realmId,
					structureId: taxonomy.data.structureId,
					nodeId,
				},
				body: { baseRevisionId: taxonomy.data.latestRevisionId },
			});
			await taxonomy.refetch();
		} catch {
			// The typed mutation error is rendered below.
		}
	}

	if (taxonomy.isPending) return <QueryPending />;
	if (taxonomy.isError || !taxonomy.data)
		return <QueryFailure error={taxonomy.error} retry={() => void taxonomy.refetch()} />;
	const tagNodes = taxonomy.data.items.filter((item) => item.contentKind === "tag");
	return (
		<div className="grid gap-4">
			<div className="grid gap-1">
				<h2 className="font-heading font-bold text-xl">
					{t.realms.taxonomySettings.title}
				</h2>
				<p className="text-muted-foreground text-sm">
					{t.realms.taxonomySettings.description}
				</p>
			</div>
			<div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
				<EntityPicker index="tags" onChange={setSelectedTag} value={selectedTag} />
				<Button
					disabled={!selectedTag || busy}
					isLoading={addNode.isPending}
					onClick={() => void addTag()}
				>
					<PlusIcon aria-hidden data-icon="inline-start" />
					{t.realms.taxonomySettings.addTag}
				</Button>
			</div>
			{tagNodes.length ? (
				<div className="grid gap-2">
					{tagNodes.map((node) => {
						const title = node.title ?? t.tags.unnamedTag;
						return (
							<Card appearance="outlined" key={node.id}>
								<CardContent className="grid gap-3 p-4 sm:grid-cols-[auto_minmax(0,1fr)_minmax(12rem,auto)_auto] sm:items-center">
									<IdentityAvatar
										avatar={node.avatar}
										className="size-10"
										fallback={
											Array.from(title)[0]?.toLocaleUpperCase() ?? title
										}
									/>
									<div className="min-w-0">
										<p className="truncate font-semibold">{title}</p>
										{node.contextSummary ? (
											<p className="line-clamp-1 text-muted-foreground text-xs">
												{node.contextSummary}
											</p>
										) : null}
									</div>
									<NativeSelect
										aria-label={t.realms.taxonomySettings.queryStrategy}
										disabled={busy}
										onChange={(event) =>
											isQueryStrategy(event.currentTarget.value)
												? void updateStrategy(
														node.id,
														event.currentTarget.value,
													)
												: undefined
										}
										value={node.queryStrategy ?? "global_effective"}
									>
										{QueryStrategyValues.map((strategy) => (
											<NativeSelectOption key={strategy} value={strategy}>
												{t.realms.taxonomy.strategies[strategy].label}
											</NativeSelectOption>
										))}
									</NativeSelect>
									<Button
										aria-label={t.tags.selection.remove}
										disabled={busy}
										onClick={() => void removeNode(node.id)}
										size="icon-sm"
										variant="quiet"
									>
										<Trash2Icon aria-hidden />
									</Button>
								</CardContent>
							</Card>
						);
					})}
				</div>
			) : (
				<p className="text-muted-foreground text-sm">{t.realms.taxonomySettings.empty}</p>
			)}
			<RequestFailure error={addNode.error ?? updateNode.error ?? deleteNode.error} />
		</div>
	);
}
