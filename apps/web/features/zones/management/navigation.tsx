"use client";

import {
	NavigationDocument,
	createBlockKey,
	parseDocument,
	type NavigationDocument as NavigationDocumentValue,
	type NavigationItem,
} from "@rezics/block";
import {
	getApiZonesByZoneIdNavigationQueryKey,
	type GetApiZonesByZoneIdNavigationStatus200,
	useDeleteApiZonesByZoneIdNavigationByNavigationId,
	useGetApiZonesByZoneIdNavigation,
	usePostApiZonesByZoneIdNavigation,
	usePutApiZonesByZoneIdNavigationByNavigationId,
} from "@rezics/openapi-tanstack-query";
import {
	Button,
	Card,
	CardContent,
	createTreeCollection,
	Field,
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
	UnitPicker,
} from "@rezics/ui";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Link as LinkIcon, Plus, Trash2 } from "lucide-react";
import { AppLink as Link } from "@/features/application-shell/components/app-link";
import { useMemo, useState } from "react";

import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { zoneManagementHref } from "./model";
import { useZoneManagement } from "./workspace";

type Navigation = GetApiZonesByZoneIdNavigationStatus200["items"][number];

function createLeaf(): NavigationItem {
	return {
		_key: createBlockKey(),
		labelUnitId: "",
		target: { kind: "unit", unitId: "" },
	};
}

function createDocument(): NavigationDocumentValue {
	return { _type: "navigation-document", _key: createBlockKey(), items: [createLeaf()] };
}

function mapAtPath(
	items: readonly NavigationItem[],
	path: readonly number[],
	transform: (item: NavigationItem) => NavigationItem,
): NavigationItem[] {
	const [index, ...rest] = path;
	if (index === undefined) return [...items];
	return items.map((item, candidate) => {
		if (candidate !== index) return item;
		if (rest.length === 0) return transform(item);
		if (!("children" in item)) return item;
		return { ...item, children: mapAtPath(item.children, rest, transform) };
	});
}

function updateSiblings(
	items: readonly NavigationItem[],
	parentPath: readonly number[],
	transform: (siblings: readonly NavigationItem[]) => NavigationItem[],
): NavigationItem[] {
	if (parentPath.length === 0) return transform(items);
	return mapAtPath(items, parentPath, (parent) =>
		"children" in parent ? { ...parent, children: transform(parent.children) } : parent,
	);
}

function siblingsAtPath(
	items: readonly NavigationItem[],
	parentPath: readonly number[],
): readonly NavigationItem[] {
	let current = items;
	for (const index of parentPath) {
		const parent = current[index];
		if (!parent || !("children" in parent)) return [];
		current = parent.children;
	}
	return current;
}

interface NavigationTreeNode extends TreeNodeType {
	readonly item: NavigationItem | null;
	readonly path: number[];
	readonly children?: NavigationTreeNode[];
}

function toNodes(
	items: readonly NavigationItem[],
	parentPath: readonly number[] = [],
): NavigationTreeNode[] {
	return items.map((item, index) => {
		const path = [...parentPath, index];
		return {
			id: item._key,
			name: item.labelUnitId || item._key,
			item,
			path,
			...("children" in item ? { children: toNodes(item.children, path) } : {}),
		};
	});
}

function expanded(nodes: readonly NavigationTreeNode[]): string[] {
	return nodes.flatMap((node) =>
		node.children?.length ? [node.id, ...expanded(node.children)] : [],
	);
}

