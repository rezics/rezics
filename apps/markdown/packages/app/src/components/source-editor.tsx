import {
	insertMarkdownFencedCode,
	insertMarkdownLink,
	insertMarkdownTable,
	rezicsMarkdown,
	rezicsMarkdownLivePreview,
	setMarkdownHeading,
	toggleMarkdownBlockquote,
	toggleMarkdownBulletList,
	toggleMarkdownEmphasis,
	toggleMarkdownInlineCode,
	toggleMarkdownNumberedList,
	toggleMarkdownStrikethrough,
	toggleMarkdownStrong,
	toggleMarkdownTaskList,
} from "@rezics/editor/markdown";
import {
	CodeEditor,
	type CodeEditorHandle,
	type Command,
	type Extension,
} from "@rezics/editor/codemirror";
import { Separator } from "@rezics/ui/ui/separator";
import BoldIcon from "lucide-react/dist/esm/icons/bold.mjs";
import BracesIcon from "lucide-react/dist/esm/icons/braces.mjs";
import CodeIcon from "lucide-react/dist/esm/icons/code.mjs";
import Heading1Icon from "lucide-react/dist/esm/icons/heading-1.mjs";
import Heading2Icon from "lucide-react/dist/esm/icons/heading-2.mjs";
import ItalicIcon from "lucide-react/dist/esm/icons/italic.mjs";
import LinkIcon from "lucide-react/dist/esm/icons/link.mjs";
import ListIcon from "lucide-react/dist/esm/icons/list.mjs";
import ListChecksIcon from "lucide-react/dist/esm/icons/list-checks.mjs";
import ListOrderedIcon from "lucide-react/dist/esm/icons/list-ordered.mjs";
import QuoteIcon from "lucide-react/dist/esm/icons/quote.mjs";
import StrikethroughIcon from "lucide-react/dist/esm/icons/strikethrough.mjs";
import TableIcon from "lucide-react/dist/esm/icons/table.mjs";
import { useRef, type ReactElement } from "react";
import type { MarkdownEditorMessages } from "../i18n/messages";
import type { MarkdownEditingMode } from "../domain/workspace-state";
import { TooltipButton } from "./tooltip-button";

const sourceExtensions: readonly Extension[] = [rezicsMarkdown()];
const previewExtensions: readonly Extension[] = [rezicsMarkdown(), rezicsMarkdownLivePreview()];

export function MarkdownEditor({
	value,
	onChange,
	messages,
	mode,
	readOnly = false,
}: {
	readonly value: string;
	readonly onChange: (value: string) => void;
	readonly messages: MarkdownEditorMessages;
	readonly mode: MarkdownEditingMode;
	readonly readOnly?: boolean;
}): ReactElement {
	const editorRef = useRef<CodeEditorHandle>(null);
	const run = (command: Command): void => {
		const view = editorRef.current?.getView();
		if (!view) return;
		command(view);
		view.focus();
	};
	const iconButton = (label: string, command: Command, icon: ReactElement) => (
		<TooltipButton
			disabled={readOnly}
			key={label}
			label={label}
			onClick={() => run(command)}
			size="icon-sm"
			variant="ghost"
		>
			{icon}
		</TooltipButton>
	);

	return (
		<div className="flex min-h-0 flex-1 flex-col">
			<div
				aria-label={messages.labels.formattingToolbar}
				className="flex min-h-10 shrink-0 items-center gap-0.5 overflow-x-auto border-border border-b bg-muted/20 px-2"
				role="toolbar"
			>
				{iconButton(messages.actions.bold, toggleMarkdownStrong, <BoldIcon />)}
				{iconButton(messages.actions.italic, toggleMarkdownEmphasis, <ItalicIcon />)}
				{iconButton(
					messages.actions.strikethrough,
					toggleMarkdownStrikethrough,
					<StrikethroughIcon />,
				)}
				{iconButton(messages.actions.inlineCode, toggleMarkdownInlineCode, <CodeIcon />)}
				<Separator className="mx-1 h-5" orientation="vertical" />
				{iconButton(messages.actions.heading1, setMarkdownHeading(1), <Heading1Icon />)}
				{iconButton(messages.actions.heading2, setMarkdownHeading(2), <Heading2Icon />)}
				{iconButton(messages.actions.quote, toggleMarkdownBlockquote, <QuoteIcon />)}
				<Separator className="mx-1 h-5" orientation="vertical" />
				{iconButton(messages.actions.bulletList, toggleMarkdownBulletList, <ListIcon />)}
				{iconButton(
					messages.actions.numberedList,
					toggleMarkdownNumberedList,
					<ListOrderedIcon />,
				)}
				{iconButton(messages.actions.taskList, toggleMarkdownTaskList, <ListChecksIcon />)}
				<Separator className="mx-1 h-5" orientation="vertical" />
				{iconButton(messages.actions.link, insertMarkdownLink, <LinkIcon />)}
				{iconButton(messages.actions.table, insertMarkdownTable, <TableIcon />)}
				{iconButton(messages.actions.codeBlock, insertMarkdownFencedCode, <BracesIcon />)}
			</div>
			<CodeEditor
				ariaLabel={
					mode === "preview"
						? messages.labels.livePreviewEditor
						: messages.labels.sourceEditor
				}
				className={
					mode === "preview"
						? "rezics-markdown-live-preview min-h-0 flex-1 [&_.cm-editor]:h-full"
						: "min-h-0 flex-1 [&_.cm-editor]:h-full"
				}
				extensions={mode === "preview" ? previewExtensions : sourceExtensions}
				onChange={onChange}
				ref={editorRef}
				readOnly={readOnly}
				value={value}
			/>
		</div>
	);
}
