"use client";

import { isContentLanguage, type ContentLanguage } from "@rezics/i18n";

import {
	type GetApiChaptersByChapterIdStatus200,
	useGetApiChaptersByChapterId,
	useGetApiUnitsBookByUnitIdContentStructureNodes,
	useGetApiUnitsByTypeByUnitId,
	usePutApiChaptersByChapterIdLocalizationsByLanguageContent,
} from "@rezics/openapi-tanstack-query";
import { measurePortableText, type PortableTextValue } from "@rezics/portable-text";
import { useQueryClient } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
	ArrowLeftIcon,
	ChevronRightIcon,
	HistoryIcon,
	LanguagesIcon,
	ListTreeIcon,
	SettingsIcon,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";

import { PageHeading } from "@rezics/ui";
import { QueryFailure, QueryPending } from "@rezics/ui";
import { Button } from "@rezics/ui";
import { Card, CardContent } from "@rezics/ui";
import { Field, FieldGroup, FieldLabel } from "@rezics/ui";
import { Input } from "@rezics/ui";
import {
	Menu,
	MenuContent,
	MenuRadioGroup,
	MenuRadioItem,
	MenuSub,
	MenuSubContent,
	MenuSubTrigger,
	MenuTrigger,
} from "@rezics/ui";
import { NativeSelect, NativeSelectOption } from "@rezics/ui";
import { Skeleton } from "@rezics/ui";
import { Sheet, SheetBody, SheetContent, SheetHeader, SheetTrigger } from "@rezics/ui";
import { cn } from "@rezics/ui";
import { RequireSession } from "@/features/auth/require-session";
import { ContentLanguageControl } from "@/features/content-languages/components/content-language-control";
import { ContentLanguageEditorBoundary } from "@/features/content-languages/components/content-language-editor-boundary";
import { useContentLanguageEditor } from "@/features/content-languages/hooks/use-content-language-editor";
import { PortableTextEditor } from "@/features/editor/portable-text-editor";
import { ReplyPostThread } from "@/features/posts/reply-thread";
import { useTranslation } from "@/i18n/client";
import { useLocalizationFallbackToast } from "@/i18n/use-localization-fallback-toast";
import { useLocalizationLanguages } from "@/i18n/use-localization-languages";
import { RequestFailure } from "@/i18n/request-failure";
import { hasErrorCode } from "@/i18n/errors";
import { readPortableText, writePortableText } from "@/lib/block";
import { LocalizedPortableTextContent } from "@/features/content-language-display/localized-portable-text-content";
import { LocalizedText } from "@/features/content-language-display/chinese-content-display-context";
import { buildContentStructureTree, type ContentStructureTreeNode } from "./content-structure-tree";
import {
	collectBookStructureLabelIds,
	flattenVisibleBookStructureTree,
	isBookStructureDisplayLabel,
} from "./model/book-content-structure-view";
import { catalogDetailHref } from "./routing/catalog-detail-routes";
import { invalidateChapterContent } from "./unit-cache";
import { chapterHistoryHref, unitManagementSectionHref } from "./routing/unit-management-routes";

const ReaderOutlineRowHeight = 36;
const NestedMenuPositioning = { placement: "right-start", gutter: -2 } as const;