export function ZoneNavigationManagement() {
	const { zoneId } = useZoneManagement();
	const { t } = useTranslation(["errors", "ui", "zones"]);
	const query = useGetApiZonesByZoneIdNavigation({ path: { zoneId } });
	const [selectedId, setSelectedId] = useState<string | "new">("new");
	if (query.isPending) return <QueryPending />;
	if (query.isError) return <QueryFailure error={query.error} retry={() => void query.refetch()} />;
	const selected = query.data.items.find((item) => item.id === selectedId);
	return (
		<section>
			<ManagementWorkspaceSectionHeader
				action={
					<Button onClick={() => setSelectedId("new")} size="sm" type="button">
						<Plus aria-hidden /> {t.zones.management.navigationEditor.new}
					</Button>
				}
				backHref={zoneManagementHref(zoneId)}
				backLabel={t.zones.management.title}
				description={t.zones.management.sections.navigation.description}
				link={Link}
				title={t.zones.management.sections.navigation.label}
			/>
			<div className="grid gap-6 lg:grid-cols-[minmax(13rem,0.45fr)_minmax(0,1.55fr)]">
				<Card appearance="outlined">
					<CardContent className="grid gap-2 p-4">
						<h2 className="font-semibold">{t.zones.management.navigationEditor.resources}</h2>
						{query.data.items.length ? (
							query.data.items.map((item, index) => (
								<Button
									className="justify-start"
									key={item.id}
									onClick={() => setSelectedId(item.id)}
									type="button"
									variant={selected?.id === item.id ? "secondary" : "quiet"}
								>
									<LinkIcon aria-hidden /> {t.zones.management.sections.navigation.label}{" "}
									{index + 1}
								</Button>
							))
						) : (
							<p className="text-sm text-muted-foreground">
								{t.zones.management.navigationEditor.empty}
							</p>
						)}
					</CardContent>
				</Card>
				<NavigationEditor key={selected?.id ?? "new"} navigation={selected} zoneId={zoneId} />
			</div>
		</section>
	);
}

function NavigationEditor({ navigation, zoneId }: { navigation?: Navigation; zoneId: string }) {
	const { t } = useTranslation(["errors", "ui", "zones"]);
	const queryClient = useQueryClient();
	const [document, setDocument] = useState<NavigationDocumentValue>(() =>
		navigation ? parseDocument(NavigationDocument, navigation.document) : createDocument(),
	);
	const [confirmingRemove, setConfirmingRemove] = useState(false);
	const invalidate = () =>
		queryClient.invalidateQueries({
			queryKey: getApiZonesByZoneIdNavigationQueryKey({ path: { zoneId } }),
		});
	const create = usePostApiZonesByZoneIdNavigation({ mutation: { onSuccess: invalidate } });
	const update = usePutApiZonesByZoneIdNavigationByNavigationId({
		mutation: { onSuccess: invalidate },
	});
	const remove = useDeleteApiZonesByZoneIdNavigationByNavigationId({
		mutation: { onSuccess: invalidate },
	});
	const error = create.error ?? update.error ?? remove.error;
	return (
		<Card appearance="outlined">
			<CardContent className="grid gap-5 p-6">
				<NavigationTree document={document} onChange={setDocument} />
				<Button
					onClick={() => setDocument({ ...document, items: [...document.items, createLeaf()] })}
					type="button"
					variant="outline"
				>
					<Plus aria-hidden /> {t.zones.management.navigationEditor.addItem}
				</Button>
				<div className="flex flex-wrap gap-3">
					<Button
						isLoading={create.isPending || update.isPending}
						onClick={async () => {
							try {
								if (navigation)
									await update.mutateAsync({
										path: { zoneId, navigationId: navigation.id },
										body: {
											document,
											baseRevisionId: navigation.latestRevisionId,
										},
									});
								else
									await create.mutateAsync({
										path: { zoneId },
										body: { document },
									});
							} catch {
								// The typed mutation state supplies the visible request failure.
							}
						}}
						type="button"
					>
						{t.zones.management.navigationEditor.save}
					</Button>
					{navigation ? (
						<Button
							isLoading={remove.isPending}
							onClick={async () => {
								if (!confirmingRemove) return setConfirmingRemove(true);
								try {
									await remove.mutateAsync({
										path: { zoneId, navigationId: navigation.id },
										body: { baseRevisionId: navigation.latestRevisionId },
									});
								} catch {
									// The typed mutation state supplies the visible request failure.
								}
							}}
							type="button"
							variant="outline"
						>
							{confirmingRemove
								? t.zones.management.navigationEditor.confirmRemove
								: t.zones.management.navigationEditor.remove}
						</Button>
					) : null}
				</div>
				<RequestFailure error={error} fallback={t.ui.retryLater} />
			</CardContent>
		</Card>
	);
}

