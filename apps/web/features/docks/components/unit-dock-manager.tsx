"use client";

import {
	DockDocument,
	createDockDocument,
	parseDocument,
	type DockDocument as DockDocumentValue,
} from "@rezics/block";
import {
	getApiUnitsByIdByUnitIdDocksByKindQueryKey,
	getApiUnitsByIdByUnitIdDocksByKindRevisionsQueryKey,
	getApiUnitsByIdByUnitIdDocksQueryKey,
	type GetApiUnitsByIdByUnitIdDocksByKindRevisionsStatus200,
	useDeleteApiUnitsByIdByUnitIdDocksByKind,
	useGetApiUnitsByIdByUnitIdDocksByKind,
	useGetApiUnitsByIdByUnitIdDocksByKindRevisions,
	usePostApiUnitsByIdByUnitIdDocksByKindRevisionsByRevisionIdRestore,
	usePutApiUnitsByIdByUnitIdDocksByKind,
} from "@rezics/openapi-tanstack-query";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogBody,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
	Badge,
	Button,
	Card,
	CardContent,
	QueryFailure,
	QueryPending,
} from "@rezics/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { BlockDocumentEditor } from "@/features/blocks/block-document-editor";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { getDockAddableBlockTypes, type DockTarget } from "../model/dock";

function hasStatus(error: unknown, status: number): boolean {
	return (
		typeof error === "object" && error !== null && "status" in error && error.status === status
	);
}

export function UnitDockManager({
	ownerUnitId,
	target,
}: {
	readonly ownerUnitId: string;
	readonly target: DockTarget;
}) {
	const { t } = useTranslation(["docks", "errors"]);
	const dock = useGetApiUnitsByIdByUnitIdDocksByKind({
		path: { unitId: ownerUnitId, kind: target.dockKind },
	});
	const history = useGetApiUnitsByIdByUnitIdDocksByKindRevisions({
		path: { unitId: ownerUnitId, kind: target.dockKind },
	});
	if (dock.isPending) return <QueryPending />;
	const notConfigured = dock.isError && hasStatus(dock.error, 404);
	if (dock.isError && !notConfigured)
		return <QueryFailure error={dock.error} retry={() => void dock.refetch()} />;
	const noHistory = history.isError && hasStatus(history.error, 404);
	if (notConfigured && history.isPending) return <QueryPending />;
	if (notConfigured && history.isError && !noHistory)
		return <QueryFailure error={history.error} retry={() => void history.refetch()} />;

	let initialDocument: DockDocumentValue;
	try {
		initialDocument = dock.data
			? parseDocument(DockDocument, dock.data.document)
			: createDockDocument();
	} catch {
		return (
			<p className="text-destructive text-sm" role="alert">
				{t.docks.invalidDocument}
			</p>
		);
	}

	const latestRevisionId = dock.data?.latestRevisionId ?? history.data?.items[0]?.id;
	const deleted = notConfigured && Boolean(latestRevisionId);
	return (
		<div className="grid gap-6">
			{deleted ? (
				<Card appearance="outlined">
					<CardContent className="grid gap-3 p-6">
						<h2 className="font-semibold text-lg">
							{t.docks.kinds[target.dockKind].label}
						</h2>
						<p className="text-muted-foreground text-sm">{t.docks.deleted}</p>
					</CardContent>
				</Card>
			) : (
				<UnitDockEditor
					initialDocument={initialDocument}
					key={dock.data?.latestRevisionId ?? "new"}
					latestRevisionId={dock.data?.latestRevisionId}
					ownerUnitId={ownerUnitId}
					target={target}
				/>
			)}
			{notConfigured && !deleted ? (
				<p className="text-muted-foreground text-sm">{t.docks.notConfigured}</p>
			) : null}
			{latestRevisionId ? (
				<UnitDockHistory
					history={history}
					latestRevisionId={latestRevisionId}
					ownerUnitId={ownerUnitId}
					target={target}
				/>
			) : null}
		</div>
	);
}