function ContentReadTree({
	bookId,
	label,
	nodes,
	currentChapterId,
	className,
}: {
	bookId: string;
	label: string;
	nodes: readonly ContentStructureTreeNode[];
	currentChapterId?: string;
	className?: string;
}) {
	const scrollRef = useRef<HTMLDivElement>(null);
	const labelIds = useMemo(() => collectBookStructureLabelIds(nodes), [nodes]);
	const [expandedIds, setExpandedIds] = useState<ReadonlySet<string>>(() => new Set(labelIds));
	const activeAncestorLabelIds = useMemo(
		() => findChapterAncestorLabelIds(nodes, currentChapterId),
		[nodes, currentChapterId],
	);

	useEffect(() => {
		if (!activeAncestorLabelIds.length) return;
		setExpandedIds((current) => {
			if (activeAncestorLabelIds.every((id) => current.has(id))) return current;
			return new Set([...current, ...activeAncestorLabelIds]);
		});
	}, [activeAncestorLabelIds]);

	const entries = useMemo(
		() => flattenVisibleBookStructureTree(nodes, expandedIds),
		[nodes, expandedIds],
	);
	const activeIndex = useMemo(
		() =>
			currentChapterId
				? entries.findIndex(
						({ entry }) =>
							entry.node.contentKind === "chapter" &&
							entry.node.contentUnitId === currentChapterId,
					)
				: -1,
		[entries, currentChapterId],
	);
	const getItemKey = useCallback(
		(index: number) => entries[index]?.entry.node.id ?? index,
		[entries],
	);
	const virtualizer = useVirtualizer<HTMLDivElement, HTMLDivElement>({
		count: entries.length,
		estimateSize: () => ReaderOutlineRowHeight,
		getItemKey,
		getScrollElement: () => scrollRef.current,
		overscan: 8,
	});

	useEffect(() => {
		if (activeIndex < 0) return;
		const frame = requestAnimationFrame(() => {
			virtualizer.scrollToIndex(activeIndex, { align: "center" });
		});
		return () => cancelAnimationFrame(frame);
	}, [activeIndex, virtualizer]);

	const toggleLabel = useCallback((nodeId: string) => {
		setExpandedIds((current) => {
			const next = new Set(current);
			if (next.has(nodeId)) next.delete(nodeId);
			else next.add(nodeId);
			return next;
		});
	}, []);

	return (
		<nav
			aria-label={label}
			className={cn(
				"min-h-0 overflow-y-auto overscroll-contain rounded-lg border",
				className,
			)}
			ref={scrollRef}
		>
			<div
				className="relative w-full"
				role="list"
				style={{ height: virtualizer.getTotalSize() }}
			>
				{virtualizer.getVirtualItems().map((virtualRow) => {
					const visibleEntry = entries[virtualRow.index];
					if (!visibleEntry) return null;
					const { depth, entry, positionInSet, setSize } = visibleEntry;
					const { node } = entry;
					const labelNode = isBookStructureDisplayLabel(entry);
					const expanded = expandedIds.has(node.id);
					const current =
						node.contentKind === "chapter" && node.contentUnitId === currentChapterId;
					const rowClassName = cn(
						"absolute start-0 top-0 flex h-9 w-full items-center gap-1 rounded-md pe-2 text-sm outline-none",
						labelNode
							? "font-medium text-foreground"
							: "text-muted-foreground hover:bg-muted hover:text-foreground",
						current && "bg-surface-selected text-foreground",
					);
					const rowStyle = {
						paddingInlineStart: `${0.5 + depth * 1.125}rem`,
						transform: `translateY(${virtualRow.start}px)`,
					};

					return (
						<div
							aria-posinset={positionInSet}
							aria-setsize={setSize}
							data-content-kind={node.contentKind}
							data-current={current ? "" : undefined}
							key={virtualRow.key}
							role="listitem"
						>
							{labelNode ? (
								<button
									aria-expanded={expanded}
									className={cn(
										rowClassName,
										"hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring",
									)}
									onClick={() => toggleLabel(node.id)}
									style={rowStyle}
									type="button"
								>
									<ChevronRightIcon
										aria-hidden
										className={cn(
											"size-3.5 shrink-0 transition-transform motion-reduce:transition-none",
											expanded && "rotate-90",
										)}
									/>
									<span className="truncate">
										<LocalizedText
											language={node.language}
											value={node.title}
										/>
									</span>
								</button>
							) : (
								<Link
									aria-current={current ? "page" : undefined}
									className={rowClassName}
									href={`/units/book/${bookId}/read/${node.contentUnitId}`}
									style={rowStyle}
								>
									<span className="truncate">
										<LocalizedText
											language={node.language}
											value={node.title}
										/>
									</span>
								</Link>
							)}
						</div>
					);
				})}
			</div>
		</nav>
	);
}

function findChapterAncestorLabelIds(
	nodes: readonly ContentStructureTreeNode[],
	chapterId?: string,
): string[] {
	if (!chapterId) return [];
	for (const entry of nodes) {
		if (entry.node.contentKind === "chapter" && entry.node.contentUnitId === chapterId)
			return [];
		const descendants = findChapterAncestorLabelIds(entry.children, chapterId);
		if (
			descendants.length ||
			entry.children.some(
				({ node }) => node.contentKind === "chapter" && node.contentUnitId === chapterId,
			)
		)
			return entry.node.contentKind === "label"
				? [entry.node.id, ...descendants]
				: descendants;
	}
	return [];
}

