import { Button } from "@rezics/ui/ui/button";
import {
	Popover,
	PopoverBody,
	PopoverContent,
	PopoverHeader,
	PopoverTrigger,
} from "@rezics/ui/ui/popover";
import CodeIcon from "lucide-react/dist/esm/icons/code.mjs";
import PanelLeftIcon from "lucide-react/dist/esm/icons/panel-left.mjs";
import type { ReactElement } from "react";
import type { MarkdownDocumentAnalysis } from "../domain/document-analysis";
import type { MarkdownEditingMode, MarkdownWorkspaceOperation } from "../domain/workspace-state";
import type { RezicsTextMessages } from "../i18n/messages";
import type { MarkdownEditorCursor } from "./source-editor";
import { TooltipButton } from "./tooltip-button";

export function WorkspaceStatusBar({
	messages,
	operation,
	documentOpen,
	dirty,
	stored,
	mode,
	sidebarOpen,
	sidebarShortcut,
	sidebarShortcutAria,
	onToggleSidebar,
	onToggleMode,
	cursor,
	analysis,
}: {
	readonly messages: RezicsTextMessages;
	readonly operation: MarkdownWorkspaceOperation;
	readonly documentOpen: boolean;
	readonly dirty: boolean;
	readonly stored: boolean;
	readonly mode: MarkdownEditingMode;
	readonly sidebarOpen: boolean;
	readonly sidebarShortcut: string;
	readonly sidebarShortcutAria: string;
	readonly onToggleSidebar: () => void;
	readonly onToggleMode: () => void;
	readonly cursor: MarkdownEditorCursor;
	readonly analysis: MarkdownDocumentAnalysis;
}): ReactElement {
	const operationLabel =
		operation.kind === "opening"
			? messages.status.opening
			: operation.kind === "saving"
				? messages.status.saving
				: undefined;
	const saveStateLabel = dirty
		? messages.status.unsaved
		: stored
			? messages.status.saved
			: undefined;
	const statusLabel = operationLabel ?? saveStateLabel;

	return (
		<footer
			aria-label={messages.labels.statusBar}
			className="flex h-8 shrink-0 items-center gap-1 overflow-x-auto border-border-weak border-t bg-surface-container px-1.5 text-[11px] text-muted-foreground"
		>
			<TooltipButton
				aria-keyshortcuts={sidebarShortcutAria}
				aria-pressed={sidebarOpen}
				className={sidebarOpen ? "text-foreground" : undefined}
				label={sidebarOpen ? messages.actions.hideSidebar : messages.actions.showSidebar}
				onClick={onToggleSidebar}
				shortcut={sidebarShortcut}
				size="icon-xs"
				variant="ghost"
			>
				<PanelLeftIcon />
			</TooltipButton>
			{documentOpen ? (
				<TooltipButton
					aria-pressed={mode === "source"}
					className={mode === "source" ? "text-foreground" : undefined}
					label={
						mode === "source" ? messages.actions.enterLivePreview : messages.actions.enterSource
					}
					onClick={onToggleMode}
					size="icon-xs"
					variant="ghost"
				>
					<CodeIcon />
				</TooltipButton>
			) : null}
			{statusLabel ? (
				<span aria-live="polite" className="ms-1 whitespace-nowrap">
					{statusLabel}
				</span>
			) : null}
			{documentOpen ? (
				<>
					<span className="whitespace-nowrap">
						{mode === "source" ? messages.labels.sourceMode : messages.labels.livePreviewMode}
					</span>
					<span className="ms-auto whitespace-nowrap tabular-nums">
						{messages.status.cursor(cursor.line, cursor.column)}
					</span>
					<Popover positioning={{ placement: "top-end" }}>
						<PopoverTrigger asChild>
							<Button
								aria-label={messages.labels.documentStatistics}
								className="whitespace-nowrap px-1.5 font-normal text-muted-foreground text-xs tabular-nums"
								size="xs"
								variant="ghost"
							>
								{messages.status.words(analysis.words)}
							</Button>
						</PopoverTrigger>
						<PopoverContent className="w-64">
							<PopoverHeader>{messages.labels.documentStatistics}</PopoverHeader>
							<PopoverBody>
								<ul className="flex flex-col gap-2 text-sm tabular-nums">
									<li>{messages.status.words(analysis.words)}</li>
									<li>{messages.status.characters(analysis.characters)}</li>
									<li>{messages.status.lines(analysis.lines)}</li>
									<li>{messages.status.headings(analysis.headings)}</li>
									<li>{messages.status.readingTime(analysis.readingMinutes)}</li>
								</ul>
							</PopoverBody>
						</PopoverContent>
					</Popover>
				</>
			) : null}
		</footer>
	);
}
