import { Button } from "@rezics/ui/ui/button";
import { ScrollArea } from "@rezics/ui/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@rezics/ui/ui/tabs";
import {
	createTreeCollection,
	TreeView,
	TreeViewBranch,
	TreeViewBranchContent,
	TreeViewBranchItem,
	TreeViewContent,
	TreeViewItem,
	TreeViewLabel,
	TreeViewNode,
	TreeViewTree,
	type TreeNodeType,
} from "@rezics/ui/ui/tree-view";
import FilePlusIcon from "lucide-react/dist/esm/icons/file-plus.mjs";
import FileTextIcon from "lucide-react/dist/esm/icons/file-text.mjs";
import FolderOpenIcon from "lucide-react/dist/esm/icons/folder-open.mjs";
import FolderPlusIcon from "lucide-react/dist/esm/icons/folder-plus.mjs";
import { useMemo, type ReactElement } from "react";
import type { MarkdownDocumentAnalysis, MarkdownOutlineItem } from "../domain/document-analysis";
import type { MarkdownSidebarTab } from "../domain/workspace-chrome";
import type { MarkdownOpenDocument, MarkdownWorkspaceFolder } from "../domain/workspace-state";
import type { RezicsTextMessages } from "../i18n/messages";
import { TooltipButton } from "./tooltip-button";

interface WorkspaceTreeNode extends TreeNodeType {
	readonly kind: "document" | "folder";
	readonly document?: MarkdownOpenDocument;
	readonly folderId?: string;
	readonly childrenCount?: number;
	readonly children?: WorkspaceTreeNode[];
}

