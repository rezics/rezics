"use client";

import type { PortableTextBlock } from "@portabletext/editor";
import { PortableText } from "@portabletext/react";
import {
	type GetApiChaptersByChapterIdStatus200,
	useGetApiChaptersByChapterId,
	useGetApiUnitsBookByUnitIdContentNodes,
	useGetApiUnitsByTypeByUnitId,
	usePutApiChaptersByChapterIdLocalizationsByLanguageContent,
} from "@rezics/openapi-tanstack-query";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState, type FormEvent } from "react";

import { PageHeading } from "@rezics/ui";
import { QueryFailure, QueryPending } from "@rezics/ui";
import { PortableTextEditor } from "@rezics/ui";
import { Button } from "@rezics/ui";
import { Card, CardContent } from "@rezics/ui";
import { Field, FieldGroup, FieldLabel } from "@rezics/ui";
import { Input } from "@rezics/ui";
import { NativeSelect, NativeSelectOption } from "@rezics/ui";
import { Skeleton } from "@rezics/ui";
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
import { RequireSession } from "@/features/auth/require-session";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { hasErrorCode } from "@/i18n/errors";
import {
	toPortableTextFromEditor,
	toPortableTextForEditor,
	toPortableTextForReact,
} from "@/lib/portable-text";
import { buildContentTree, type ContentTreeNode } from "./content-tree";
import { invalidateChapterContent } from "./unit-cache";

export function BookChapters({ bookId }: { bookId: string }) {
	const { t } = useTranslation({ suspense: true });
	const query = useGetApiUnitsBookByUnitIdContentNodes({ path: { unitId: bookId } });
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
				nodes={buildContentTree(query.data.items)}
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
}: {
	bookId: string;
	label: string;
	nodes: readonly ContentTreeNode[];
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
			className="overflow-hidden rounded-xl border"
			collection={collection}
			defaultExpandedValue={getExpandedNodeIds(rootNode.children)}
		>
			<TreeViewLabel className="sr-only">{label}</TreeViewLabel>
			<TreeViewTree>
				{collection.rootNode.children?.map((node, index) => (
					<ContentReadTreeNode
						bookId={bookId}
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
}: {
	bookId: string;
	indexPath: number[];
	node: ReadTreeNode;
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
								indexPath={[...indexPath, index]}
								key={child.id}
								node={child}
							/>
						))}
					</TreeViewBranchContent>
				</TreeViewBranch>
			) : node.contentUnitId ? (
				<TreeViewContent asChild>
					<Link href={`/units/book/${bookId}/read/${node.contentUnitId}`}>
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

function toReadTreeNodes(nodes: readonly ContentTreeNode[]): ReadTreeNode[] {
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
	const { t, locale } = useTranslation({ suspense: true });
	const query = useGetApiChaptersByChapterId({
		path: { chapterId },
		query: { language: locale.target },
	});
	if (query.isPending) return <QueryPending />;
	if (query.isError)
		return <QueryFailure error={query.error} retry={() => void query.refetch()} />;
	if (!query.data) return <QueryPending />;
	return (
		<main className="bg-background fixed inset-0 z-50 overflow-y-auto">
			<div className="mx-auto flex min-h-svh w-full max-w-[48rem] flex-col gap-8 px-5 py-8 sm:px-10 sm:py-12">
				<header className="border-b pb-6">
					<Link
						className="text-primary text-sm hover:underline"
						href={`/units/book/${bookId}`}
					>
						{t.ui.backToUnit}
					</Link>
					<h1 className="mt-3 font-heading text-3xl font-bold">{query.data.title}</h1>
				</header>
				<article className="prose max-w-none text-[1.075rem] leading-8 sm:text-lg sm:leading-9">
					<PortableText value={toPortableTextForReact(query.data.content)} />
				</article>
				<footer className="flex flex-wrap items-center justify-between gap-3 border-t pt-6">
					{query.data.previousChapterId ? (
						<Button asChild variant="outline">
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
						<Button asChild>
							<Link href={`/units/book/${bookId}/read/${query.data.nextChapterId}`}>
								{t.ui.nextChapter}
							</Link>
						</Button>
					) : (
						<span />
					)}
				</footer>
			</div>
		</main>
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
	const { t } = useTranslation({ suspense: true });
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
	const { t, locale } = useTranslation({ suspense: true });
	const [language, setLanguage] = useState<string>(locale.target);
	const [enteredLanguage, setEnteredLanguage] = useState<string>(locale.target);
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
		<main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-10 sm:px-6">
			<PageHeading title={t.units.chapter.title} />
			<Card>
				<CardContent className="grid gap-6 p-6">
					<div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
						<Field>
							<FieldLabel>{t.units.chapter.language}</FieldLabel>
							<Input
								maxLength={35}
								onChange={(event) => setEnteredLanguage(event.currentTarget.value)}
								value={enteredLanguage}
							/>
						</Field>
						<Button
							disabled={!enteredLanguage.trim()}
							onClick={() => setLanguage(enteredLanguage.trim())}
							type="button"
							variant="outline"
						>
							{t.units.chapter.useLanguage}
						</Button>
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
	language: string;
	chapter: GetApiChaptersByChapterIdStatus200 | undefined;
}) {
	const { t } = useTranslation({ suspense: true });
	const queryClient = useQueryClient();
	const [content, setContent] = useState<PortableTextBlock[]>(() =>
		toPortableTextForEditor(chapter?.content),
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
					content: toPortableTextFromEditor(content),
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
				<Field required>
					<FieldLabel>{t.ui.body}</FieldLabel>
					<PortableTextEditor onChange={setContent} value={content} />
				</Field>
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
