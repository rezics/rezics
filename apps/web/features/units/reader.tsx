"use client";

import {
	ContentLanguageValues,
	isContentLanguage,
	toContentLanguage,
	type ContentLanguage,
} from "@rezics/i18n";

import {
	type GetApiChaptersByChapterIdStatus200,
	useGetApiChaptersByChapterId,
	useGetApiUnitsBookByUnitIdContentStructureNodes,
	useGetApiUnitsByTypeByUnitId,
	usePutApiChaptersByChapterIdLocalizationsByLanguageContent,
} from "@rezics/openapi-tanstack-query";
import type { PortableTextValue } from "@rezics/portable-text";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeftIcon, ListTreeIcon, MinusIcon, PlusIcon } from "lucide-react";
import Link from "next/link";
import { useState, type FormEvent } from "react";

import { PageHeading } from "@rezics/ui";
import { QueryFailure, QueryPending } from "@rezics/ui";
import { PortableTextContent } from "@rezics/ui";
import { Button } from "@rezics/ui";
import { Card, CardContent } from "@rezics/ui";
import { Field, FieldGroup, FieldLabel } from "@rezics/ui";
import { Input } from "@rezics/ui";
import { NativeSelect, NativeSelectOption } from "@rezics/ui";
import { Skeleton } from "@rezics/ui";
import { Sheet, SheetBody, SheetContent, SheetHeader, SheetTrigger } from "@rezics/ui";
import {
	createTreeCollection,
	type TreeNodeType,
	TreeView,
	TreeViewBranch,
	TreeViewBranchContent,
	TreeViewBranchItem,
	TreeViewContent,
	TreeViewItem,
	TreeViewLabel,
	TreeViewNode,
	TreeViewTree,
} from "@rezics/ui";
import { cn } from "@rezics/ui";
import { RequireSession } from "@/features/auth/require-session";
import { PortableTextEditor } from "@/features/editor/portable-text-editor";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { hasErrorCode } from "@/i18n/errors";
import { readPortableText, writePortableText } from "@/lib/block";
import { buildContentStructureTree, type ContentStructureTreeNode } from "./content-structure-tree";
import { invalidateChapterContent } from "./unit-cache";

export function BookChapters({ bookId }: { bookId: string }) {
	const { t } = useTranslation(["actions", "errors", "state", "ui", "units"]);
	const query = useGetApiUnitsBookByUnitIdContentStructureNodes({
		path: { unitId: bookId },
	});
	if (query.isPending)
		return (
			<section className="flex flex-col gap-4">
				<h2 className="font-heading text-xl font-bold">{t.units.content.title}</h2>
				<Skeleton className="h-24 rounded-xl" />
			</section>
		);
	if (query.isError)
		return (
			<section className="grid gap-3">
				<p className="text-destructive text-sm">{t.state.error}</p>
				<Button className="w-fit" onClick={() => void query.refetch()} variant="outline">
					{t.actions.retry}
				</Button>
			</section>
		);
	if (!query.data?.items.length)
		return (
			<section className="flex flex-col gap-4">
				<h2 className="font-heading text-xl font-bold">{t.units.content.title}</h2>
				<p className="text-muted-foreground text-sm">{t.units.content.noContent}</p>
			</section>
		);
	return (
		<section className="flex flex-col gap-4">
			<h2 className="font-heading text-xl font-bold">{t.units.content.title}</h2>
			<ContentReadTree
				bookId={bookId}
				label={t.units.content.title}
				nodes={buildContentStructureTree(query.data.items)}
			/>
		</section>
	);
}

interface ReadTreeNode extends Omit<TreeNodeType, "children"> {
	contentUnitId: string | null;
	children?: ReadTreeNode[];
}

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
	const rootNode = {
		children: toReadTreeNodes(nodes),
		contentUnitId: null,
		id: "root",
		name: "",
	};
	const collection = createTreeCollection<ReadTreeNode>({ rootNode });
	return (
		<TreeView
			className={cn("overflow-hidden rounded-lg border", className)}
			collection={collection}
			defaultExpandedValue={getExpandedNodeIds(rootNode.children)}
		>
			<TreeViewLabel className="sr-only">{label}</TreeViewLabel>
			<TreeViewTree>
				{collection.rootNode.children?.map((node, index) => (
					<ContentReadTreeNode
						bookId={bookId}
						currentChapterId={currentChapterId}
						indexPath={[index]}
						key={node.id}
						node={node}
					/>
				))}
			</TreeViewTree>
		</TreeView>
	);
}

