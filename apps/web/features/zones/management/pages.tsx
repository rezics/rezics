"use client";

import {
	UnitReferencedBlockDocument,
	createUnitReferencedBlockDocument,
	isDocument,
	parseDocument,
	type UnitReferencedBlockDocument as UnitReferencedBlockDocumentValue,
} from "@rezics/block";
import {
	getApiZonesByZoneIdPagesQueryKey,
	type GetApiZonesByZoneIdPagesStatus200,
	useDeleteApiZonesByZoneIdPagesByPageIdPlacement,
	useGetApiZonesByZoneIdPages,
	usePostApiZonesByZoneIdPages,
	usePutApiZonesByZoneIdPagesByPageId,
	usePutApiZonesByZoneIdPagesByPageIdPlacement,
} from "@rezics/openapi-tanstack-query";
import { ZoneHomePageSlug } from "@rezics/slug";
import {
	Button,
	Card,
	CardContent,
	Checkbox,
	createTreeCollection,
	Field,
	FieldGroup,
	FieldLabel,
	Input,
	ManagementWorkspaceSectionHeader,
	NativeSelect,
	NativeSelectOption,
	QueryFailure,
	QueryPending,
	TreeEditor,
	TreeViewBranch,
	TreeViewBranchContent,
	TreeViewBranchItem,
	TreeViewContent,
	TreeViewItem,
	TreeViewNode,
	type TreeNodeType,
} from "@rezics/ui";
import { useQueryClient } from "@tanstack/react-query";
import { generateKeyBetween } from "fractional-indexing";
import { ArrowDown, ArrowUp, FileText, Home, Plus } from "lucide-react";
import { AppLink as Link } from "@/features/application-shell/components/app-link";
import { useMemo, useState, type FormEvent } from "react";

import { BlockDocumentEditor } from "@/features/blocks/block-document-editor";
import { ContentLanguageControl } from "@/features/content-languages/components/content-language-control";
import { ContentLanguageEditorBoundary } from "@/features/content-languages/components/content-language-editor-boundary";
import { LocalizedDraftGate } from "@/features/content-languages/components/localized-draft-gate";
import {
	useContentLanguageEditor,
	useLocalizedDraft,
	type LocalizedDraftCodec,
} from "@/features/content-languages/hooks/use-content-language-editor";
import {
	decodeDraftBoolean,
	decodeDraftString,
	isDraftRecord,
} from "@/features/content-languages/model/localized-draft-codec";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { zoneManagementHref } from "./model";
import { useZoneManagement } from "./workspace";

type Page = GetApiZonesByZoneIdPagesStatus200["items"][number];
type Placement = NonNullable<Page["placement"]>;
type PlacedPage = Page & { readonly placement: Placement };

type ZonePageLocalizationDraft = {
	readonly title: string;
	readonly document: UnitReferencedBlockDocumentValue;
};

type ZonePageSharedDraft = {
	readonly slug: string;
	readonly parentPageId: string;
	readonly home: boolean;
	readonly indexed: boolean;
};

const ZonePageLocalizationDraftCodec: LocalizedDraftCodec<ZonePageLocalizationDraft> = {
	version: 1,
	decode(value) {
		if (!isDraftRecord(value)) return;
		const title = decodeDraftString(value.title);
		if (title === undefined || !isDocument(UnitReferencedBlockDocument, value.document)) return;
		return { title, document: value.document };
	},
};

const ZonePageSharedDraftCodec: LocalizedDraftCodec<ZonePageSharedDraft> = {
	version: 1,
	decode(value) {
		if (!isDraftRecord(value)) return;
		const slug = decodeDraftString(value.slug);
		const parentPageId = decodeDraftString(value.parentPageId);
		const home = decodeDraftBoolean(value.home);
		const indexed = decodeDraftBoolean(value.indexed);
		return slug === undefined ||
			parentPageId === undefined ||
			home === undefined ||
			indexed === undefined
			? undefined
			: { slug, parentPageId, home, indexed };
	},
};

interface PageTreeNode extends TreeNodeType {
	readonly page: PlacedPage | null;
	readonly children?: PageTreeNode[];
}

function isPlacedPage(page: Page): page is PlacedPage {
	return page.placement !== null;
}

function toPageTree(
	pages: readonly PlacedPage[],
	parentPageId: string | null = null,
): PageTreeNode[] {
	return pages
		.filter((page) => page.placement.parentPageId === parentPageId)
		.toSorted((left, right) => left.placement.position.localeCompare(right.placement.position))
		.map((page) => {
			const children = toPageTree(pages, page.id);
			return {
				id: page.id,
				name: page.title,
				page,
				...(children.length ? { children } : {}),
			};
		});
}

