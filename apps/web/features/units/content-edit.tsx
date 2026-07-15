"use client";

import type { PortableTextBlock } from "@portabletext/editor";
import {
	type GetApiUnitsBookByUnitIdContentNodesStatus200,
	type PostApiUnitsBookByUnitIdContentNodesOptions,
	useGetApiUnitsBookByUnitIdContentNodes,
	useGetApiUnitsByTypeByUnitId,
	usePatchApiUnitsBookByUnitIdContentNodesByNodeId,
	usePostApiUnitsBookByUnitIdContentNodes,
} from "@rezics/openapi-tanstack-query";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";

import { PageHeading } from "@rezics/ui";
import { QueryFailure, QueryPending } from "@rezics/ui";
import { PortableTextEditor } from "@rezics/ui";
import { Button } from "@rezics/ui";
import { Card, CardContent } from "@rezics/ui";
import { Field, FieldGroup, FieldLabel } from "@rezics/ui";
import { Input } from "@rezics/ui";
import { NativeSelect, NativeSelectOption } from "@rezics/ui";
import { RequireSession } from "@/features/auth/require-session";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { toPortableTextFromEditor } from "@/lib/portable-text";
import {
	buildContentTree,
	getContentMoveTargets,
	flattenContentTree,
	type FlattenedContentTreeNode,
} from "./content-tree";
import { invalidateBookContentTree } from "./unit-cache";

type ContentNode = GetApiUnitsBookByUnitIdContentNodesStatus200["items"][number];

export function ContentEdit({ bookId }: { bookId: string }) {
	return (
		<RequireSession>
			<ContentEditContent bookId={bookId} />
		</RequireSession>
	);
}

function ContentEditContent({ bookId }: { bookId: string }) {
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
	return <BookContentWorkspace bookId={book.data.id} />;
}

function BookContentWorkspace({ bookId }: { bookId: string }) {
	const { t } = useTranslation({ suspense: true });
	const queryClient = useQueryClient();
	const tree = useGetApiUnitsBookByUnitIdContentNodes({ path: { unitId: bookId } });
	const create = usePostApiUnitsBookByUnitIdContentNodes({
		mutation: { onSuccess: async () => invalidateBookContentTree(queryClient, bookId) },
	});
	const update = usePatchApiUnitsBookByUnitIdContentNodesByNodeId({
		mutation: { onSuccess: async () => invalidateBookContentTree(queryClient, bookId) },
	});
	const nodes = tree.data?.items ?? [];
	const flattened = useMemo(() => flattenContentTree(buildContentTree(nodes)), [nodes]);
	if (tree.isPending) return <QueryPending />;
	if (tree.isError) return <QueryFailure error={tree.error} retry={() => void tree.refetch()} />;
	return (
		<main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-10 sm:px-6">
			<PageHeading
				title={t.units.content.edit}
				action={
					<Button asChild variant="outline">
						<Link href={`/units/book/${bookId}`}>{t.ui.backToUnit}</Link>
					</Button>
				}
			/>
			<ContentCreateForm
				bookId={bookId}
				create={create.mutateAsync}
				error={create.error}
				flatNodes={flattened}
				pending={create.isPending}
			/>
			<Card>
				<CardContent className="p-0">
					{nodes.length ? (
						<ContentEditorTree
							bookId={bookId}
							flatNodes={flattened}
							nodes={nodes}
							onMove={async (nodeId, parentId) => {
								await update.mutateAsync({
									path: { unitId: bookId, nodeId },
									body: { parentId },
								});
							}}
							onRename={async (nodeId, title) => {
								await update.mutateAsync({
									path: { unitId: bookId, nodeId },
									body: { title },
								});
							}}
							pending={update.isPending}
						/>
					) : (
						<p className="p-6 text-sm text-muted-foreground">
							{t.units.content.noContent}
						</p>
					)}
					<RequestFailure error={update.error} fallback={t.ui.retryLater} />
				</CardContent>
			</Card>
		</main>
	);
}

