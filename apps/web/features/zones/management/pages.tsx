"use client";

import {
	UnitReferencedBlockDocument,
	createUnitReferencedBlockDocument,
	parseDocument,
	type UnitReferencedBlockDocument as UnitReferencedBlockDocumentValue,
} from "@rezics/block";
import {
	getApiZonesByZoneIdPagesQueryKey,
	type GetApiZonesByZoneIdPagesStatus200,
	useDeleteApiZonesByZoneIdPagesBySlug,
	useGetApiZonesByZoneIdPages,
	usePutApiZonesByZoneIdPagesBySlug,
} from "@rezics/openapi-tanstack-query";
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
import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";

import { BlockDocumentEditor } from "@/features/blocks/block-document-editor";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { useZoneManagement } from "./workspace";
import { zoneManagementHref } from "./model";

type Page = GetApiZonesByZoneIdPagesStatus200["items"][number];

interface PageTreeNode extends TreeNodeType {
	readonly page: Page | null;
	readonly children?: PageTreeNode[];
}

function toPageTree(pages: readonly Page[], parentPageId: string | null = null): PageTreeNode[] {
	return pages
		.filter((page) => page.parentPageId === parentPageId)
		.toSorted((left, right) => left.position.localeCompare(right.position))
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

function descendantPageIds(pages: readonly Page[], pageId: string): ReadonlySet<string> {
	const descendants = new Set<string>();
	const visit = (parentId: string) => {
		for (const page of pages)
			if (page.parentPageId === parentId && !descendants.has(page.id)) {
				descendants.add(page.id);
				visit(page.id);
			}
	};
	visit(pageId);
	return descendants;
}

export function ZonePagesManagement() {
	const { zoneId } = useZoneManagement();
	const { t } = useTranslation(["errors", "locale", "ui", "zones"]);
	const query = useGetApiZonesByZoneIdPages({ path: { zoneId } });
	const queryClient = useQueryClient();
	const move = usePutApiZonesByZoneIdPagesBySlug({
		mutation: {
			onSuccess: () =>
				queryClient.invalidateQueries({
					queryKey: getApiZonesByZoneIdPagesQueryKey({ path: { zoneId } }),
				}),
		},
	});
	const [selectedId, setSelectedId] = useState<string | "new">("new");
	if (query.isPending) return <QueryPending />;
	if (query.isError)
		return <QueryFailure error={query.error} retry={() => void query.refetch()} />;
	const pages = query.data.items;
	const selected = pages.find((page) => page.id === selectedId);
	return (
		<section>
			<ManagementWorkspaceSectionHeader
				action={
					<Button onClick={() => setSelectedId("new")} size="sm" type="button">
						<Plus aria-hidden /> {t.zones.management.pages.newPage}
					</Button>
				}
				description={t.zones.management.sections.pages.description}
				backHref={zoneManagementHref(zoneId)}
				backLabel={t.zones.management.title}
				link={Link}
				title={t.zones.management.sections.pages.label}
			/>
			<div className="grid gap-6 lg:grid-cols-[minmax(15rem,0.7fr)_minmax(0,1.3fr)]">
				<Card appearance="outlined">
					<CardContent className="p-4">
						{pages.length ? (
							<PageTree
								onMove={async (page, direction) => {
									const siblings = pages
										.filter(
											(candidate) =>
												candidate.parentPageId === page.parentPageId,
										)
										.toSorted((left, right) =>
											left.position.localeCompare(right.position),
										);
									const index = siblings.findIndex(
										(candidate) => candidate.id === page.id,
									);
									if (index < 0) return;
									const position =
										direction === -1
											? generateKeyBetween(
													siblings[index - 2]?.position ?? null,
													siblings[index - 1]?.position ?? null,
												)
											: generateKeyBetween(
													siblings[index + 1]?.position ?? null,
													siblings[index + 2]?.position ?? null,
												);
									try {
										await move.mutateAsync({
											path: { zoneId, slug: page.slug },
											body: {
												pageId: page.id,
												baseUnitRevisionId: page.latestUnitRevisionId,
												baseStructureRevisionId:
													page.latestStructureRevisionId,
												localization: {
													language: page.language,
													title: page.title,
													document: page.document,
												},
												parentPageId: page.parentPageId,
												home: page.home,
												position,
											},
										});
									} catch {
										// Typed mutation state supplies the visible request failure.
									}
								}}
								pages={pages}
								pending={move.isPending}
								selectedId={selected?.id}
								setSelectedId={setSelectedId}
							/>
						) : (
							<p className="text-sm text-muted-foreground">
								{t.zones.management.pages.empty}
							</p>
						)}
						<RequestFailure error={move.error} fallback={t.ui.retryLater} />
					</CardContent>
				</Card>
				<PageEditor
					key={selected?.id ?? "new"}
					page={selected}
					pages={pages}
					zoneId={zoneId}
				/>
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
	readonly pages: readonly Page[];
	readonly pending: boolean;
	readonly onMove: (page: Page, direction: -1 | 1) => Promise<void>;
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
	readonly onMove: (page: Page, direction: -1 | 1) => Promise<void>;
	readonly pages: readonly Page[];
	readonly pending: boolean;
	readonly selectedId?: string;
	readonly setSelectedId: (id: string) => void;
}) {
	const { t } = useTranslation("zones");
	if (!node.page) return null;
	const siblings = pages
		.filter((candidate) => candidate.parentPageId === node.page?.parentPageId)
		.toSorted((left, right) => left.position.localeCompare(right.position));
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
						selectedId === node.page.id
							? "truncate font-semibold text-primary"
							: "truncate"
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

function PageEditor({
	page,
	pages,
	zoneId,
}: {
	page?: Page;
	pages: readonly Page[];
	zoneId: string;
}) {
	const { t, locale } = useTranslation(["errors", "locale", "ui", "zones"]);
	const queryClient = useQueryClient();
	const invalidate = () =>
		queryClient.invalidateQueries({
			queryKey: getApiZonesByZoneIdPagesQueryKey({ path: { zoneId } }),
		});
	const save = usePutApiZonesByZoneIdPagesBySlug({ mutation: { onSuccess: invalidate } });
	const remove = useDeleteApiZonesByZoneIdPagesBySlug({ mutation: { onSuccess: invalidate } });
	const defaultLanguage = locale.target.startsWith("zh") ? "zh" : "en";
	const [slug, setSlug] = useState(page?.slug ?? "");
	const [language, setLanguage] = useState<"zh" | "en">(page?.language ?? defaultLanguage);
	const initialLocalization = page?.localizations.find((entry) => entry.language === language);
	const [title, setTitle] = useState(initialLocalization?.title ?? page?.title ?? "");
	const [document, setDocument] = useState<UnitReferencedBlockDocumentValue>(() =>
		initialLocalization
			? parseDocument(UnitReferencedBlockDocument, initialLocalization.document)
			: createUnitReferencedBlockDocument(),
	);
	const [parentPageId, setParentPageId] = useState(page?.parentPageId ?? "");
	const [home, setHome] = useState(page?.home ?? pages.length === 0);
	const [confirmingRemove, setConfirmingRemove] = useState(false);
	const excludedParents = page ? descendantPageIds(pages, page.id) : new Set<string>();

	function chooseLanguage(nextLanguage: "zh" | "en") {
		setLanguage(nextLanguage);
		const localization = page?.localizations.find((entry) => entry.language === nextLanguage);
		setTitle(localization?.title ?? "");
		setDocument(
			localization
				? parseDocument(UnitReferencedBlockDocument, localization.document)
				: createUnitReferencedBlockDocument(),
		);
	}

	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		try {
			await save.mutateAsync({
				path: { zoneId, slug },
				body: {
					...(page
						? {
								pageId: page.id,
								baseUnitRevisionId: page.latestUnitRevisionId,
								baseStructureRevisionId: page.latestStructureRevisionId,
							}
						: pages[0]
							? { baseStructureRevisionId: pages[0].latestStructureRevisionId }
							: {}),
					localization: { language, title, document },
					parentPageId: home ? null : parentPageId || null,
					home,
				},
			});
		} catch {
			// The typed mutation state supplies the visible request failure.
		}
	}

	return (
		<Card appearance="outlined">
			<CardContent className="p-6">
				<form className="grid gap-6" onSubmit={submit}>
					<h2 className="font-semibold text-xl">
						{page
							? t.zones.management.pages.editPage
							: t.zones.management.pages.newPage}
					</h2>
					<FieldGroup className="grid gap-4 sm:grid-cols-2">
						<Field required>
							<FieldLabel>{t.zones.management.pages.slug}</FieldLabel>
							<Input
								maxLength={100}
								onChange={(event) => setSlug(event.currentTarget.value)}
								pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
								required
								value={slug}
							/>
						</Field>
						<Field>
							<FieldLabel>{t.zones.management.pages.language}</FieldLabel>
							<NativeSelect
								onChange={(event) =>
									chooseLanguage(event.currentTarget.value === "zh" ? "zh" : "en")
								}
								value={language}
							>
								<NativeSelectOption value="zh">{t.locale.zh}</NativeSelectOption>
								<NativeSelectOption value="en">{t.locale.en}</NativeSelectOption>
							</NativeSelect>
						</Field>
						<Field required>
							<FieldLabel>{t.zones.management.pages.title}</FieldLabel>
							<Input
								maxLength={500}
								onChange={(event) => setTitle(event.currentTarget.value)}
								required
								value={title}
							/>
						</Field>
						<Field>
							<FieldLabel>{t.zones.management.pages.parent}</FieldLabel>
							<NativeSelect
								disabled={home}
								onChange={(event) => setParentPageId(event.currentTarget.value)}
								required={!home && Boolean(page)}
								value={parentPageId}
							>
								<NativeSelectOption value="">
									{t.zones.management.pages.noParent}
								</NativeSelectOption>
								{pages
									.filter(
										(candidate) =>
											candidate.id !== page?.id &&
											!excludedParents.has(candidate.id),
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
								checked={home}
								onCheckedChange={(details) => setHome(details.checked === true)}
							/>
							{t.zones.management.pages.home}
						</label>
					</FieldGroup>
					<BlockDocumentEditor
						document={document}
						labels={t.zones.management.blocks}
						onChange={(next) =>
							setDocument(parseDocument(UnitReferencedBlockDocument, next))
						}
					/>
					<div className="flex flex-wrap gap-3">
						<Button isLoading={save.isPending} type="submit">
							{t.zones.management.pages.save}
						</Button>
						{page ? (
							<Button
								isLoading={remove.isPending}
								onClick={async () => {
									if (!confirmingRemove) return setConfirmingRemove(true);
									try {
										await remove.mutateAsync({
											path: { zoneId, slug: page.slug },
											body: {
												baseStructureRevisionId:
													page.latestStructureRevisionId,
											},
										});
									} catch {
										// The typed mutation state supplies the visible request failure.
									}
								}}
								type="button"
								variant="outline"
							>
								{confirmingRemove
									? t.zones.management.pages.confirmRemove
									: t.zones.management.pages.remove}
							</Button>
						) : null}
					</div>
					<RequestFailure error={save.error ?? remove.error} fallback={t.ui.retryLater} />
				</form>
			</CardContent>
		</Card>
	);
}