function expandedIds(nodes: readonly PageTreeNode[]): string[] {
	return nodes.flatMap((node) =>
		node.children?.length ? [node.id, ...expandedIds(node.children)] : [],
	);
}

function descendantPageIds(pages: readonly PlacedPage[], pageId: string): ReadonlySet<string> {
	const descendants = new Set<string>();
	const visit = (parentId: string) => {
		for (const page of pages)
			if (page.placement.parentPageId === parentId && !descendants.has(page.id)) {
				descendants.add(page.id);
				visit(page.id);
			}
	};
	visit(pageId);
	return descendants;
}

function nextPosition(pages: readonly PlacedPage[], parentPageId: string | null): string {
	const last = pages
		.filter((page) => page.placement.parentPageId === parentPageId)
		.toSorted((left, right) => left.placement.position.localeCompare(right.placement.position))
		.at(-1);
	return generateKeyBetween(last?.placement.position ?? null, null);
}

export function ZonePagesManagement() {
	const { zoneId } = useZoneManagement();
	const { t } = useTranslation(["errors", "locale", "ui", "zones"]);
	const query = useGetApiZonesByZoneIdPages({ path: { zoneId } });
	const queryClient = useQueryClient();
	const invalidate = () =>
		queryClient.invalidateQueries({
			queryKey: getApiZonesByZoneIdPagesQueryKey({ path: { zoneId } }),
		});
	const move = usePutApiZonesByZoneIdPagesByPageIdPlacement({
		mutation: { onSuccess: invalidate },
	});
	const [selectedId, setSelectedId] = useState<string | "new">("new");
	if (query.isPending) return <QueryPending />;
	if (query.isError) return <QueryFailure error={query.error} retry={() => void query.refetch()} />;

	const pages = query.data.items;
	const placedPages = pages.filter(isPlacedPage);
	const unplacedPages = pages.filter((page) => !page.placement);
	const selected = pages.find((page) => page.id === selectedId);

	return (
		<section>
			<ManagementWorkspaceSectionHeader
				action={
					<Button onClick={() => setSelectedId("new")} size="sm" type="button">
						<Plus aria-hidden /> {t.zones.management.pages.newPage}
					</Button>
				}
				backHref={zoneManagementHref(zoneId)}
				backLabel={t.zones.management.title}
				description={t.zones.management.sections.pages.description}
				link={Link}
				title={t.zones.management.sections.pages.label}
			/>
			<div className="grid gap-6 lg:grid-cols-[minmax(15rem,0.7fr)_minmax(0,1.3fr)]">
				<Card appearance="outlined">
					<CardContent className="grid gap-5 p-4">
						{placedPages.length ? (
							<PageTree
								onMove={async (page, direction) => {
									const siblings = placedPages
										.filter(
											(candidate) =>
												candidate.placement.parentPageId === page.placement.parentPageId,
										)
										.toSorted((left, right) =>
											left.placement.position.localeCompare(right.placement.position),
										);
									const index = siblings.findIndex((candidate) => candidate.id === page.id);
									if (index < 0) return;
									const position =
										direction === -1
											? generateKeyBetween(
													siblings[index - 2]?.placement.position ?? null,
													siblings[index - 1]?.placement.position ?? null,
												)
											: generateKeyBetween(
													siblings[index + 1]?.placement.position ?? null,
													siblings[index + 2]?.placement.position ?? null,
												);
									try {
										await move.mutateAsync({
											path: { zoneId, pageId: page.id },
											body: {
												baseStructureRevisionId: page.placement.latestStructureRevisionId,
												parentPageId: page.placement.parentPageId,
												position,
											},
										});
									} catch {
										// Typed mutation state supplies the visible request failure.
									}
								}}
								pages={placedPages}
								pending={move.isPending}
								selectedId={selected?.id}
								setSelectedId={setSelectedId}
							/>
						) : pages.length ? null : (
							<p className="text-sm text-muted-foreground">{t.zones.management.pages.empty}</p>
						)}
						{unplacedPages.length ? (
							<div className="grid gap-2">
								<p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
									{t.zones.management.pages.notIndexed}
								</p>
								{unplacedPages.map((page) => (
									<button
										className={
											selected?.id === page.id
												? "flex items-center gap-2 rounded-md bg-accent px-2 py-1.5 text-start font-semibold text-primary text-sm"
												: "flex items-center gap-2 rounded-md px-2 py-1.5 text-start text-sm hover:bg-accent"
										}
										key={page.id}
										onClick={() => setSelectedId(page.id)}
										type="button"
									>
										{page.home ? <Home aria-hidden className="size-4" /> : null}
										<span className="truncate">{page.title}</span>
									</button>
								))}
							</div>
						) : null}
						<RequestFailure error={move.error} fallback={t.ui.retryLater} />
					</CardContent>
				</Card>
				{selected ? (
					<ContentLanguageEditorBoundary onLanguagesChanged={invalidate} unitId={selected.id}>
						<PageEditorForLanguage
							onSaved={setSelectedId}
							page={selected}
							pageStructureRevisionId={query.data.pageStructure?.latestRevisionId}
							pages={pages}
							placedPages={placedPages}
							zoneId={zoneId}
						/>
					</ContentLanguageEditorBoundary>
				) : (
					<PageEditorForLanguage
						onSaved={setSelectedId}
						pageStructureRevisionId={query.data.pageStructure?.latestRevisionId}
						pages={pages}
						placedPages={placedPages}
						zoneId={zoneId}
					/>
				)}
			</div>
		</section>
	);
}