function ContentCreateForm({
	bookId,
	flatNodes,
	create,
	error,
	pending,
}: {
	bookId: string;
	flatNodes: readonly FlattenedContentTreeNode[];
	create: (variables: PostApiUnitsBookByUnitIdContentNodesOptions) => Promise<unknown>;
	error: unknown;
	pending: boolean;
}) {
	const { t, locale } = useTranslation({ suspense: true });
	const [kind, setKind] = useState<"chapter" | "group">("chapter");
	const [content, setContent] = useState<PortableTextBlock[]>([]);
	const [editorKey, setEditorKey] = useState(0);
	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const element = event.currentTarget;
		const form = new FormData(element);
		const parentId = String(form.get("parentId") ?? "");
		try {
			await create({
				path: { unitId: bookId },
				body: {
					title: String(form.get("title") ?? "").trim(),
					language: locale.target,
					position: "V",
					...(parentId ? { parentId } : {}),
					...(kind === "chapter"
						? {
								content: toPortableTextFromEditor(content),
								status: form.get("status") === "draft" ? "draft" : "published",
							}
						: {}),
				},
			});
			element.reset();
			setContent([]);
			setEditorKey((current) => current + 1);
		} catch {
			// The typed mutation state supplies the visible API error.
		}
	}
	return (
		<Card>
			<CardContent className="p-6">
				<form onSubmit={submit}>
					<FieldGroup>
						<h2 className="font-heading text-xl font-bold">{t.units.content.create}</h2>
						<Field>
							<FieldLabel>{t.units.content.create}</FieldLabel>
							<NativeSelect
								name="kind"
								onChange={(event) =>
									setKind(
										event.currentTarget.value === "group" ? "group" : "chapter",
									)
								}
								value={kind}
							>
								<NativeSelectOption value="chapter">
									{t.units.content.chapter}
								</NativeSelectOption>
								<NativeSelectOption value="group">
									{t.units.content.group}
								</NativeSelectOption>
							</NativeSelect>
						</Field>
						<Field required>
							<FieldLabel>{t.ui.title}</FieldLabel>
							<Input maxLength={500} name="title" required />
						</Field>
						<Field>
							<FieldLabel>{t.units.content.parent}</FieldLabel>
							<NativeSelect name="parentId">
								<NativeSelectOption value="">
									{t.units.content.root}
								</NativeSelectOption>
								{flatNodes.map(({ node, depth }) => (
									<NativeSelectOption key={node.id} value={node.id}>
										{"— ".repeat(depth)}
										{node.title}
									</NativeSelectOption>
								))}
							</NativeSelect>
						</Field>
						{kind === "chapter" && (
							<>
								<Field>
									<FieldLabel>{t.ui.status}</FieldLabel>
									<NativeSelect defaultValue="published" name="status">
										<NativeSelectOption value="published">
											{t.ui.published}
										</NativeSelectOption>
										<NativeSelectOption value="draft">
											{t.ui.draft}
										</NativeSelectOption>
									</NativeSelect>
								</Field>
								<Field>
									<FieldLabel>{t.ui.chapterContent}</FieldLabel>
									<PortableTextEditor
										key={editorKey}
										onChange={setContent}
										value={content}
									/>
								</Field>
							</>
						)}
						<Button isLoading={pending} type="submit">
							{kind === "chapter"
								? t.units.content.createChapter
								: t.units.content.createGroup}
						</Button>
						<RequestFailure error={error} fallback={t.ui.retryLater} />
					</FieldGroup>
				</form>
			</CardContent>
		</Card>
	);
}

function ContentEditorTree({
	bookId,
	nodes,
	flatNodes,
	pending,
	onRename,
	onMove,
}: {
	bookId: string;
	nodes: readonly ContentNode[];
	flatNodes: readonly FlattenedContentTreeNode[];
	pending: boolean;
	onRename: (nodeId: string, title: string) => Promise<void>;
	onMove: (nodeId: string, parentId: string | null) => Promise<void>;
}) {
	return (
		<div>
			{flatNodes.map(({ node, depth }) => (
				<ContentEditorRow
					bookId={bookId}
					flatNodes={flatNodes}
					key={node.id}
					node={node}
					nodes={nodes}
					onMove={onMove}
					onRename={onRename}
					pending={pending}
					depth={depth}
				/>
			))}
		</div>
	);
}