const ReaderFontSizeOptions = [
	{ value: "12", className: "text-[12px]!" },
	{ value: "14", className: "text-[14px]!" },
	{ value: "16", className: "text-[16px]!" },
	{ value: "18", className: "text-[18px]!" },
	{ value: "20", className: "text-[20px]!" },
	{ value: "22", className: "text-[22px]!" },
	{ value: "24", className: "text-[24px]!" },
	{ value: "26", className: "text-[26px]!" },
	{ value: "28", className: "text-[28px]!" },
	{ value: "30", className: "text-[30px]!" },
	{ value: "32", className: "text-[32px]!" },
] as const;

type ReaderFontSizeOption = (typeof ReaderFontSizeOptions)[number];
const DefaultReaderFontSize = ReaderFontSizeOptions[3];
const ReaderFontSizeStorageKey = "rezics:reader-font-size:v1";

function findReaderFontSizeOption(value: string): ReaderFontSizeOption | undefined {
	return ReaderFontSizeOptions.find((option) => option.value === value);
}

function loadReaderFontSize(): ReaderFontSizeOption | undefined {
	try {
		const storedValue = localStorage.getItem(ReaderFontSizeStorageKey);
		return storedValue ? findReaderFontSizeOption(storedValue) : undefined;
	} catch {
		return undefined;
	}
}

function saveReaderFontSize(fontSize: ReaderFontSizeOption): void {
	try {
		localStorage.setItem(ReaderFontSizeStorageKey, fontSize.value);
	} catch {
		// The in-memory setting still works when browser storage is unavailable.
	}
}