function ContentReadTreeNode({
	bookId,
	indexPath,
	node,
	currentChapterId,
}: {
	bookId: string;
	indexPath: number[];
	node: ReadTreeNode;
	currentChapterId?: string;
}) {
	return (
		<TreeViewNode indexPath={indexPath} node={node}>
			{node.children?.length ? (
				<TreeViewBranch>
					<TreeViewBranchItem expandedIcon={null} icon={null}>
						{node.name}
					</TreeViewBranchItem>
					<TreeViewBranchContent>
						{node.children.map((child, index) => (
							<ContentReadTreeNode
								bookId={bookId}
								currentChapterId={currentChapterId}
								indexPath={[...indexPath, index]}
								key={child.id}
								node={child}
							/>
						))}
					</TreeViewBranchContent>
				</TreeViewBranch>
			) : node.contentUnitId ? (
				<TreeViewContent asChild>
					<Link
						aria-current={node.contentUnitId === currentChapterId ? "page" : undefined}
						className={cn(
							node.contentUnitId === currentChapterId &&
								"bg-surface-selected text-foreground",
						)}
						href={`/units/book/${bookId}/read/${node.contentUnitId}`}
					>
						<TreeViewItem>{node.name}</TreeViewItem>
					</Link>
				</TreeViewContent>
			) : (
				<TreeViewContent>
					<TreeViewItem>{node.name}</TreeViewItem>
				</TreeViewContent>
			)}
		</TreeViewNode>
	);
}

function toReadTreeNodes(nodes: readonly ContentStructureTreeNode[]): ReadTreeNode[] {
	return nodes.map(({ node, children }) => ({
		...(children.length ? { children: toReadTreeNodes(children) } : {}),
		contentUnitId: node.contentUnitId,
		id: node.id,
		name: node.title,
	}));
}

function getExpandedNodeIds(nodes: readonly ReadTreeNode[]): string[] {
	return nodes.flatMap((node) =>
		node.children?.length ? [node.id, ...getExpandedNodeIds(node.children)] : [],
	);
}