function PageTree({
	pages,
	pending,
	onMove,
	selectedId,
	setSelectedId,
}: {
	readonly pages: readonly PlacedPage[];
	readonly pending: boolean;
	readonly onMove: (page: PlacedPage, direction: -1 | 1) => Promise<void>;
	readonly selectedId?: string;
	readonly setSelectedId: (id: string) => void;
}) {
	const { t } = useTranslation("zones");
	const nodes = useMemo(() => toPageTree(pages), [pages]);
	const rootNode: PageTreeNode = { id: "zone-page-root", name: "", page: null, children: nodes };
	const collection = createTreeCollection<PageTreeNode>({ rootNode });
	return (
		<TreeEditor
			collection={collection}
			defaultExpandedValue={expandedIds(nodes)}
			label={t.management.pages.pageTree}
			renderNode={(node, indexPath) => (
				<PageTreeRow
					indexPath={indexPath}
					key={node.id}
					node={node}
					onMove={onMove}
					pages={pages}
					pending={pending}
					selectedId={selectedId}
					setSelectedId={setSelectedId}
				/>
			)}
		/>
	);
}

function PageTreeRow({
	node,
	indexPath,
	onMove,
	pages,
	pending,
	selectedId,
	setSelectedId,
}: {
	readonly node: PageTreeNode;
	readonly indexPath: number[];
	readonly onMove: (page: PlacedPage, direction: -1 | 1) => Promise<void>;
	readonly pages: readonly PlacedPage[];
	readonly pending: boolean;
	readonly selectedId?: string;
	readonly setSelectedId: (id: string) => void;
}) {
	const { t } = useTranslation("zones");
	if (!node.page) return null;
	const siblings = pages
		.filter((candidate) => candidate.placement.parentPageId === node.page?.placement.parentPageId)
		.toSorted((left, right) => left.placement.position.localeCompare(right.placement.position));
	const siblingIndex = siblings.findIndex((candidate) => candidate.id === node.page?.id);
	const label = (
		<div className="flex w-full items-center gap-1">
			<button
				className="flex min-w-0 flex-1 items-center gap-2 text-start"
				onClick={() => setSelectedId(node.page!.id)}
				type="button"
			>
				{node.page.home ? <Home aria-hidden className="size-4" /> : null}
				<span
					className={
						selectedId === node.page.id ? "truncate font-semibold text-primary" : "truncate"
					}
				>
					{node.page.title}
				</span>
			</button>
			<Button
				aria-label={t.management.blocks.moveUp}
				disabled={pending || siblingIndex <= 0}
				onClick={(event) => {
					event.stopPropagation();
					void onMove(node.page!, -1);
				}}
				size="icon-xs"
				type="button"
				variant="quiet"
			>
				<ArrowUp aria-hidden />
			</Button>
			<Button
				aria-label={t.management.blocks.moveDown}
				disabled={pending || siblingIndex < 0 || siblingIndex >= siblings.length - 1}
				onClick={(event) => {
					event.stopPropagation();
					void onMove(node.page!, 1);
				}}
				size="icon-xs"
				type="button"
				variant="quiet"
			>
				<ArrowDown aria-hidden />
			</Button>
		</div>
	);
	return (
		<TreeViewNode indexPath={indexPath} node={node}>
			{node.children?.length ? (
				<TreeViewBranch>
					<TreeViewBranchItem expandedIcon={FileText} icon={FileText}>
						{label}
					</TreeViewBranchItem>
					<TreeViewBranchContent>
						{node.children.map((child, index) => (
							<PageTreeRow
								indexPath={[...indexPath, index]}
								key={child.id}
								node={child}
								onMove={onMove}
								pages={pages}
								pending={pending}
								selectedId={selectedId}
								setSelectedId={setSelectedId}
							/>
						))}
					</TreeViewBranchContent>
				</TreeViewBranch>
			) : (
				<TreeViewContent>
					<TreeViewItem icon={FileText}>{label}</TreeViewItem>
				</TreeViewContent>
			)}
		</TreeViewNode>
	);
}