function UnitDockEditor({
	initialDocument,
	latestRevisionId,
	ownerUnitId,
	target,
}: {
	readonly initialDocument: DockDocumentValue;
	readonly latestRevisionId?: string;
	readonly ownerUnitId: string;
	readonly target: DockTarget;
}) {
	const { t } = useTranslation(["docks", "ui"]);
	const queryClient = useQueryClient();
	const [document, setDocument] = useState(initialDocument);
	const [dirty, setDirty] = useState(false);
	const [invalid, setInvalid] = useState(false);
	const invalidate = () => invalidateDockQueries(queryClient, ownerUnitId, target);
	const save = usePutApiUnitsByIdByUnitIdDocksByKind({
		mutation: { onSuccess: invalidate },
	});
	const remove = useDeleteApiUnitsByIdByUnitIdDocksByKind({
		mutation: { onSuccess: invalidate },
	});

	useEffect(() => {
		if (!dirty) return;
		const preventDataLoss = (event: BeforeUnloadEvent) => event.preventDefault();
		window.addEventListener("beforeunload", preventDataLoss);
		return () => window.removeEventListener("beforeunload", preventDataLoss);
	}, [dirty]);

	async function saveDocument() {
		let validated: DockDocumentValue;
		try {
			validated = parseDocument(DockDocument, document);
		} catch {
			setInvalid(true);
			return;
		}
		setInvalid(false);
		try {
			const saved = await save.mutateAsync({
				path: { unitId: ownerUnitId, kind: target.dockKind },
				body: {
					document: validated,
					...(latestRevisionId ? { baseRevisionId: latestRevisionId } : {}),
				},
			});
			setDocument(parseDocument(DockDocument, saved.document));
			setDirty(false);
		} catch {
			// The typed mutation state supplies the visible request failure.
		}
	}

	return (
		<Card appearance="outlined">
			<CardContent className="grid gap-5 p-6">
				<div className="flex flex-wrap items-center justify-between gap-3">
					<h2 className="font-semibold text-lg">
						{t.docks.kinds[target.dockKind].label}
					</h2>
					{dirty ? <Badge variant="warning">{t.docks.unsaved}</Badge> : null}
				</div>
				<p className="text-muted-foreground text-sm">
					{t.docks.kinds[target.dockKind].description}
				</p>
				<BlockDocumentEditor
					addableTypes={getDockAddableBlockTypes(target)}
					allowZoneSearchSource={target.ownerKind === "zone"}
					document={document}
					labels={t.docks.blocks}
					onChange={(next) => {
						if (next._type !== "dock-document") return;
						setDocument(next);
						setDirty(true);
						setInvalid(false);
					}}
				/>
				{invalid ? (
					<p className="text-destructive text-sm" role="alert">
						{t.docks.invalidDraft}
					</p>
				) : null}
				<div className="flex flex-wrap gap-3">
					<Button
						disabled={!dirty && Boolean(latestRevisionId)}
						isLoading={save.isPending}
						onClick={() => void saveDocument()}
						type="button"
					>
						{t.docks.save}
					</Button>
					{latestRevisionId ? (
						<AlertDialog>
							<AlertDialogTrigger asChild>
								<Button type="button" variant="outline">
									{t.docks.remove}
								</Button>
							</AlertDialogTrigger>
							<AlertDialogContent>
								<AlertDialogHeader>
									<AlertDialogTitle>{t.docks.removeTitle}</AlertDialogTitle>
								</AlertDialogHeader>
								<AlertDialogBody>
									<AlertDialogDescription>
										{t.docks.removeDescription}
									</AlertDialogDescription>
								</AlertDialogBody>
								<AlertDialogFooter>
									<AlertDialogCancel>{t.docks.cancel}</AlertDialogCancel>
									<AlertDialogAction
										isLoading={remove.isPending}
										onClick={async () => {
											try {
												await remove.mutateAsync({
													path: {
														unitId: ownerUnitId,
														kind: target.dockKind,
													},
													body: { baseRevisionId: latestRevisionId },
												});
											} catch {
												// The typed mutation state supplies the visible request failure.
											}
										}}
										variant="destructive"
									>
										{t.docks.confirmRemove}
									</AlertDialogAction>
								</AlertDialogFooter>
							</AlertDialogContent>
						</AlertDialog>
					) : null}
				</div>
				<RequestFailure error={save.error} fallback={t.ui.retryLater} />
				<RequestFailure error={remove.error} fallback={t.ui.retryLater} />
				{hasStatus(save.error, 409) || hasStatus(remove.error, 409) ? (
					<Button
						onClick={() => void invalidate()}
						size="sm"
						type="button"
						variant="outline"
					>
						{t.docks.reload}
					</Button>
				) : null}
			</CardContent>
		</Card>
	);
}

