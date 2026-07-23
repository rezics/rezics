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
	useGetApiUnitsByIdByUnitIdDocksByKind,
	useGetApiUnitsByIdByUnitIdDocksByKindRevisions,
	usePostApiUnitsByIdByUnitIdDocksByKindRevisionsByRevisionIdRestore,
	usePutApiUnitsByIdByUnitIdDocksByKind,
} from "@rezics/openapi-tanstack-query";
import {
	Button,
	Card,
	CardContent,
	ManagementWorkspaceSectionHeader,
	QueryFailure,
	QueryPending,
} from "@rezics/ui";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";

import { BlockDocumentEditor } from "@/features/blocks/block-document-editor";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { zoneManagementHref } from "./model";
import { useZoneManagement } from "./workspace";

function hasStatus(error: unknown, status: number): boolean {
	return (
		typeof error === "object" && error !== null && "status" in error && error.status === status
	);
}

export function ZoneLayoutManagement() {
	const { zoneId } = useZoneManagement();
	const { t } = useTranslation(["errors", "ui", "zones"]);
	const dock = useGetApiUnitsByIdByUnitIdDocksByKind({ path: { unitId: zoneId, kind: "main" } });
	if (dock.isPending) return <QueryPending />;
	const notConfigured = dock.isError && hasStatus(dock.error, 404);
	if (dock.isError && !notConfigured)
		return <QueryFailure error={dock.error} retry={() => void dock.refetch()} />;
	return (
		<section>
			<ManagementWorkspaceSectionHeader
				backHref={zoneManagementHref(zoneId)}
				backLabel={t.zones.management.title}
				description={t.zones.management.sections.layout.description}
				link={Link}
				title={t.zones.management.sections.layout.label}
			/>
			{notConfigured ? (
				<p className="mb-4 text-sm text-muted-foreground">
					{t.zones.management.layoutEditor.notConfigured}
				</p>
			) : null}
			<DockEditor
				initialDocument={
					dock.data
						? parseDocument(DockDocument, dock.data.document)
						: createDockDocument()
				}
				key={dock.data?.latestRevisionId ?? "new"}
				latestRevisionId={dock.data?.latestRevisionId}
				zoneId={zoneId}
			/>
		</section>
	);
}

function DockEditor({
	initialDocument,
	latestRevisionId,
	zoneId,
}: {
	readonly initialDocument: DockDocumentValue;
	readonly latestRevisionId?: string;
	readonly zoneId: string;
}) {
	const { t } = useTranslation(["errors", "ui", "zones"]);
	const queryClient = useQueryClient();
	const [document, setDocument] = useState(initialDocument);
	const invalidate = async () => {
		await Promise.all([
			queryClient.invalidateQueries({
				queryKey: getApiUnitsByIdByUnitIdDocksByKindQueryKey({
					path: { unitId: zoneId, kind: "main" },
				}),
			}),
			queryClient.invalidateQueries({
				queryKey: getApiUnitsByIdByUnitIdDocksByKindRevisionsQueryKey({
					path: { unitId: zoneId, kind: "main" },
				}),
			}),
		]);
	};
	const save = usePutApiUnitsByIdByUnitIdDocksByKind({ mutation: { onSuccess: invalidate } });
	const history = useGetApiUnitsByIdByUnitIdDocksByKindRevisions(
		{ path: { unitId: zoneId, kind: "main" } },
		{ query: { enabled: Boolean(latestRevisionId) } },
	);
	const restore = usePostApiUnitsByIdByUnitIdDocksByKindRevisionsByRevisionIdRestore({
		mutation: { onSuccess: invalidate },
	});
	return (
		<div className="grid gap-6">
			<Card appearance="outlined">
				<CardContent className="grid gap-5 p-6">
					<h2 className="font-semibold text-lg">
						{t.zones.management.layoutEditor.sharedContent}
					</h2>
					<BlockDocumentEditor
						document={document}
						labels={t.zones.management.blocks}
						onChange={(next) => setDocument(parseDocument(DockDocument, next))}
					/>
					<Button
						isLoading={save.isPending}
						onClick={async () => {
							try {
								const saved = await save.mutateAsync({
									path: { unitId: zoneId, kind: "main" },
									body: {
										document,
										...(latestRevisionId
											? { baseRevisionId: latestRevisionId }
											: {}),
									},
								});
								setDocument(parseDocument(DockDocument, saved.document));
							} catch {
								// The typed mutation state supplies the visible request failure.
							}
						}}
						type="button"
					>
						{t.zones.management.layoutEditor.save}
					</Button>
					<RequestFailure error={save.error} fallback={t.ui.retryLater} />
				</CardContent>
			</Card>
			{latestRevisionId ? (
				<Card appearance="outlined">
					<CardContent className="p-6">
						<h2 className="font-semibold text-lg">
							{t.zones.management.layoutEditor.history}
						</h2>
						{history.isPending ? <QueryPending /> : null}
						{history.isError ? (
							<QueryFailure
								error={history.error}
								retry={() => void history.refetch()}
							/>
						) : null}
						{history.data ? (
							<ul className="mt-4 grid gap-3">
								{history.data.items.map((revision) => (
									<li
										className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border-weak p-3"
										key={revision.id}
									>
										<div>
											<strong>
												{
													t.zones.management.search.revisionKinds[
														revision.kind
													]
												}
											</strong>
											{revision.editSummary ? (
												<p className="text-sm text-muted-foreground">
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
															unitId: zoneId,
															kind: "main",
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
											{t.zones.management.layoutEditor.restore}
										</Button>
									</li>
								))}
							</ul>
						) : null}
						<RequestFailure error={restore.error} fallback={t.ui.retryLater} />
					</CardContent>
				</Card>
			) : null}
		</div>
	);
}