function PageEditorForLanguage(props: Parameters<typeof PageEditor>[0]) {
	const { selectedLanguage } = useContentLanguageEditor();
	return <PageEditor key={`${props.page?.id ?? "new"}:${selectedLanguage}`} {...props} />;
}

function PageEditor({
	page,
	pageStructureRevisionId,
	pages,
	placedPages,
	zoneId,
	onSaved,
}: {
	readonly page?: Page;
	readonly pageStructureRevisionId?: string;
	readonly pages: readonly Page[];
	readonly placedPages: readonly PlacedPage[];
	readonly zoneId: string;
	readonly onSaved: (pageId: string) => void;
}) {
	const { t } = useTranslation(["errors", "locale", "ui", "zones"]);
	const { selectedLanguage, selectedLanguageIsPending, languagesChanged } =
		useContentLanguageEditor();
	const queryClient = useQueryClient();
	const invalidate = () =>
		queryClient.invalidateQueries({
			queryKey: getApiZonesByZoneIdPagesQueryKey({ path: { zoneId } }),
		});
	const createPage = usePostApiZonesByZoneIdPages({ mutation: { onSuccess: invalidate } });
	const updatePage = usePutApiZonesByZoneIdPagesByPageId({
		mutation: { onSuccess: invalidate },
	});
	const savePlacement = usePutApiZonesByZoneIdPagesByPageIdPlacement({
		mutation: { onSuccess: invalidate },
	});
	const removePlacement = useDeleteApiZonesByZoneIdPagesByPageIdPlacement({
		mutation: { onSuccess: invalidate },
	});
	const initialLocalization = page?.localizations.find(
		(entry) => entry.language === selectedLanguage,
	);
	const pageDraftScope = `zone-page:${page?.id ?? "new"}`;
	const localizationDraft = useLocalizedDraft<ZonePageLocalizationDraft>({
		scope: `${pageDraftScope}:localization`,
		baseVersion: page?.latestUnitRevisionId ?? null,
		codec: ZonePageLocalizationDraftCodec,
		createInitialValue: () => ({
			title: selectedLanguageIsPending ? "" : (initialLocalization?.title ?? ""),
			document:
				initialLocalization && !selectedLanguageIsPending
					? parseDocument(UnitReferencedBlockDocument, initialLocalization.document)
					: createUnitReferencedBlockDocument(),
		}),
	});
	const sharedDraft = useLocalizedDraft<ZonePageSharedDraft>({
		scope: `${pageDraftScope}:shared`,
		partition: "shared",
		baseVersion: `${page?.latestUnitRevisionId ?? "new"}:${page?.placement?.latestStructureRevisionId ?? pageStructureRevisionId ?? "none"}`,
		codec: ZonePageSharedDraftCodec,
		createInitialValue: () => ({
			slug: page?.home ? "" : (page?.slug ?? ""),
			parentPageId: page?.placement?.parentPageId ?? "",
			home: page?.home ?? !pages.some((candidate) => candidate.home),
			indexed: Boolean(page?.placement),
		}),
	});
	const localization = localizationDraft.value;
	const shared = sharedDraft.value;
	const excludedParents = page ? descendantPageIds(placedPages, page.id) : new Set<string>();

	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const normalizedSlug = shared.home ? ZoneHomePageSlug : shared.slug || null;
		try {
			const saved = page
				? await updatePage.mutateAsync({
						path: { zoneId, pageId: page.id },
						body: {
							slug: normalizedSlug,
							localization: {
								language: selectedLanguage,
								title: localization.title,
								document: localization.document,
							},
							baseUnitRevisionId: page.latestUnitRevisionId,
						},
					})
				: await createPage.mutateAsync({
						path: { zoneId },
						body: {
							slug: normalizedSlug,
							localization: {
								language: selectedLanguage,
								title: localization.title,
								document: localization.document,
							},
						},
					});

			if (shared.indexed) {
				const targetParentId = shared.parentPageId || null;
				const position =
					page?.placement?.parentPageId === targetParentId
						? page.placement.position
						: nextPosition(placedPages, targetParentId);
				const structureRevisionId =
					page?.placement?.latestStructureRevisionId ??
					placedPages[0]?.placement.latestStructureRevisionId ??
					pageStructureRevisionId;
				await savePlacement.mutateAsync({
					path: { zoneId, pageId: saved.id },
					body: {
						parentPageId: targetParentId,
						position,
						...(structureRevisionId ? { baseStructureRevisionId: structureRevisionId } : {}),
					},
				});
			} else if (page?.placement) {
				await removePlacement.mutateAsync({
					path: { zoneId, pageId: page.id },
					body: {
						baseStructureRevisionId: page.placement.latestStructureRevisionId,
					},
				});
			}
			localizationDraft.commit();
			sharedDraft.commit();
			if (page) await languagesChanged();
			onSaved(saved.id);
		} catch {
			// Typed mutation states supply the visible request failure.
		}
	}

	const pending =
		createPage.isPending ||
		updatePage.isPending ||
		savePlacement.isPending ||
		removePlacement.isPending;
	const error =
		createPage.error ?? updatePage.error ?? savePlacement.error ?? removePlacement.error;

	return (
		<Card appearance="outlined">
			<CardContent className="grid gap-6 p-6">
				{page ? <ContentLanguageControl /> : null}
				<LocalizedDraftGate
					hydrated={localizationDraft.hydrated && sharedDraft.hydrated}
					onDiscard={() => {
						localizationDraft.discard();
						sharedDraft.discard();
					}}
					serverChanged={localizationDraft.serverChanged || sharedDraft.serverChanged}
				>
					<form className="grid gap-6" onSubmit={submit}>
						<h2 className="font-semibold text-xl">
							{page ? t.zones.management.pages.editPage : t.zones.management.pages.newPage}
						</h2>
						<FieldGroup className="grid gap-4 sm:grid-cols-2">
							<Field>
								<FieldLabel>{t.zones.management.pages.slugOptional}</FieldLabel>
								<Input
									disabled={shared.home}
									maxLength={100}
									onChange={(event) => {
										const slug = event.currentTarget.value;
										sharedDraft.setValue((current) => ({ ...current, slug }));
									}}
									pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
									value={shared.home ? ZoneHomePageSlug : shared.slug}
								/>
							</Field>
							<Field required>
								<FieldLabel>{t.zones.management.pages.title}</FieldLabel>
								<Input
									maxLength={500}
									onChange={(event) => {
										const title = event.currentTarget.value;
										localizationDraft.setValue((current) => ({
											...current,
											title,
										}));
									}}
									required
									value={localization.title}
								/>
							</Field>
							<Field>
								<FieldLabel>{t.zones.management.pages.parent}</FieldLabel>
								<NativeSelect
									disabled={!shared.indexed}
									onChange={(event) => {
										const parentPageId = event.currentTarget.value;
										sharedDraft.setValue((current) => ({
											...current,
											parentPageId,
										}));
									}}
									value={shared.parentPageId}
								>
									<NativeSelectOption value="">
										{t.zones.management.pages.noParent}
									</NativeSelectOption>
									{placedPages
										.filter(
											(candidate) =>
												candidate.id !== page?.id && !excludedParents.has(candidate.id),
										)
										.map((candidate) => (
											<NativeSelectOption key={candidate.id} value={candidate.id}>
												{candidate.title}
											</NativeSelectOption>
										))}
								</NativeSelect>
							</Field>
							<label className="flex items-center gap-2 text-sm">
								<Checkbox
									checked={shared.home}
									onCheckedChange={(details) => {
										const home = details.checked === true;
										sharedDraft.setValue((current) => ({ ...current, home }));
									}}
								/>
								{t.zones.management.pages.home}
							</label>
							<label className="flex items-center gap-2 text-sm">
								<Checkbox
									checked={shared.indexed}
									onCheckedChange={(details) => {
										const indexed = details.checked === true;
										sharedDraft.setValue((current) => ({
											...current,
											indexed,
										}));
									}}
								/>
								{t.zones.management.pages.indexed}
							</label>
						</FieldGroup>
						<BlockDocumentEditor
							document={localization.document}
							labels={t.zones.management.blocks}
							onChange={(next) => {
								const document = parseDocument(UnitReferencedBlockDocument, next);
								localizationDraft.setValue((current) => ({ ...current, document }));
							}}
							pickerPlaceholders={{
								post: t.ui.pickerPlaceholders.post,
								unit: t.ui.pickerPlaceholders.unit,
							}}
						/>
						<div className="flex flex-wrap gap-3">
							<Button isLoading={pending} type="submit">
								{t.zones.management.pages.save}
							</Button>
						</div>
						<RequestFailure error={error} fallback={t.ui.retryLater} />
					</form>
				</LocalizedDraftGate>
			</CardContent>
		</Card>
	);
}