export function WorkspaceSidebar({
	messages,
	tab,
	documents,
	folders,
	selectedItemId,
	busy,
	analysis,
	activeOutline,
	onTabChange,
	onActivate,
	onSelectItem,
	onSelectFolder,
	onToggleFolder,
	onNewDocument,
	onNewFolder,
	onOpen,
	onReveal,
}: {
	readonly messages: RezicsTextMessages;
	readonly tab: MarkdownSidebarTab;
	readonly documents: readonly MarkdownOpenDocument[];
	readonly folders: readonly MarkdownWorkspaceFolder[];
	readonly selectedItemId: string;
	readonly busy: boolean;
	readonly analysis: MarkdownDocumentAnalysis;
	readonly activeOutline: number | undefined;
	readonly onTabChange: (tab: MarkdownSidebarTab) => void;
	readonly onActivate: (id: string) => void;
	readonly onSelectItem: (id: string) => void;
	readonly onSelectFolder: (id: string | undefined) => void;
	readonly onToggleFolder: (id: string) => void;
	readonly onNewDocument: () => void;
	readonly onNewFolder: () => void;
	readonly onOpen: () => void;
	readonly onReveal: (item: MarkdownOutlineItem) => void;
}): ReactElement {
	const { collection, nodesById } = useMemo(() => {
		const nodes: WorkspaceTreeNode[] = [
			...folders.map((folder): WorkspaceTreeNode => {
				const children = documents
					.filter((document) => document.folderId === folder.id)
					.map((document) => documentNode(document, folder.id));
				return {
					id: folder.id,
					kind: "folder",
					name: folder.name,
					children,
					childrenCount: children.length,
				};
			}),
			...documents
				.filter((document) => document.folderId === undefined)
				.map((document) => documentNode(document)),
		];
		const nodesById = new Map<string, WorkspaceTreeNode>();
		for (const node of nodes) {
			nodesById.set(node.id, node);
			for (const child of node.children ?? []) nodesById.set(child.id, child);
		}
		return {
			collection: createTreeCollection<WorkspaceTreeNode>({
				rootNode: { id: "workspace-root", kind: "folder", name: "", children: nodes },
			}),
			nodesById,
		};
	}, [documents, folders]);
	const expandedValue = useMemo(
		() => folders.filter((folder) => folder.expanded).map((folder) => folder.id),
		[folders],
	);

	return (
		<aside
			aria-label={tab === "files" ? messages.labels.files : messages.labels.outline}
			className="size-full min-w-0 bg-surface-container"
		>
			<Tabs
				className="size-full min-h-0 gap-0"
				onValueChange={(details) => onTabChange(details.value as MarkdownSidebarTab)}
				value={tab}
			>
				<header className="flex h-10 shrink-0 items-center border-border-weak border-b px-1.5">
					<TabsList
						aria-label={messages.labels.sidebar}
						className="h-full min-w-0 flex-1"
						variant="underline"
					>
						<TabsTrigger className="h-full px-2.5 text-xs" value="files">
							{messages.labels.files}
						</TabsTrigger>
						<TabsTrigger className="h-full px-2.5 text-xs" value="outline">
							{messages.labels.outline}
						</TabsTrigger>
					</TabsList>
					{tab === "files" ? (
						<div className="flex shrink-0 items-center gap-0.5">
							<TooltipButton
								disabled={busy}
								label={messages.actions.open}
								onClick={onOpen}
								size="icon-xs"
								variant="ghost"
							>
								<FolderOpenIcon />
							</TooltipButton>
							<TooltipButton
								disabled={busy}
								label={messages.actions.newDocument}
								onClick={onNewDocument}
								size="icon-xs"
								variant="ghost"
							>
								<FilePlusIcon />
							</TooltipButton>
							<TooltipButton
								disabled={busy}
								label={messages.actions.newFolder}
								onClick={onNewFolder}
								size="icon-xs"
								variant="ghost"
							>
								<FolderPlusIcon />
							</TooltipButton>
						</div>
					) : null}
				</header>

				<TabsContent className="min-h-0 overflow-hidden" value="files">
					<ScrollArea className="size-full">
						<TreeView
							className="gap-0 p-1.5 [--item-gap:--spacing(1.5)] [--padding-block:--spacing(1)] [--padding-inline:--spacing(2)]"
							collection={collection}
							expandOnClick
							expandedValue={expandedValue}
							onExpandedChange={(details) => {
								for (const folder of folders) {
									if (details.expandedValue.includes(folder.id) !== folder.expanded) {
										onToggleFolder(folder.id);
									}
								}
							}}
							onSelectionChange={(details) => {
								const id = details.selectedValue.at(-1);
								if (!id) return;
								const node = nodesById.get(id);
								if (!node) return;
								onSelectItem(id);
								if (node.kind === "folder") {
									onSelectFolder(node.id);
									return;
								}
								onSelectFolder(node.folderId);
								onActivate(node.id);
							}}
							selectedValue={[selectedItemId]}
							selectionMode="single"
						>
							<TreeViewLabel className="sr-only">{messages.labels.files}</TreeViewLabel>
							<TreeViewTree>
								{collection.rootNode.children?.map((node, index) => (
									<WorkspaceTreeEntry
										indexPath={[index]}
										key={node.id}
										messages={messages}
										node={node}
									/>
								))}
							</TreeViewTree>
						</TreeView>
					</ScrollArea>
				</TabsContent>

				<TabsContent className="min-h-0 overflow-hidden" value="outline">
					<ScrollArea className="size-full">
						{analysis.outline.length === 0 ? (
							<p className="px-3 py-4 text-muted-foreground text-xs leading-relaxed">
								{messages.labels.noOutline}
							</p>
						) : (
							<ol className="flex flex-col gap-0.5 p-1.5">
								{analysis.outline.map((item) => {
									const selected = item.ordinal === activeOutline;
									return (
										<li key={`${item.ordinal}-${item.line}`}>
											<Button
												aria-current={selected ? "location" : undefined}
												className="w-full justify-start px-2 text-start font-normal text-xs"
												onClick={() => onReveal(item)}
												size="sm"
												title={item.title}
												variant={selected ? "secondary" : "ghost"}
											>
												<span
													className="min-w-0 truncate"
													style={{ marginInlineStart: `${(item.level - 1) * 0.7}rem` }}
												>
													{item.title}
												</span>
											</Button>
										</li>
									);
								})}
							</ol>
						)}
					</ScrollArea>
				</TabsContent>
			</Tabs>
		</aside>
	);
}

function documentNode(document: MarkdownOpenDocument, folderId?: string): WorkspaceTreeNode {
	return {
		document,
		folderId,
		id: document.id,
		kind: "document",
		name: document.file.name,
	};
}

function WorkspaceTreeEntry({
	node,
	indexPath,
	messages,
}: {
	readonly node: WorkspaceTreeNode;
	readonly indexPath: number[];
	readonly messages: RezicsTextMessages;
}): ReactElement {
	return (
		<TreeViewNode indexPath={indexPath} node={node}>
			{node.kind === "folder" ? (
				<TreeViewBranch>
					<TreeViewBranchItem>{node.name}</TreeViewBranchItem>
					<TreeViewBranchContent>
						{node.children?.length ? (
							node.children.map((child, index) => (
								<WorkspaceTreeEntry
									indexPath={[...indexPath, index]}
									key={child.id}
									messages={messages}
									node={child}
								/>
							))
						) : (
							<p className="py-1 pe-2 ps-10 text-muted-foreground text-xs">
								{messages.labels.emptyFolder}
							</p>
						)}
					</TreeViewBranchContent>
				</TreeViewBranch>
			) : (
				<TreeViewContent>
					<TreeViewItem icon={FileTextIcon}>
						<span className="min-w-0 flex-1 truncate">{node.name}</span>
						{node.document?.dirty ? (
							<span aria-hidden className="size-1.5 shrink-0 rounded-full bg-current" />
						) : null}
					</TreeViewItem>
				</TreeViewContent>
			)}
		</TreeViewNode>
	);
}