export function Reader({ bookId, chapterId }: { bookId: string; chapterId: string }) {
	const { t } = useTranslation(["actions", "brand", "errors", "locale", "state", "ui", "units"]);
	const localizationLanguages = useLocalizationLanguages();
	const [fontSize, setFontSize] = useState<ReaderFontSizeOption>(DefaultReaderFontSize);
	useEffect(() => {
		const storedFontSize = loadReaderFontSize();
		if (storedFontSize) setFontSize(storedFontSize);
	}, []);
	const [languageSelection, setLanguageSelection] = useState<{
		readonly chapterId: string;
		readonly language: ContentLanguage;
	} | null>(null);
	const selectedLanguage =
		languageSelection?.chapterId === chapterId ? languageSelection.language : undefined;
	const query = useGetApiChaptersByChapterId({
		path: { chapterId },
		query: {
			localizationLanguages,
			...(selectedLanguage ? { language: selectedLanguage } : {}),
		},
	});
	useLocalizationFallbackToast({
		actualLanguage: selectedLanguage ? null : (query.data?.language ?? null),
		localizationLanguages,
		unitId: chapterId,
	});
	const outline = useGetApiUnitsBookByUnitIdContentStructureNodes({
		path: { unitId: bookId },
		query: { localizationLanguages },
	});
	const tree = useMemo(
		() => (outline.data?.items.length ? buildContentStructureTree(outline.data.items) : []),
		[outline.data?.items],
	);
	if (query.isPending) return <QueryPending />;
	if (query.isError)
		return <QueryFailure error={query.error} retry={() => void query.refetch()} />;
	if (!query.data) return <QueryPending />;
	const selectedLanguageLabel =
		selectedLanguage === undefined
			? t.units.reader.automaticLanguage
			: t.locale.contentLanguages[selectedLanguage];
	return (
		<main
			className="fixed inset-0 z-50 grid grid-rows-[3.75rem_minmax(0,1fr)] overflow-hidden bg-background"
			id="main-content"
		>
			<header className="flex min-w-0 items-center gap-2 border-b bg-background/95 px-3 backdrop-blur sm:px-5">
				<Button asChild className="size-11 sm:size-10" size="icon-xl" variant="quiet">
					<Link
						aria-label={t.units.reader.backToContents}
						href={catalogDetailHref("book", bookId, "contents")}
					>
						<ArrowLeftIcon aria-hidden />
					</Link>
				</Button>
				<span className="hidden font-serif font-semibold text-foreground sm:block">
					{t.brand.name}
				</span>
				<span aria-hidden className="hidden h-5 w-px bg-border sm:block" />
				<p className="min-w-0 flex-1 truncate font-medium text-sm">
					<LocalizedText language={query.data.language} value={query.data.title} />
				</p>

				<Sheet>
					<SheetTrigger asChild>
						<Button
							aria-label={t.units.content.title}
							className="size-11 sm:size-10 md:hidden"
							size="icon-xl"
							variant="quiet"
						>
							<ListTreeIcon aria-hidden />
						</Button>
					</SheetTrigger>
					<SheetContent placement="left">
						<SheetHeader title={t.units.content.title} />
						<SheetBody className="h-full min-h-0 overflow-hidden p-4">
							<ReaderOutline
								bookId={bookId}
								className="h-[calc(100svh-7.75rem)] border-0"
								currentChapterId={chapterId}
								outline={outline}
								tree={tree}
							/>
						</SheetBody>
					</SheetContent>
				</Sheet>

				<Menu positioning={{ placement: "bottom-end", gutter: 8 }}>
					<MenuTrigger asChild>
						<Button
							aria-label={t.units.reader.settings}
							className="size-11 sm:size-10"
							size="icon-xl"
							variant="quiet"
						>
							<SettingsIcon aria-hidden />
						</Button>
					</MenuTrigger>
					<MenuContent className="w-64 p-1.5">
						<Field className="gap-1.5 p-2">
							<FieldLabel htmlFor="reader-font-size">
								{t.units.reader.fontSize}
							</FieldLabel>
							<NativeSelect
								id="reader-font-size"
								onChange={(event) => {
									const value = event.currentTarget.value;
									const option = findReaderFontSizeOption(value);
									if (option) {
										setFontSize(option);
										saveReaderFontSize(option);
									}
								}}
								value={fontSize.value}
							>
								{ReaderFontSizeOptions.map((option) => (
									<NativeSelectOption key={option.value} value={option.value}>
										{option.value}
									</NativeSelectOption>
								))}
							</NativeSelect>
						</Field>
						<MenuSub positioning={NestedMenuPositioning}>
							<MenuSubTrigger>
								<LanguagesIcon aria-hidden />
								<span>{t.units.reader.chapterLanguage}</span>
								<span className="ms-auto max-w-24 truncate text-muted-foreground">
									{selectedLanguageLabel}
								</span>
							</MenuSubTrigger>
							<MenuSubContent className="w-56">
								<MenuRadioGroup
									heading={t.units.reader.chapterLanguage}
									onValueChange={({ value }) => {
										if (value === "automatic") setLanguageSelection(null);
										else if (isContentLanguage(value))
											setLanguageSelection({ chapterId, language: value });
									}}
									value={selectedLanguage ?? "automatic"}
								>
									<MenuRadioItem closeOnSelect={false} value="automatic">
										{t.units.reader.automaticLanguage}
									</MenuRadioItem>
									{query.data.availableLanguages.map((language) => (
										<MenuRadioItem
											closeOnSelect={false}
											key={language}
											value={language}
										>
											{t.locale.contentLanguages[language]}
										</MenuRadioItem>
									))}
								</MenuRadioGroup>
							</MenuSubContent>
						</MenuSub>
					</MenuContent>
				</Menu>
			</header>

			<div className="grid min-h-0 md:grid-cols-[17rem_minmax(0,1fr)]">
				<aside className="hidden min-h-0 flex-col overflow-hidden border-e bg-card/45 p-4 md:flex">
					<p className="mb-3 px-2 font-serif font-semibold text-lg">
						{t.units.content.title}
					</p>
					<ReaderOutline
						bookId={bookId}
						className="min-h-0 flex-1 border-0 bg-transparent"
						currentChapterId={chapterId}
						outline={outline}
						tree={tree}
					/>
				</aside>

				<div className="min-h-0 overflow-y-auto scroll-smooth">
					<div className="mx-auto flex min-h-full w-full max-w-[48rem] flex-col px-5 py-8 sm:px-10 sm:py-12">
						<header className="border-b pb-7">
							<p className="font-semibold text-muted-foreground text-xs uppercase tracking-[0.16em]">
								{t.units.content.chapter}
							</p>
							<h1 className="mt-3 font-serif font-semibold text-3xl tracking-tight sm:text-4xl">
								<LocalizedText
									language={query.data.language}
									value={query.data.title}
								/>
							</h1>
						</header>
						<article className="flex-1 py-8">
							{query.data.content ? (
								<LocalizedPortableTextContent
									className={cn(
										fontSize.className,
										"prose-p:leading-[1.8]! prose-li:leading-[1.8]!",
									)}
									language={query.data.language}
									value={readPortableText(query.data.content)}
									variant="article"
								/>
							) : null}
						</article>
						<footer className="flex flex-wrap items-center justify-between gap-3 border-t pt-6">
							{query.data.previousChapterId ? (
								<Button asChild className="min-h-11 sm:min-h-8" variant="outline">
									<Link
										href={`/units/book/${bookId}/read/${query.data.previousChapterId}`}
									>
										{t.ui.previousChapter}
									</Link>
								</Button>
							) : (
								<span />
							)}
							{query.data.nextChapterId ? (
								<Button variant="solid" asChild className="min-h-11 sm:min-h-8">
									<Link
										href={`/units/book/${bookId}/read/${query.data.nextChapterId}`}
									>
										{t.ui.nextChapter}
									</Link>
								</Button>
							) : (
								<span />
							)}
						</footer>
						<div className="mt-10 border-t pt-8">
							<ReplyPostThread
								canReply={query.data.capabilities.canReply}
								rootPostId={chapterId}
								signInDestination={`/units/book/${bookId}/read/${chapterId}#replies`}
							/>
						</div>
					</div>
				</div>
			</div>
		</main>
	);
}