interface DockHistoryQuery {
	readonly data?: GetApiUnitsByIdByUnitIdDocksByKindRevisionsStatus200;
	readonly error: unknown;
	readonly isError: boolean;
	readonly isPending: boolean;
	readonly refetch: () => Promise<unknown>;
}

function UnitDockHistory({
	history,
	latestRevisionId,
	ownerUnitId,
	target,
}: {
	readonly history: DockHistoryQuery;
	readonly latestRevisionId: string;
	readonly ownerUnitId: string;
	readonly target: DockTarget;
}) {
	const { t, locale } = useTranslation(["docks", "ui"]);
	const queryClient = useQueryClient();
	const restore = usePostApiUnitsByIdByUnitIdDocksByKindRevisionsByRevisionIdRestore({
		mutation: {
			onSuccess: () => invalidateDockQueries(queryClient, ownerUnitId, target),
		},
	});
	return (
		<Card appearance="outlined">
			<CardContent className="p-6">
				<h2 className="font-semibold text-lg">{t.docks.history}</h2>
				{history.isPending ? <QueryPending /> : null}
				{history.isError ? (
					<QueryFailure error={history.error} retry={() => void history.refetch()} />
				) : null}
				{history.data ? (
					<ul className="mt-4 grid gap-3">
						{history.data.items.map((revision) => (
							<li
								className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border-weak p-3"
								key={revision.id}
							>
								<div className="grid gap-1">
									<strong>{t.docks.revisionKinds[revision.kind]}</strong>
									<time
										className="text-muted-foreground text-xs"
										dateTime={revision.createdAt}
									>
										{new Intl.DateTimeFormat(locale.current, {
											dateStyle: "medium",
											timeStyle: "short",
										}).format(new Date(revision.createdAt))}
									</time>
									{revision.editSummary ? (
										<p className="text-muted-foreground text-sm">
											{revision.editSummary}
										</p>
									) : null}
								</div>
								<Button
									disabled={revision.id === latestRevisionId}
									isLoading={restore.isPending}
									onClick={async () => {
										try {
											await restore.mutateAsync({
												path: {
													unitId: ownerUnitId,
													kind: target.dockKind,
													revisionId: revision.id,
												},
												body: { baseRevisionId: latestRevisionId },
											});
										} catch {
											// The typed mutation state supplies the visible request failure.
										}
									}}
									size="sm"
									type="button"
									variant="outline"
								>
									{t.docks.restore}
								</Button>
							</li>
						))}
					</ul>
				) : null}
				<RequestFailure error={restore.error} fallback={t.ui.retryLater} />
				{hasStatus(restore.error, 409) ? (
					<Button
						className="mt-3"
						onClick={() => void invalidateDockQueries(queryClient, ownerUnitId, target)}
						size="sm"
						type="button"
						variant="outline"
					>
						{t.docks.reload}
					</Button>
				) : null}
			</CardContent>
		</Card>
	);
}

async function invalidateDockQueries(
	queryClient: ReturnType<typeof useQueryClient>,
	ownerUnitId: string,
	target: DockTarget,
) {
	await Promise.all([
		queryClient.invalidateQueries({
			queryKey: getApiUnitsByIdByUnitIdDocksQueryKey({
				path: { unitId: ownerUnitId },
			}),
		}),
		queryClient.invalidateQueries({
			queryKey: getApiUnitsByIdByUnitIdDocksByKindQueryKey({
				path: { unitId: ownerUnitId, kind: target.dockKind },
			}),
		}),
		queryClient.invalidateQueries({
			queryKey: getApiUnitsByIdByUnitIdDocksByKindRevisionsQueryKey({
				path: { unitId: ownerUnitId, kind: target.dockKind },
			}),
		}),
	]);
}