function ContentEditorRow({
	bookId,
	node,
	nodes,
	flatNodes,
	depth,
	pending,
	onRename,
	onMove,
}: {
	bookId: string;
	node: ContentNode;
	nodes: readonly ContentNode[];
	flatNodes: readonly FlattenedContentTreeNode[];
	depth: number;
	pending: boolean;
	onRename: (nodeId: string, title: string) => Promise<void>;
	onMove: (nodeId: string, parentId: string | null) => Promise<void>;
}) {
	const { t } = useTranslation({ suspense: true });
	const [renaming, setRenaming] = useState(false);
	const [moving, setMoving] = useState(false);
	const validTargets = new Set(getContentMoveTargets(nodes, node.id).map((target) => target.id));
	return (
		<div
			className="border-b px-4 py-3 last:border-b-0"
			style={{ paddingInlineStart: `${1 + depth * 1.25}rem` }}
		>
			{renaming ? (
				<form
					className="flex flex-wrap items-center gap-2"
					onSubmit={async (event) => {
						event.preventDefault();
						const title = String(
							new FormData(event.currentTarget).get("title") ?? "",
						).trim();
						if (!title) return;
						try {
							await onRename(node.id, title);
							setRenaming(false);
						} catch {
							// The parent mutation state renders the API error.
						}
					}}
				>
					<Input
						className="min-w-0 flex-1"
						defaultValue={node.title}
						maxLength={500}
						name="title"
						required
					/>
					<Button isLoading={pending} size="sm" type="submit">
						{t.ui.save}
					</Button>
					<Button
						onClick={() => setRenaming(false)}
						size="sm"
						type="button"
						variant="ghost"
					>
						{t.engagement.cancel}
					</Button>
				</form>
			) : moving ? (
				<form
					className="flex flex-wrap items-center gap-2"
					onSubmit={async (event) => {
						event.preventDefault();
						const parentId =
							String(new FormData(event.currentTarget).get("parentId") ?? "") || null;
						try {
							await onMove(node.id, parentId);
							setMoving(false);
						} catch {
							// The parent mutation state renders the API error.
						}
					}}
				>
					<NativeSelect
						className="min-w-0 flex-1"
						defaultValue={node.parentId ?? ""}
						name="parentId"
					>
						<NativeSelectOption value="">{t.units.content.root}</NativeSelectOption>
						{flatNodes
							.filter(({ node: candidate }) => validTargets.has(candidate.id))
							.map(({ node: candidate, depth: candidateDepth }) => (
								<NativeSelectOption key={candidate.id} value={candidate.id}>
									{"— ".repeat(candidateDepth)}
									{candidate.title}
								</NativeSelectOption>
							))}
					</NativeSelect>
					<Button isLoading={pending} size="sm" type="submit">
						{t.ui.save}
					</Button>
					<Button
						onClick={() => setMoving(false)}
						size="sm"
						type="button"
						variant="ghost"
					>
						{t.engagement.cancel}
					</Button>
				</form>
			) : (
				<div className="flex min-w-0 flex-wrap items-center gap-2">
					<span className="min-w-0 flex-1 break-words font-medium">{node.title}</span>
					<div className="flex shrink-0 flex-wrap gap-1">
						{node.contentUnitId && (
							<Button asChild size="xs" variant="ghost">
								<Link
									href={`/units/book/${bookId}/edit/chapters/${node.contentUnitId}`}
								>
									{t.units.content.editChapter}
								</Link>
							</Button>
						)}
						<Button
							onClick={() => setRenaming(true)}
							size="xs"
							type="button"
							variant="ghost"
						>
							{t.units.content.rename}
						</Button>
						<Button
							onClick={() => setMoving(true)}
							size="xs"
							type="button"
							variant="ghost"
						>
							{t.units.content.move}
						</Button>
					</div>
				</div>
			)}
		</div>
	);
}