function ReaderOutline({
	bookId,
	className,
	currentChapterId,
	outline,
	tree,
}: {
	bookId: string;
	className?: string;
	currentChapterId: string;
	outline: ReturnType<typeof useGetApiUnitsBookByUnitIdContentStructureNodes>;
	tree: readonly ContentStructureTreeNode[];
}) {
	const { t } = useTranslation(["actions", "errors", "state", "ui", "units"]);
	if (outline.isPending) return <Skeleton className="h-60" />;
	if (outline.isError)
		return (
			<div className="grid gap-3">
				<RequestFailure error={outline.error} />
				<Button className="w-fit" onClick={() => void outline.refetch()} variant="outline">
					{t.actions.retry}
				</Button>
			</div>
		);
	if (!tree.length)
		return <p className="px-2 text-muted-foreground text-sm">{t.units.content.noContent}</p>;
	return (
		<ContentReadTree
			bookId={bookId}
			className={className}
			currentChapterId={currentChapterId}
			label={t.units.content.title}
			nodes={tree}
		/>
	);
}

export function ChapterLocalizationEdit({
	bookId,
	chapterId,
}: {
	bookId: string;
	chapterId: string;
}) {
	return (
		<RequireSession>
			<ChapterLocalizationEditorContent bookId={bookId} chapterId={chapterId} />
		</RequireSession>
	);
}

function ChapterLocalizationEditorContent({
	bookId,
	chapterId,
}: {
	bookId: string;
	chapterId: string;
}) {
	const { t } = useTranslation(["actions", "errors", "state", "ui", "units"]);
	const localizationLanguages = useLocalizationLanguages();
	const book = useGetApiUnitsByTypeByUnitId({
		path: { type: "book", unitId: bookId },
		query: { localizationLanguages },
	});
	if (book.isPending) return <QueryPending />;
	if (book.isError) return <QueryFailure error={book.error} retry={() => void book.refetch()} />;
	if (!book.data) return <QueryPending />;
	if (!book.data.capabilities.canEdit)
		return (
			<main className="mx-auto grid min-h-64 w-full max-w-4xl place-items-center px-4 py-10">
				<p className="text-destructive text-sm">{t.errors.forbidden}</p>
			</main>
		);
	return (
		<ContentLanguageEditorBoundary unitId={chapterId}>
			<ChapterLocalizationEditor bookId={bookId} chapterId={chapterId} />
		</ContentLanguageEditorBoundary>
	);
}

