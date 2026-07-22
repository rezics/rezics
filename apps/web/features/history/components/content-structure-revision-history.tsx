"use client";

import {
	getApiUnitsByIdByUnitIdContentStructuresByStructureIdRevisionsQueryKey,
	useGetApiUnitsByIdByUnitIdContentStructuresByStructureIdRevisions,
	usePostApiUnitsByIdByUnitIdContentStructuresByStructureIdRevisionsByRevisionIdRestore,
} from "@rezics/openapi-tanstack-query";
import { Badge, Button, Card, CardContent, QueryFailure, QueryPending } from "@rezics/ui";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";

import { profileHref } from "@/features/profiles/profile-route";
import { invalidateBookContentStructure } from "@/features/units/unit-cache";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";

export function ContentStructureRevisionHistory({
	unitId,
	structureId,
	latestRevisionId,
	canRestore,
}: {
	unitId: string;
	structureId: string;
	latestRevisionId: string;
	canRestore: boolean;
}) {
	const { t, locale } = useTranslation(["history"]);
	const queryClient = useQueryClient();
	const options = { path: { unitId, structureId }, query: { limit: 100 } } as const;
	const query = useGetApiUnitsByIdByUnitIdContentStructuresByStructureIdRevisions(options);
	const refresh = async () => {
		await Promise.all([
			queryClient.invalidateQueries({
				queryKey:
					getApiUnitsByIdByUnitIdContentStructuresByStructureIdRevisionsQueryKey(options),
			}),
			invalidateBookContentStructure(queryClient, unitId),
		]);
	};
	const restore =
		usePostApiUnitsByIdByUnitIdContentStructuresByStructureIdRevisionsByRevisionIdRestore({
			mutation: { onSuccess: refresh },
		});
	if (query.isPending) return <QueryPending />;
	if (query.isError)
		return <QueryFailure error={query.error} retry={() => void query.refetch()} />;
	if (!query.data.items.length)
		return <p className="text-sm text-muted-foreground">{t.history.noRevisions}</p>;
	return (
		<div className="grid gap-3">
			<ol className="grid gap-3">
				{query.data.items.map((revision) => (
					<li key={revision.id}>
						<Card appearance="outlined">
							<CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
								<div className="grid gap-1">
									<div className="flex flex-wrap items-center gap-2">
										<span className="font-medium">
											{t.history.structureKinds[revision.kind]}
										</span>
										{revision.id === latestRevisionId ? (
											<Badge variant="secondary">
												{t.history.currentRevision}
											</Badge>
										) : null}
										{revision.minor ? (
											<Badge variant="outline">{t.history.minorEdit}</Badge>
										) : null}
									</div>
									<p className="text-sm text-muted-foreground">
										{new Intl.DateTimeFormat(locale.current, {
											dateStyle: "medium",
											timeStyle: "short",
										}).format(new Date(revision.createdAt))}
										{revision.actorProfileId ? (
											<>
												{" · "}
												<Link
													className="hover:underline"
													href={profileHref(revision.actorProfileId)}
												>
													{t.history.revisionBy}
												</Link>
											</>
										) : null}
									</p>
									<p className="text-sm">
										{revision.editSummary ?? t.history.noEditSummary}
									</p>
								</div>
								{canRestore && revision.id !== latestRevisionId ? (
									<Button
										isLoading={restore.isPending}
										onClick={() =>
											restore.mutate({
												path: {
													unitId,
													structureId,
													revisionId: revision.id,
												},
												body: { baseRevisionId: latestRevisionId },
											})
										}
										variant="outline"
									>
										{t.history.restoreRevision}
									</Button>
								) : null}
							</CardContent>
						</Card>
					</li>
				))}
			</ol>
			<RequestFailure error={restore.error} />
		</div>
	);
}
