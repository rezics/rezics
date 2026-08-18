import CodeIcon from "lucide-react/dist/esm/icons/code.mjs";
import PanelLeftIcon from "lucide-react/dist/esm/icons/panel-left.mjs";
import type { ReactElement } from "react";
import type { MarkdownDocumentAnalysis } from "../domain/document-analysis";
import type { MarkdownEditingMode, MarkdownWorkspaceOperation } from "../domain/workspace-state";
import type { MarkdownEditorMessages } from "../i18n/messages";
import type { MarkdownEditorCursor } from "./source-editor";
import { TooltipButton } from "./tooltip-button";

export function WorkspaceStatusBar({
	messages,
	operation,
	dirty,
	mode,
	sidebarOpen,
	onToggleSidebar,
	onToggleMode,
	cursor,
	analysis,
}: {
	readonly messages: MarkdownEditorMessages;
	readonly operation: MarkdownWorkspaceOperation;
	readonly dirty: boolean;
	readonly mode: MarkdownEditingMode;
	readonly sidebarOpen: boolean;
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

	return (
		<footer
			aria-label={messages.labels.statusBar}
			aria-live="polite"
			className="flex h-7 shrink-0 items-center gap-2 overflow-x-auto border-border border-t bg-muted/80 px-1.5 text-[11px] text-muted-foreground"
		>
			<TooltipButton
				aria-pressed={sidebarOpen}
				className={sidebarOpen ? "text-foreground" : undefined}
				label={sidebarOpen ? messages.actions.hideSidebar : messages.actions.showSidebar}
				onClick={onToggleSidebar}
				size="icon-xs"
				variant="ghost"
			>
				<PanelLeftIcon />
			</TooltipButton>
			<TooltipButton
				aria-pressed={mode === "source"}
				className={mode === "source" ? "text-foreground" : undefined}
				label={mode === "source" ? messages.actions.enterLivePreview : messages.actions.enterSource}
				onClick={onToggleMode}
				size="icon-xs"
				variant="ghost"
			>
				<CodeIcon />
			</TooltipButton>
			<span className="ms-1">
				{operationLabel ?? (dirty ? messages.status.unsaved : messages.status.saved)}
			</span>
			<span>
				{mode === "source" ? messages.labels.sourceMode : messages.labels.livePreviewMode}
			</span>
			<span className="ms-auto tabular-nums">
				{messages.status.cursor(cursor.line, cursor.column)}
			</span>
			<span className="tabular-nums">{messages.status.words(analysis.words)}</span>
			<span className="tabular-nums">{messages.status.characters(analysis.characters)}</span>
			<span className="tabular-nums">{messages.status.lines(analysis.lines)}</span>
			<span className="tabular-nums">{messages.status.headings(analysis.headings)}</span>
			<span>{messages.status.readingTime(analysis.readingMinutes)}</span>
		</footer>
	);
}