function ChapterLocalizationEditor({ bookId, chapterId }: { bookId: string; chapterId: string }) {
	const { t } = useTranslation(["actions", "errors", "history", "state", "ui", "units"]);
	const { selectedLanguage: language } = useContentLanguageEditor();
	const query = useGetApiChaptersByChapterId({
		path: { chapterId },
		query: { localizationLanguages: [language], language },
	});
	const missingLocalization =
		query.isError && hasErrorCode(query.error, "ChapterLanguageNotFound");
	const chapter = query.data?.language === language ? query.data : undefined;
	if (query.isPending) return <QueryPending />;
	if (query.isError && !missingLocalization)
		return <QueryFailure error={query.error} retry={() => void query.refetch()} />;
	return (
		<main className="mx-auto flex w-full max-w-[90rem] flex-col gap-8 px-4 py-8 sm:px-6 sm:py-10">
			<PageHeading
				action={
					<div className="flex flex-wrap justify-end gap-2">
						<ContentLanguageControl />
						<Button asChild variant="outline">
							<Link
								href={unitManagementSectionHref(
									"book",
									bookId,
									"content-structure",
								)}
							>
								{t.units.chapter.backToStructure}
							</Link>
						</Button>
						<Button asChild size="icon-md" variant="outline">
							<Link
								aria-label={t.history.title}
								href={chapterHistoryHref(bookId, chapterId)}
							>
								<HistoryIcon aria-hidden />
							</Link>
						</Button>
					</div>
				}
				title={t.units.chapter.title}
			/>
			<Card>
				<CardContent className="grid gap-6 p-6">
					<ChapterLocalizationForm
						key={`${chapterId}:${language}:${query.data?.updatedAt ?? "new"}`}
						bookId={bookId}
						chapter={chapter}
						chapterId={chapterId}
						language={language}
					/>
				</CardContent>
			</Card>
		</main>
	);
}

function ChapterLocalizationForm({
	bookId,
	chapterId,
	language,
	chapter,
}: {
	bookId: string;
	chapterId: string;
	language: ContentLanguage;
	chapter: GetApiChaptersByChapterIdStatus200 | undefined;
}) {
	const { t } = useTranslation(["actions", "errors", "state", "ui", "units"]);
	const queryClient = useQueryClient();
	const { setDirty, languagesChanged } = useContentLanguageEditor();
	const [content, setContent] = useState<PortableTextValue>(() =>
		readPortableText(chapter?.content),
	);
	const contentMetrics = useMemo(
		() => measurePortableText(content, language),
		[content, language],
	);
	const update = usePutApiChaptersByChapterIdLocalizationsByLanguageContent({
		mutation: {
			onSuccess: async () => invalidateChapterContent(queryClient, chapterId),
		},
	});
	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const form = new FormData(event.currentTarget);
		try {
			await update.mutateAsync({
				path: { chapterId, language },
				body: {
					title: String(form.get("title") ?? "").trim(),
					content: writePortableText(content, chapter?.content),
					status:
						form.get("status") === "published"
							? "published"
							: form.get("status") === "archived"
								? "archived"
								: "draft",
				},
			});
			setDirty(false);
			await languagesChanged();
		} catch {
			// The typed mutation state supplies the visible API error.
		}
	}
	return (
		<form onChange={() => setDirty(true)} onSubmit={submit}>
			<FieldGroup>
				<Field required>
					<FieldLabel>{t.ui.title}</FieldLabel>
					<Input
						defaultValue={chapter?.title ?? ""}
						maxLength={500}
						name="title"
						required
					/>
				</Field>
				<Field>
					<FieldLabel>{t.ui.status}</FieldLabel>
					<NativeSelect defaultValue={chapter?.status ?? "draft"} name="status">
						<NativeSelectOption value="draft">{t.ui.draft}</NativeSelectOption>
						<NativeSelectOption value="published">{t.ui.published}</NativeSelectOption>
						<NativeSelectOption value="archived">{t.ui.archived}</NativeSelectOption>
					</NativeSelect>
				</Field>
				<PortableTextEditor
					label={t.ui.body}
					onChange={(value) => {
						setContent(value);
						setDirty(true);
					}}
					required
					value={content}
					variant="document"
				/>
				<p aria-live="polite" className="text-muted-foreground text-sm">
					{language === "zh" || language === "ja"
						? t.units.chapter.characterCount({ count: contentMetrics.characterCount })
						: t.units.chapter.wordCount({ count: contentMetrics.wordCount })}
				</p>
				<div className="flex flex-wrap gap-2">
					<Button variant="solid" isLoading={update.isPending} type="submit">
						{t.units.chapter.save}
					</Button>
					<RequestFailure error={update.error} fallback={t.ui.retryLater} />
					<Button asChild type="button" variant="outline">
						<Link href={unitManagementSectionHref("book", bookId, "content-structure")}>
							{t.units.chapter.backToStructure}
						</Link>
					</Button>
				</div>
			</FieldGroup>
		</form>
	);
}