function NavigationTree({
	document,
	onChange,
}: {
	readonly document: NavigationDocumentValue;
	readonly onChange: (document: NavigationDocumentValue) => void;
}) {
	const { t } = useTranslation("zones");
	const nodes = useMemo(() => toNodes(document.items), [document.items]);
	const rootNode: NavigationTreeNode = {
		id: "navigation-root",
		name: "",
		item: null,
		path: [],
		children: nodes,
	};
	const collection = createTreeCollection<NavigationTreeNode>({ rootNode });
	function update(path: readonly number[], transform: (item: NavigationItem) => NavigationItem) {
		onChange({ ...document, items: mapAtPath(document.items, path, transform) });
	}
	function remove(path: readonly number[]) {
		const index = path.at(-1);
		if (index === undefined) return;
		const parentPath = path.slice(0, -1);
		if (siblingsAtPath(document.items, parentPath).length <= 1) return;
		const items = updateSiblings(document.items, parentPath, (siblings) =>
			siblings.filter((_, candidate) => candidate !== index),
		);
		if (items.length) onChange({ ...document, items });
	}
	function move(path: readonly number[], direction: -1 | 1) {
		const index = path.at(-1);
		if (index === undefined) return;
		onChange({
			...document,
			items: updateSiblings(document.items, path.slice(0, -1), (siblings) => {
				const target = index + direction;
				if (target < 0 || target >= siblings.length) return [...siblings];
				const next = [...siblings];
				[next[index], next[target]] = [next[target]!, next[index]!];
				return next;
			}),
		});
	}
	return (
		<TreeEditor
			collection={collection}
			defaultExpandedValue={expanded(nodes)}
			label={t.management.sections.navigation.label}
			renderNode={(node, indexPath) => (
				<NavigationTreeRow
					indexPath={indexPath}
					key={node.id}
					node={node}
					onMove={move}
					onRemove={remove}
					onUpdate={update}
				/>
			)}
		/>
	);
}

function NavigationTreeRow({
	node,
	indexPath,
	onUpdate,
	onRemove,
	onMove,
}: {
	readonly node: NavigationTreeNode;
	readonly indexPath: number[];
	readonly onUpdate: (
		path: readonly number[],
		transform: (item: NavigationItem) => NavigationItem,
	) => void;
	readonly onRemove: (path: readonly number[]) => void;
	readonly onMove: (path: readonly number[], direction: -1 | 1) => void;
}) {
	if (!node.item) return null;
	const fields = (
		<NavigationItemFields
			depth={node.path.length}
			item={node.item}
			onChange={(item) => onUpdate(node.path, () => item)}
			onMove={(direction) => onMove(node.path, direction)}
			onRemove={() => onRemove(node.path)}
		/>
	);
	return (
		<TreeViewNode indexPath={indexPath} node={node}>
			{node.children?.length ? (
				<TreeViewBranch>
					<TreeViewBranchItem>{fields}</TreeViewBranchItem>
					<TreeViewBranchContent>
						{node.children.map((child, index) => (
							<NavigationTreeRow
								indexPath={[...indexPath, index]}
								key={child.id}
								node={child}
								onMove={onMove}
								onRemove={onRemove}
								onUpdate={onUpdate}
							/>
						))}
					</TreeViewBranchContent>
				</TreeViewBranch>
			) : (
				<TreeViewContent>
					<TreeViewItem>{fields}</TreeViewItem>
				</TreeViewContent>
			)}
		</TreeViewNode>
	);
}

