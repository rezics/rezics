import { ScrollArea } from "@rezics/ui/ui/scroll-area";
import ChevronDownIcon from "lucide-react/dist/esm/icons/chevron-down.mjs";
import ChevronRightIcon from "lucide-react/dist/esm/icons/chevron-right.mjs";
import FilePlusIcon from "lucide-react/dist/esm/icons/file-plus.mjs";
import FileTextIcon from "lucide-react/dist/esm/icons/file-text.mjs";
import FolderIcon from "lucide-react/dist/esm/icons/folder.mjs";
import FolderPlusIcon from "lucide-react/dist/esm/icons/folder-plus.mjs";
import type { ReactElement } from "react";
import type { MarkdownDocumentAnalysis, MarkdownOutlineItem } from "../domain/document-analysis";
import type { MarkdownSidebarTab } from "../domain/workspace-chrome";
import type { MarkdownOpenDocument, MarkdownWorkspaceFolder } from "../domain/workspace-state";
import type { RezicsTextMessages } from "../i18n/messages";
import { TooltipButton } from "./tooltip-button";

export function WorkspaceSidebar({
	messages,
	tab,
	documents,
	folders,
	activeId,
	selectedFolderId,
	busy,
	analysis,
	activeOutline,
	onTabChange,
	onActivate,
	onSelectFolder,
	onToggleFolder,
	onNewDocument,
	onNewFolder,
	onReveal,
}: {
	readonly messages: RezicsTextMessages;
	readonly tab: MarkdownSidebarTab;
	readonly documents: readonly MarkdownOpenDocument[];
	readonly folders: readonly MarkdownWorkspaceFolder[];
	readonly activeId: string;
	readonly selectedFolderId: string | undefined;
	readonly busy: boolean;
	readonly analysis: MarkdownDocumentAnalysis;
	readonly activeOutline: number | undefined;
	readonly onTabChange: (tab: MarkdownSidebarTab) => void;
	readonly onActivate: (id: string) => void;
	readonly onSelectFolder: (id: string | undefined) => void;
	readonly onToggleFolder: (id: string) => void;
	readonly onNewDocument: () => void;
	readonly onNewFolder: () => void;
	readonly onReveal: (item: MarkdownOutlineItem) => void;
}): ReactElement {
	const rootDocuments = documents.filter((document) => document.folderId === undefined);
	return (
		<aside
			aria-label={tab === "files" ? messages.labels.files : messages.labels.outline}
			className="flex h-full w-60 shrink-0 flex-col bg-muted/35"
		>
			<div className="flex h-8 shrink-0 items-center border-border border-b px-1">
				<div className="flex min-w-0 flex-1" role="tablist" aria-label={messages.labels.sidebar}>
					<SidebarTab
						selected={tab === "files"}
						label={messages.labels.files}
						onSelect={() => onTabChange("files")}
					/>
					<SidebarTab
						selected={tab === "outline"}
						label={messages.labels.outline}
						onSelect={() => onTabChange("outline")}
					/>
				</div>
				{tab === "files" ? (
					<div className="flex shrink-0 items-center">
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
			</div>
			<ScrollArea className="min-h-0 flex-1">
				{tab === "files" ? (
					<ul className="flex flex-col py-1">
						{folders.map((folder) => {
							const children = documents.filter((document) => document.folderId === folder.id);
							const selected = selectedFolderId === folder.id;
							return (
								<li key={folder.id}>
									<button
										type="button"
										aria-expanded={folder.expanded}
										className={
											selected
												? "flex w-full items-center gap-1.5 px-2 py-1 text-start text-[13px] text-foreground bg-accent"
												: "flex w-full items-center gap-1.5 px-2 py-1 text-start text-[13px] text-muted-foreground hover:bg-accent/70 hover:text-foreground"
										}
										onClick={() => {
											onSelectFolder(folder.id);
											onToggleFolder(folder.id);
										}}
									>
										{folder.expanded ? (
											<ChevronDownIcon className="size-3.5 shrink-0" />
										) : (
											<ChevronRightIcon className="size-3.5 shrink-0" />
										)}
										<FolderIcon className="size-3.5 shrink-0" />
										<span className="min-w-0 flex-1 truncate">{folder.name}</span>
									</button>
									{folder.expanded ? (
										children.length === 0 ? (
											<p className="px-8 py-1 text-[12px] text-muted-foreground">
												{messages.labels.emptyFolder}
											</p>
										) : (
											<ul>
												{children.map((document) => (
													<DocumentRow
														key={document.id}
														document={document}
														indented
														selected={document.id === activeId}
														onActivate={() => {
															onSelectFolder(folder.id);
															onActivate(document.id);
														}}
													/>
												))}
											</ul>
										)
									) : null}
								</li>
							);
						})}
						{rootDocuments.map((document) => (
							<DocumentRow
								key={document.id}
								document={document}
								selected={document.id === activeId}
								onActivate={() => {
									onSelectFolder(undefined);
									onActivate(document.id);
								}}
							/>
						))}
					</ul>
				) : analysis.outline.length === 0 ? (
					<p className="px-3 py-4 text-muted-foreground text-xs leading-relaxed">
						{messages.labels.noOutline}
					</p>
				) : (
					<ol className="flex flex-col py-1">
						{analysis.outline.map((item) => {
							const selected = item.ordinal === activeOutline;
							return (
								<li key={`${item.ordinal}-${item.line}`}>
									<button
										type="button"
										aria-current={selected ? "location" : undefined}
										className={
											selected
												? "w-full truncate py-1 pe-3 text-start text-[13px] text-foreground bg-accent"
												: "w-full truncate py-1 pe-3 text-start text-[13px] text-muted-foreground hover:bg-accent/70 hover:text-foreground"
										}
										style={{ paddingInlineStart: `${0.75 + (item.level - 1) * 0.7}rem` }}
										title={item.title}
										onClick={() => onReveal(item)}
									>
										{item.title}
									</button>
								</li>
							);
						})}
					</ol>
				)}
			</ScrollArea>
		</aside>
	);
}

function DocumentRow({
	document,
	selected,
	indented = false,
	onActivate,
}: {
	readonly document: MarkdownOpenDocument;
	readonly selected: boolean;
	readonly indented?: boolean;
	readonly onActivate: () => void;
}): ReactElement {
	return (
		<li>
			<button
				type="button"
				aria-current={selected ? "page" : undefined}
				className={
					selected
						? "flex w-full items-center gap-2 py-1 pe-3 text-start text-[13px] text-foreground bg-accent"
						: "flex w-full items-center gap-2 py-1 pe-3 text-start text-[13px] text-muted-foreground hover:bg-accent/70 hover:text-foreground"
				}
				style={{ paddingInlineStart: indented ? "1.75rem" : "0.75rem" }}
				onClick={onActivate}
			>
				<FileTextIcon className="size-3.5 shrink-0" />
				<span className="min-w-0 flex-1 truncate">{document.file.name}</span>
				{document.dirty ? (
					<span aria-hidden className="size-1.5 shrink-0 rounded-full bg-foreground/70" />
				) : null}
			</button>
		</li>
	);
}

function SidebarTab({
	selected,
	label,
	onSelect,
}: {
	readonly selected: boolean;
	readonly label: string;
	readonly onSelect: () => void;
}): ReactElement {
	return (
		<button
			type="button"
			role="tab"
			aria-selected={selected}
			className={
				selected
					? "h-8 px-2 font-medium text-[11px] text-foreground uppercase tracking-[0.08em]"
					: "h-8 px-2 font-medium text-[11px] text-muted-foreground uppercase tracking-[0.08em] hover:text-foreground"
			}
			onClick={onSelect}
		>
			{label}
		</button>
	);
}
