import { ToggleGroup, ToggleGroupItem } from "@rezics/ui/ui/toggle-group";
import { NativeSelect, NativeSelectOption } from "@rezics/ui/ui/native-select";
import { ScrollArea } from "@rezics/ui/ui/scroll-area";
import { Separator } from "@rezics/ui/ui/separator";
import FilePlusIcon from "lucide-react/dist/esm/icons/file-plus.mjs";
import FileTextIcon from "lucide-react/dist/esm/icons/file-text.mjs";
import FolderOpenIcon from "lucide-react/dist/esm/icons/folder-open.mjs";
import ListTreeIcon from "lucide-react/dist/esm/icons/list-tree.mjs";
import PanelLeftIcon from "lucide-react/dist/esm/icons/panel-left.mjs";
import PanelRightIcon from "lucide-react/dist/esm/icons/panel-right.mjs";
import SaveIcon from "lucide-react/dist/esm/icons/save.mjs";
import SaveAllIcon from "lucide-react/dist/esm/icons/save-all.mjs";
import XIcon from "lucide-react/dist/esm/icons/x.mjs";
import { lazy, Suspense, useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import { analyzeMarkdownDocument } from "./domain/document-analysis";
import { useMarkdownWorkspace } from "./domain/use-markdown-workspace";
import {
	isMarkdownEditorLocale,
	markdownEditorLocales,
	markdownEditorMessages,
	resolveMarkdownEditorLocale,
	type MarkdownEditorLocale,
} from "./i18n/messages";
import type { MarkdownDocumentStorage } from "./storage";
import { TooltipButton } from "./components/tooltip-button";

const MarkdownEditor = lazy(async () => {
	const module = await import("./components/source-editor");
	return { default: module.MarkdownEditor };
});

export interface MarkdownEditorAppProps {
	readonly storage: MarkdownDocumentStorage;
	readonly initialLocale?: MarkdownEditorLocale;
}

function currentOperationLabel(
	operation: ReturnType<typeof useMarkdownWorkspace>["state"]["operation"],
	messages: (typeof markdownEditorMessages)[MarkdownEditorLocale],
): string | undefined {
	switch (operation.kind) {
		case "idle":
			return undefined;
		case "opening":
			return messages.status.opening;
		case "saving":
			return messages.status.saving;
	}
}

export function MarkdownEditorApp({
	storage,
	initialLocale,
}: MarkdownEditorAppProps): ReactElement {
	const [locale, setLocale] = useState<MarkdownEditorLocale>(
		() =>
			initialLocale ??
			resolveMarkdownEditorLocale(
				typeof navigator === "undefined" ? undefined : navigator.language,
			),
	);
	const messages = markdownEditorMessages[locale];
	const { state, actions } = useMarkdownWorkspace(storage, messages);
	const [showDocuments, setShowDocuments] = useState(true);
	const [showOutline, setShowOutline] = useState(true);
	const analysis = useMemo(
		() => analyzeMarkdownDocument(state.source, locale),
		[locale, state.source],
	);
	const actionRef = useRef(actions);
	const dirtyRef = useRef(state.dirty);
	actionRef.current = actions;
	dirtyRef.current = state.dirty;

	useEffect(() => {
		document.documentElement.lang = locale;
		document.title = messages.documentTitle(state.file.name, state.dirty);
	}, [locale, messages, state.dirty, state.file.name]);

	useEffect(() => {
		const onBeforeUnload = (event: BeforeUnloadEvent) => {
			if (!dirtyRef.current) return;
			event.preventDefault();
		};
		const onKeyDown = (event: KeyboardEvent) => {
			if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
			const key = event.key.toLocaleLowerCase("en-US");
			if (key === "s") {
				event.preventDefault();
				void actionRef.current.saveDocument(event.shiftKey);
			} else if (key === "o") {
				event.preventDefault();
				void actionRef.current.openDocument();
			} else if (key === "n") {
				event.preventDefault();
				actionRef.current.newDocument();
			}
		};
		window.addEventListener("beforeunload", onBeforeUnload);
		window.addEventListener("keydown", onKeyDown);
		return () => {
			window.removeEventListener("beforeunload", onBeforeUnload);
			window.removeEventListener("keydown", onKeyDown);
		};
	}, []);

	const operationLabel = currentOperationLabel(state.operation, messages);
	const busy = state.operation.kind !== "idle";
	const notice = state.notice
		? state.notice.kind === "saved"
			? messages.notices.saved
			: messages.notices.storageErrors[state.notice.code]
		: undefined;
	const noticeIsError = state.notice?.kind !== "saved";

	return (
		<div
			aria-label={messages.labels.application}
			className="relative flex h-dvh min-h-[32rem] min-w-0 overflow-hidden bg-background text-foreground"
			role="application"
		>
			<nav className="z-30 flex w-12 shrink-0 flex-col items-center gap-1 border-border border-e bg-muted/35 px-1.5 py-2">
				<div
					aria-hidden
					className="mb-2 flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm"
				>
					<FileTextIcon className="size-4" />
				</div>
				<TooltipButton
					disabled={busy}
					label={messages.actions.newDocument}
					onClick={actions.newDocument}
					size="icon-md"
					variant="ghost"
				>
					<FilePlusIcon />
				</TooltipButton>
				<TooltipButton
					disabled={busy}
					label={messages.actions.open}
					onClick={() => void actions.openDocument()}
					size="icon-md"
					variant="ghost"
				>
					<FolderOpenIcon />
				</TooltipButton>
				<TooltipButton
					disabled={busy}
					label={messages.actions.save}
					onClick={() => void actions.saveDocument(false)}
					size="icon-md"
					variant="ghost"
				>
					<SaveIcon />
				</TooltipButton>
				<Separator className="my-1" />
				<TooltipButton
					label={messages.actions.showDocuments}
					onClick={() => setShowDocuments((visible) => !visible)}
					size="icon-md"
					variant={showDocuments ? "secondary" : "ghost"}
				>
					<PanelLeftIcon />
				</TooltipButton>
				<TooltipButton
					label={messages.actions.showOutline}
					onClick={() => setShowOutline((visible) => !visible)}
					size="icon-md"
					variant={showOutline ? "secondary" : "ghost"}
				>
					<PanelRightIcon />
				</TooltipButton>
				<div className="mt-auto w-full">
					<label className="sr-only" htmlFor="markdown-editor-locale">
						{messages.labels.language}
					</label>
					<NativeSelect
						aria-label={messages.labels.language}
						className="w-full [&_select]:px-1 [&_select]:text-center [&_svg]:hidden"
						id="markdown-editor-locale"
						onChange={(event) => {
							if (isMarkdownEditorLocale(event.target.value))
								setLocale(event.target.value);
						}}
						size="sm"
						value={locale}
					>
						{markdownEditorLocales.map((availableLocale) => (
							<NativeSelectOption key={availableLocale} value={availableLocale}>
								{messages.languages[availableLocale]}
							</NativeSelectOption>
						))}
					</NativeSelect>
				</div>
			</nav>

			{showDocuments ? (
				<aside
					className="absolute inset-y-0 start-12 z-20 flex w-60 shrink-0 flex-col border-border border-e bg-background shadow-xl md:static md:shadow-none"
					aria-label={messages.labels.documents}
				>
					<header className="flex h-12 shrink-0 items-center px-4 font-semibold text-sm">
						{messages.labels.documents}
					</header>
					<Separator />
					<ScrollArea className="min-h-0 flex-1">
						<div className="p-2">
							<div className="flex w-full items-center gap-2 rounded-lg bg-accent px-3 py-2.5 text-start text-sm">
								<FileTextIcon className="size-4 shrink-0 text-primary" />
								<span className="min-w-0 flex-1 truncate">{state.file.name}</span>
								{state.dirty ? (
									<span
										aria-hidden
										className="size-1.5 shrink-0 rounded-full bg-primary"
									/>
								) : null}
							</div>
						</div>
					</ScrollArea>
					<div className="border-border border-t px-3 py-2 text-muted-foreground text-xs">
						{state.dirty || state.file.kind !== "stored"
							? messages.status.unsaved
							: messages.status.saved}
					</div>
				</aside>
			) : null}

			<main className="flex min-w-0 flex-1 flex-col bg-muted/15">
				<header
					aria-label={messages.labels.editorToolbar}
					className="flex h-12 shrink-0 items-center gap-2 border-border border-b bg-background px-3"
					role="toolbar"
				>
					<div className="min-w-0 flex-1">
						<div className="truncate font-medium text-sm">{state.file.name}</div>
					</div>
					<ToggleGroup
						aria-label={
							state.mode === "source"
								? messages.labels.sourceMode
								: messages.labels.livePreviewMode
						}
						className="rounded-lg border border-input bg-muted/25 p-0.5"
						disabled={busy}
						multiple={false}
						onValueChange={({ value }) => {
							const nextMode = value[0];
							if (nextMode === "source" || nextMode === "preview")
								actions.setMode(nextMode);
						}}
						size="sm"
						value={[state.mode]}
					>
						<ToggleGroupItem value="preview">
							{messages.actions.livePreview}
						</ToggleGroupItem>
						<ToggleGroupItem value="source">{messages.actions.source}</ToggleGroupItem>
					</ToggleGroup>
					<TooltipButton
						disabled={busy}
						label={messages.actions.saveAs}
						onClick={() => void actions.saveDocument(true)}
						size="icon-sm"
						variant="ghost"
					>
						<SaveAllIcon />
					</TooltipButton>
				</header>

				{notice ? (
					<div
						className={
							noticeIsError
								? "flex items-start gap-3 border-destructive/20 border-b bg-destructive/8 px-4 py-2.5 text-destructive text-sm"
								: "flex items-start gap-3 border-primary/20 border-b bg-primary/8 px-4 py-2.5 text-sm"
						}
						role={noticeIsError ? "alert" : "status"}
					>
						<div className="min-w-0 flex-1">
							<p>{notice}</p>
						</div>
						<TooltipButton
							label={messages.actions.dismiss}
							onClick={actions.clearNotice}
							size="icon-xs"
							variant="ghost"
						>
							<XIcon />
						</TooltipButton>
					</div>
				) : null}

				<section
					className="flex min-h-0 flex-1 bg-background"
					aria-label={
						state.mode === "source"
							? messages.labels.sourceEditor
							: messages.labels.livePreviewEditor
					}
				>
					<Suspense
						fallback={
							<div className="m-auto text-muted-foreground text-sm">
								{messages.status.editorLoading}
							</div>
						}
					>
						<MarkdownEditor
							messages={messages}
							mode={state.mode}
							onChange={actions.edit}
							readOnly={state.operation.kind === "opening"}
							value={state.source}
						/>
					</Suspense>
				</section>

				<footer
					className="flex h-7 shrink-0 items-center gap-4 border-border border-t bg-background px-3 text-muted-foreground text-xs"
					aria-live="polite"
				>
					<span>
						{operationLabel ??
							(state.dirty ? messages.status.unsaved : messages.status.saved)}
					</span>
					<span className="ms-auto">{messages.status.words(analysis.words)}</span>
					<span>{messages.status.characters(analysis.characters)}</span>
				</footer>
			</main>

			{showOutline ? (
				<aside
					className="hidden w-64 shrink-0 flex-col border-border border-s bg-background xl:flex"
					aria-label={messages.labels.outline}
				>
					<header className="flex h-12 shrink-0 items-center gap-2 px-4 font-semibold text-sm">
						<ListTreeIcon className="size-4 text-muted-foreground" />
						{messages.labels.outline}
					</header>
					<Separator />
					<ScrollArea className="min-h-0 flex-1">
						{analysis.outline.length === 0 ? (
							<p className="px-4 py-5 text-muted-foreground text-sm leading-relaxed">
								{messages.labels.noOutline}
							</p>
						) : (
							<ol className="space-y-0.5 p-2">
								{analysis.outline.map((item) => (
									<li
										className="truncate rounded-md px-2 py-1.5 text-muted-foreground text-sm hover:bg-accent hover:text-foreground"
										key={`${item.ordinal}-${item.title}`}
										style={{
											paddingInlineStart: `${0.5 + (item.level - 1) * 0.75}rem`,
										}}
										title={item.title}
									>
										{item.title}
									</li>
								))}
							</ol>
						)}
					</ScrollArea>
				</aside>
			) : null}
		</div>
	);
}