function NavigationItemFields({
	depth,
	item,
	onChange,
	onMove,
	onRemove,
}: {
	readonly depth: number;
	readonly item: NavigationItem;
	readonly onChange: (item: NavigationItem) => void;
	readonly onMove: (direction: -1 | 1) => void;
	readonly onRemove: () => void;
}) {
	const { t } = useTranslation("zones");
	const { t: ui } = useTranslation("ui");
	return (
		<div
			className="grid w-full gap-3 py-2 sm:grid-cols-2"
			onClick={(event) => event.stopPropagation()}
		>
			<Field required>
				<FieldLabel>{t.management.navigationEditor.labelUnitId}</FieldLabel>
				<UnitPicker
					ariaLabel={t.management.navigationEditor.labelUnitId}
					onValueChange={(value) => onChange({ ...item, labelUnitId: value ?? "" })}
					placeholder={ui.pickerPlaceholders.unit}
					value={item.labelUnitId}
				/>
			</Field>
			<Field>
				<FieldLabel>{t.management.navigationEditor.itemType}</FieldLabel>
				<NativeSelect
					onChange={(event) =>
						onChange(
							event.currentTarget.value === "group" && depth < 3
								? {
										_key: item._key,
										labelUnitId: item.labelUnitId,
										children: [createLeaf()],
									}
								: {
										_key: item._key,
										labelUnitId: item.labelUnitId,
										target: { kind: "unit", unitId: "" },
									},
						)
					}
					value={"children" in item ? "group" : "link"}
				>
					<NativeSelectOption value="link">
						{t.management.navigationEditor.itemTypes.link}
					</NativeSelectOption>
					<NativeSelectOption value="group">
						{t.management.navigationEditor.itemTypes.group}
					</NativeSelectOption>
				</NativeSelect>
			</Field>
			{"target" in item ? (
				<>
					<Field>
						<FieldLabel>{t.management.navigationEditor.targetKind}</FieldLabel>
						<NativeSelect
							onChange={(event) =>
								onChange({
									...item,
									target:
										event.currentTarget.value === "external"
											? { kind: "external", url: "https://" }
											: { kind: "unit", unitId: "" },
								})
							}
							value={item.target.kind}
						>
							<NativeSelectOption value="unit">
								{t.management.navigationEditor.targetKinds.unit}
							</NativeSelectOption>
							<NativeSelectOption value="external">
								{t.management.navigationEditor.targetKinds.external}
							</NativeSelectOption>
						</NativeSelect>
					</Field>
					<Field required>
						<FieldLabel>
							{item.target.kind === "unit"
								? t.management.navigationEditor.targetUnitId
								: t.management.navigationEditor.targetUrl}
						</FieldLabel>
						{item.target.kind === "unit" ? (
							<UnitPicker
								ariaLabel={t.management.navigationEditor.targetUnitId}
								onValueChange={(value) =>
									onChange({
										...item,
										target: { kind: "unit", unitId: value ?? "" },
									})
								}
								placeholder={ui.pickerPlaceholders.unit}
								value={item.target.unitId}
							/>
						) : (
							<Input
								onChange={(event) =>
									onChange({
										...item,
										target: {
											kind: "external",
											url: event.currentTarget.value,
										},
									})
								}
								required
								value={item.target.url}
							/>
						)}
					</Field>
				</>
			) : null}
			<div className="flex flex-wrap gap-1 sm:col-span-2">
				<Button
					aria-label={t.management.navigationEditor.moveUp}
					onClick={() => onMove(-1)}
					size="icon-sm"
					type="button"
					variant="quiet"
				>
					<ArrowUp aria-hidden />
				</Button>
				<Button
					aria-label={t.management.navigationEditor.moveDown}
					onClick={() => onMove(1)}
					size="icon-sm"
					type="button"
					variant="quiet"
				>
					<ArrowDown aria-hidden />
				</Button>
				{"children" in item && depth < 3 ? (
					<Button
						onClick={() => onChange({ ...item, children: [...item.children, createLeaf()] })}
						size="sm"
						type="button"
						variant="quiet"
					>
						<Plus aria-hidden /> {t.management.navigationEditor.addChild}
					</Button>
				) : null}
				<Button
					aria-label={t.management.navigationEditor.removeItem}
					onClick={onRemove}
					size="icon-sm"
					type="button"
					variant="quiet"
				>
					<Trash2 aria-hidden />
				</Button>
			</div>
		</div>
	);
}
