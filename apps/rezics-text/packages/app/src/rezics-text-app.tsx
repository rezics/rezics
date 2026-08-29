import XIcon from "lucide-react/dist/esm/icons/x.mjs";
import { lazy, Suspense, useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import { AboutDialog } from "./components/about-dialog";
import { ApplicationMenuBar } from "./components/application-menu-bar";
import { PreferencesWorkspace } from "./components/preferences-workspace";
import { DocumentTabBar } from "./components/document-tab-bar";
import type { MarkdownEditorHandle } from "./components/source-editor";
import { TooltipButton } from "./components/tooltip-button";
import { WorkspaceSidebar } from "./components/workspace-sidebar";
import { WorkspaceStatusBar } from "./components/workspace-status-bar";
import type { RezicsTextThemePreference } from "./domain/appearance";
import type {
	RezicsTextApplicationCommand,
	RezicsTextNativeMenuHost,
} from "./domain/application-menu";
import type { MarkdownPreferenceSection } from "./domain/preferences";
import { activeOutlineOrdinal, analyzeMarkdownDocument } from "./domain/document-analysis";
import { toggleMarkdownEditingMode, type MarkdownSidebarTab } from "./domain/workspace-chrome";
import { useMarkdownWorkspace } from "./domain/use-markdown-workspace";
import { markdownWorkspaceIsDirty } from "./domain/workspace-state";
import {
	rezicsTextMessages,
	readStoredRezicsTextLocale,
	resolveRezicsTextLocale,
	writeStoredRezicsTextLocale,
	type RezicsTextLocale,
} from "./i18n/messages";
import type { MarkdownDocumentStorage } from "./storage";

const MarkdownEditor = lazy(async () => {
	const module = await import("./components/source-editor");
	return { default: module.MarkdownEditor };
});

export interface RezicsTextAppProps {
	readonly storage: MarkdownDocumentStorage;
	readonly initialLocale?: RezicsTextLocale;
	readonly nativeMenu?: RezicsTextNativeMenuHost;
	readonly themePreference: RezicsTextThemePreference;
	readonly onThemePreferenceChange: (preference: RezicsTextThemePreference) => void;
}

export function RezicsTextApp({
	storage,
	initialLocale,
	nativeMenu,
	themePreference,
	onThemePreferenceChange,
}: RezicsTextAppProps): ReactElement {
	const [locale, setLocale] = useState<RezicsTextLocale>(
		() =>
			initialLocale ??
			(typeof localStorage === "undefined"
				? undefined
				: readStoredRezicsTextLocale(localStorage)) ??
			resolveRezicsTextLocale(typeof navigator === "undefined" ? undefined : navigator.language),
	);
	const messages = rezicsTextMessages[locale];
	const { state, active, actions } = useMarkdownWorkspace(storage, messages);
	const [sidebarOpen, setSidebarOpen] = useState(true);
	const [sidebarTab, setSidebarTab] = useState<MarkdownSidebarTab>("files");
	const [selectedFolderId, setSelectedFolderId] = useState<string | undefined>(undefined);
	const [aboutOpen, setAboutOpen] = useState(false);
	const [preferencesOpen, setPreferencesOpen] = useState(false);
	const [preferenceSection, setPreferenceSection] = useState<MarkdownPreferenceSection>("general");
	const [cursor, setCursor] = useState({ line: 1, column: 1 });
	const analysis = useMemo(
		() => analyzeMarkdownDocument(active.source, locale),
		[locale, active.source],
	);
	const activeHeading = useMemo(
		() => activeOutlineOrdinal(analysis.outline, cursor.line),
		[analysis.outline, cursor.line],
	);
	const editorRef = useRef<MarkdownEditorHandle>(null);
	const actionRef = useRef(actions);
	const dirtyRef = useRef(false);
	const activeIdRef = useRef(active.id);
	const selectedFolderIdRef = useRef(selectedFolderId);
	actionRef.current = actions;
	dirtyRef.current = markdownWorkspaceIsDirty(state);
	activeIdRef.current = active.id;
	selectedFolderIdRef.current = selectedFolderId;

	const runCommand = (command: RezicsTextApplicationCommand): void => {
		switch (command) {
			case "new-document":
				actionRef.current.newDocument(selectedFolderIdRef.current);
				setSidebarTab("files");
				setSidebarOpen(true);
				return;
			case "new-folder": {
				const folderId = actionRef.current.newFolder();
				if (folderId) setSelectedFolderId(folderId);
				setSidebarTab("files");
				setSidebarOpen(true);
				return;
			}
			case "open":
				void actionRef.current.openDocument();
				return;
			case "save":
				void actionRef.current.saveDocument(false);
				return;
			case "save-as":
				void actionRef.current.saveDocument(true);
				return;
			case "close":
				actionRef.current.closeDocument(activeIdRef.current);
				return;
			case "close-all":
				actionRef.current.closeAllDocuments();
				return;
			case "toggle-sidebar":
				setSidebarOpen((open) => !open);
				return;
			case "source":
				actionRef.current.setMode("source");
				return;
			case "preview":
				actionRef.current.setMode("preview");
				return;
			case "about":
				setAboutOpen(true);
				return;
			case "preferences":
				setPreferencesOpen(true);
				return;
		}
	};

	const changeLocale = (next: RezicsTextLocale): void => {
		setLocale(next);
		if (typeof localStorage !== "undefined") writeStoredRezicsTextLocale(localStorage, next);
	};

	useEffect(() => {
		document.documentElement.lang = locale;
		document.title = messages.documentTitle(active.file.name, active.dirty);
	}, [active.dirty, active.file.name, locale, messages]);

	useEffect(() => {
		if (!nativeMenu) return;
		let disposed = false;
		let uninstall: (() => void) | undefined;
		void nativeMenu
			.install({
				messages,
				onCommand: runCommand,
			})
			.then((nextUninstall) => {
				if (disposed) {
					nextUninstall();
					return;
				}
				uninstall = nextUninstall;
			});
		return () => {
			disposed = true;
			uninstall?.();
		};
	}, [messages, nativeMenu]);

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
				runCommand(event.shiftKey ? "save-as" : "save");
			} else if (key === "o") {
				event.preventDefault();
				runCommand("open");
			} else if (key === "n") {
				event.preventDefault();
				runCommand("new-document");
			} else if (key === "w") {
				event.preventDefault();
				runCommand("close");
			} else if (key === "b") {
				event.preventDefault();
				runCommand("toggle-sidebar");
			} else if (key === ",") {
				event.preventDefault();
				runCommand("preferences");
			}
		};
		window.addEventListener("beforeunload", onBeforeUnload);
		window.addEventListener("keydown", onKeyDown);
		return () => {
			window.removeEventListener("beforeunload", onBeforeUnload);
			window.removeEventListener("keydown", onKeyDown);
		};
	}, []);

	const busy = state.operation.kind !== "idle";
	const notice = state.notice
		? state.notice.kind === "saved"
			? messages.notices.saved
			: messages.notices.storageErrors[state.notice.code]
		: undefined;
	const noticeIsError = state.notice?.kind !== "saved";

	if (preferencesOpen) {
		return (
			<>
				<PreferencesWorkspace
					locale={locale}
					messages={messages}
					onBack={() => setPreferencesOpen(false)}
					onLocaleChange={changeLocale}
					onSectionChange={setPreferenceSection}
					onThemePreferenceChange={onThemePreferenceChange}
					section={preferenceSection}
					themePreference={themePreference}
				/>
				<AboutDialog messages={messages} onOpenChange={setAboutOpen} open={aboutOpen} />
			</>
		);
	}

	return (
		<div
			aria-label={messages.labels.application}
			className="flex h-dvh min-h-[32rem] min-w-0 flex-col overflow-hidden bg-background text-foreground"
			role="application"
		>
			{nativeMenu ? null : <ApplicationMenuBar messages={messages} onCommand={runCommand} />}
			<div className="relative flex min-h-0 min-w-0 flex-1">
				<div
					aria-hidden={!sidebarOpen}
					className={
						sidebarOpen
							? "w-60 shrink-0 overflow-hidden border-border border-e transition-[width] duration-200 ease-out motion-reduce:transition-none"
							: "w-0 shrink-0 overflow-hidden border-border border-e-0 transition-[width] duration-200 ease-out motion-reduce:transition-none"
					}
				>
					<WorkspaceSidebar
						activeId={active.id}
						activeOutline={activeHeading}
						analysis={analysis}
						busy={busy}
						documents={state.documents}
						folders={state.folders}
						messages={messages}
						onActivate={actions.activateDocument}
						onNewDocument={() => actions.newDocument(selectedFolderId)}
						onNewFolder={() => {
							const folderId = actions.newFolder();
							if (folderId) setSelectedFolderId(folderId);
						}}
						onReveal={(item) => editorRef.current?.revealOffset(item.from)}
						onSelectFolder={setSelectedFolderId}
						onTabChange={setSidebarTab}
						onToggleFolder={actions.toggleFolder}
						selectedFolderId={selectedFolderId}
						tab={sidebarTab}
					/>
				</div>

				<main className="flex min-w-0 flex-1 flex-col">
					<DocumentTabBar
						activeId={active.id}
						documents={state.documents}
						messages={messages}
						onActivate={actions.activateDocument}
						onClose={actions.closeDocument}
					/>

					{notice ? (
						<div
							className={
								noticeIsError
									? "flex items-center gap-3 border-destructive/20 border-b bg-destructive/8 px-3 py-1.5 text-destructive text-[13px]"
									: "flex items-center gap-3 border-primary/20 border-b bg-primary/8 px-3 py-1.5 text-[13px]"
							}
							role={noticeIsError ? "alert" : "status"}
						>
							<p className="min-w-0 flex-1">{notice}</p>
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
						aria-label={
							state.mode === "source"
								? messages.labels.sourceEditor
								: messages.labels.livePreviewEditor
						}
						className="flex min-h-0 min-w-0 flex-1 flex-col bg-background"
					>
						<Suspense
							fallback={
								<div className="m-auto text-muted-foreground text-sm">
									{messages.status.editorLoading}
								</div>
							}
						>
							<MarkdownEditor
								documentId={active.id}
								messages={messages}
								mode={state.mode}
								onChange={actions.edit}
								onCursorChange={setCursor}
								readOnly={state.operation.kind === "opening"}
								ref={editorRef}
								value={active.source}
							/>
						</Suspense>
					</section>
				</main>
			</div>

			<AboutDialog messages={messages} onOpenChange={setAboutOpen} open={aboutOpen} />
			<WorkspaceStatusBar
				analysis={analysis}
				cursor={cursor}
				dirty={active.dirty}
				messages={messages}
				mode={state.mode}
				onToggleMode={() => actions.setMode(toggleMarkdownEditingMode(state.mode))}
				onToggleSidebar={() => setSidebarOpen((open) => !open)}
				operation={state.operation}
				sidebarOpen={sidebarOpen}
			/>
		</div>
	);
}