export function Reader({ bookId, chapterId }: { bookId: string; chapterId: string }) {
	const { t, locale } = useTranslation(["actions", "errors", "state", "ui", "units"]);
	const [fontSize, setFontSize] = useState(1);
	const query = useGetApiChaptersByChapterId({
		path: { chapterId },
		query: { language: toContentLanguage(locale.target) },
	});
	const outline = useGetApiUnitsBookByUnitIdContentStructureNodes({
		path: { unitId: bookId },
	});
	if (query.isPending) return <QueryPending />;
	if (query.isError)
		return <QueryFailure error={query.error} retry={() => void query.refetch()} />;
	if (!query.data) return <QueryPending />;
	const tree = outline.data?.items.length ? buildContentStructureTree(outline.data.items) : [];
	const fontSizeClass = ["text-base sm:text-[1.05rem]", "text-lg", "text-xl"][fontSize];
	return (
		<main
			className="fixed inset-0 z-50 grid grid-rows-[3.75rem_minmax(0,1fr)] overflow-hidden bg-background"
			id="main-content"
		>
			<header className="flex min-w-0 items-center gap-2 border-b bg-background/95 px-3 backdrop-blur sm:px-5">
				<Button asChild className="size-11 sm:size-10" size="icon-xl" variant="ghost">
					<Link aria-label={t.ui.backToUnit} href={`/units/book/${bookId}`}>
						<ArrowLeftIcon aria-hidden />
					</Link>
				</Button>
				<span className="hidden font-serif font-semibold text-foreground sm:block">
					REZICS
				</span>
				<span aria-hidden className="hidden h-5 w-px bg-border sm:block" />
				<p className="min-w-0 flex-1 truncate font-medium text-sm">{query.data.title}</p>

				<Sheet>
					<SheetTrigger asChild>
						<Button
							aria-label={t.units.content.title}
							className="size-11 sm:size-10 md:hidden"
							size="icon-xl"
							variant="ghost"
						>
							<ListTreeIcon aria-hidden />
						</Button>
					</SheetTrigger>
					<SheetContent placement="left">
						<SheetHeader title={t.units.content.title} />
						<SheetBody>
							<ReaderOutline
								bookId={bookId}
								className="border-0"
								currentChapterId={chapterId}
								outline={outline}
								tree={tree}
							/>
						</SheetBody>
					</SheetContent>
				</Sheet>

				<div className="flex items-center rounded-lg border bg-card">
					<Button
						aria-label="A−"
						className="size-11 sm:size-10"
						disabled={fontSize === 0}
						onClick={() => setFontSize((value) => Math.max(0, value - 1))}
						size="icon-xl"
						variant="ghost"
					>
						<MinusIcon aria-hidden />
					</Button>
					<span className="min-w-8 text-center font-serif font-semibold text-sm">Aa</span>
					<Button
						aria-label="A+"
						className="size-11 sm:size-10"
						disabled={fontSize === 2}
						onClick={() => setFontSize((value) => Math.min(2, value + 1))}
						size="icon-xl"
						variant="ghost"
					>
						<PlusIcon aria-hidden />
					</Button>
				</div>
			</header>

			<div className="grid min-h-0 md:grid-cols-[17rem_minmax(0,1fr)]">
				<aside className="hidden min-h-0 overflow-y-auto border-e bg-card/45 p-4 md:block">
					<p className="mb-3 px-2 font-serif font-semibold text-lg">
						{t.units.content.title}
					</p>
					<ReaderOutline
						bookId={bookId}
						className="border-0 bg-transparent"
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
								{query.data.title}
							</h1>
						</header>
						<article
							className={cn("flex-1 py-8 leading-8 sm:leading-9", fontSizeClass)}
						>
							<PortableTextContent
								value={readPortableText(query.data.content)}
								variant="article"
							/>
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
								<Button asChild className="min-h-11 sm:min-h-8">
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
	const book = useGetApiUnitsByTypeByUnitId({ path: { type: "book", unitId: bookId } });
	if (book.isPending) return <QueryPending />;
	if (book.isError) return <QueryFailure error={book.error} retry={() => void book.refetch()} />;
	if (!book.data) return <QueryPending />;
	if (!book.data.capabilities.canEdit)
		return (
			<main className="mx-auto grid min-h-64 w-full max-w-4xl place-items-center px-4 py-10">
				<p className="text-destructive text-sm">{t.errors.forbidden}</p>
			</main>
		);
	return <ChapterLocalizationEditor bookId={bookId} chapterId={chapterId} />;
}

function ChapterLocalizationEditor({ bookId, chapterId }: { bookId: string; chapterId: string }) {
	const { t, locale } = useTranslation(["actions", "errors", "state", "ui", "units"]);
	const [language, setLanguage] = useState<ContentLanguage>(toContentLanguage(locale.target));
	const query = useGetApiChaptersByChapterId({
		path: { chapterId },
		query: { language },
	});
	const missingLocalization =
		query.isError && hasErrorCode(query.error, "ChapterLanguageNotFound");
	if (query.isPending) return <QueryPending />;
	if (query.isError && !missingLocalization)
		return <QueryFailure error={query.error} retry={() => void query.refetch()} />;
	return (
		<main className="mx-auto flex w-full max-w-[90rem] flex-col gap-8 px-4 py-8 sm:px-6 sm:py-10">
			<PageHeading title={t.units.chapter.title} />
			<Card>
				<CardContent className="grid gap-6 p-6">
					<div className="grid gap-2">
						<Field>
							<FieldLabel>{t.units.chapter.language}</FieldLabel>
							<NativeSelect
								value={language}
								onChange={(event) => {
									const value = event.currentTarget.value;
									if (isContentLanguage(value)) setLanguage(value);
								}}
							>
								{ContentLanguageValues.map((value) => (
									<NativeSelectOption key={value} value={value}>
										{value}
									</NativeSelectOption>
								))}
							</NativeSelect>
						</Field>
					</div>
					<ChapterLocalizationForm
						key={`${chapterId}:${language}:${query.data?.updatedAt ?? "new"}`}
						bookId={bookId}
						chapter={query.data}
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
	const [content, setContent] = useState<PortableTextValue>(() =>
		readPortableText(chapter?.content),
	);
	const update = usePutApiChaptersByChapterIdLocalizationsByLanguageContent({
		mutation: {
			onSuccess: async () => invalidateChapterContent(queryClient, chapterId, language),
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
		} catch {
			// The typed mutation state supplies the visible API error.
		}
	}
	return (
		<form onSubmit={submit}>
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
					onChange={setContent}
					required
					value={content}
					variant="document"
				/>
				<div className="flex flex-wrap gap-2">
					<Button isLoading={update.isPending} type="submit">
						{t.units.chapter.save}
					</Button>
					<RequestFailure error={update.error} fallback={t.ui.retryLater} />
					<Button asChild type="button" variant="outline">
						<Link href={`/units/book/${bookId}`}>{t.ui.backToUnit}</Link>
					</Button>
				</div>
			</FieldGroup>
		</form>
	);
}
