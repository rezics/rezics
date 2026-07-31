"use client";

import {
	getApiHistoryUnitsByUnitIdRevisionsQueryKey,
	useGetApiHistoryUnitsByUnitIdRevisions,
	usePostApiHistoryUnitsByUnitIdRevisionsByRevisionIdRestore,
	usePostApiHistoryUnitsByUnitIdRevisionsByRevisionIdUndo,
} from "@rezics/openapi-tanstack-query";
import {
	Badge,
	Button,
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
	QueryFailure,
	QueryPending,
	Spinner,
} from "@rezics/ui";
import { useQueryClient } from "@tanstack/react-query";
import { AppLink as Link } from "@/features/application-shell/components/app-link";

import { profileHref } from "@/features/profiles/profile-route";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { canViewRevisionField } from "../model/revision-visibility";
import { UnitRevisionVisibilityDialog } from "./unit-revision-visibility-dialog";

export interface UnitRevisionHistoryProps {
	unitId: string;
	compareHref: (fromRevisionId: string, toRevisionId: string) => string;
	onChanged?: () => Promise<unknown> | unknown;
}

export function UnitRevisionHistory({ unitId, compareHref, onChanged }: UnitRevisionHistoryProps) {
	const { t, locale } = useTranslation(["history"]);
	const queryClient = useQueryClient();
	const history = useGetApiHistoryUnitsByUnitIdRevisions({
		path: { unitId },
		query: { limit: 100 },
	});
	const restore = usePostApiHistoryUnitsByUnitIdRevisionsByRevisionIdRestore();
	const undo = usePostApiHistoryUnitsByUnitIdRevisionsByRevisionIdUndo();

	if (history.isError)
		return <QueryFailure error={history.error} retry={() => void history.refetch()} />;
	if (!history.data) return <QueryPending />;

	const currentRevision = history.data.items.find((revision) => revision.isCurrent);
	const capabilities = history.data.capabilities;
	const canRestore = capabilities.canRestore;
	const canManageVisibility = capabilities.canModerate || capabilities.canSuppress;
	const pending = restore.isPending || undo.isPending;
	const refresh = async () => {
		await queryClient.invalidateQueries({
			queryKey: getApiHistoryUnitsByUnitIdRevisionsQueryKey({ path: { unitId } }),
		});
		await onChanged?.();
	};

	return (
		<div className="grid gap-4">
			<RequestFailure error={restore.error ?? undo.error} />
			{history.data.items.length ? (
				history.data.items.map((revision) => {
					const summaryAvailable = canViewRevisionField(
						revision.visibility,
						"summary",
						capabilities,
					);
					const canManageRevisionVisibility =
						revision.visibility.kind === "suppressed"
							? capabilities.canSuppress
							: canManageVisibility;
					return (
						<Card appearance="outlined" key={revision.id}>
							<CardHeader>
								<CardTitle className="flex flex-wrap items-center gap-2 text-base">
									<time dateTime={revision.createdAt}>
										{new Intl.DateTimeFormat(locale.current, {
											dateStyle: "medium",
											timeStyle: "short",
										}).format(new Date(revision.createdAt))}
									</time>
									{revision.isCurrent ? (
										<Badge>{t.history.currentRevision}</Badge>
									) : null}
									{revision.minor ? (
										<Badge variant="secondary">{t.history.minorEdit}</Badge>
									) : null}
									{revision.visibility.kind !== "visible" ? (
										<Badge variant="destructive">
											{revision.visibility.kind === "suppressed"
												? t.history.visibility.suppressedBadge
												: t.history.visibility.hiddenBadge}
										</Badge>
									) : null}
									{revision.tags.map((tag) => (
										<Badge key={tag} variant="outline">
											{tag}
										</Badge>
									))}
								</CardTitle>
								<CardDescription>
									{summaryAvailable
										? (revision.editSummary ?? t.history.noEditSummary)
										: t.history.visibility.protectedSummary}{" "}
									· {formatDelta(revision.sizeDelta, t.history.bytes)}
									{revision.actorProfileId ? (
										<>
											{" · "}
											{t.history.revisionBy}{" "}
											<Link
												className="text-link hover:text-link-hover"
												href={profileHref(revision.actorProfileId)}
											>
												{revision.actorName ??
													revision.actorProfileId.slice(0, 8)}
											</Link>
										</>
									) : null}
								</CardDescription>
							</CardHeader>
							<CardContent className="flex flex-wrap gap-2">
								{revision.parentRevisionId &&
								revision.contentAvailable &&
								revision.parentContentAvailable ? (
									<Button asChild size="sm" variant="outline">
										<Link
											href={compareHref(
												revision.parentRevisionId,
												revision.id,
											)}
										>
											{t.history.compareWithParent}
										</Link>
									</Button>
								) : null}
								{canRestore &&
								revision.parentRevisionId &&
								revision.contentAvailable &&
								revision.parentContentAvailable &&
								currentRevision ? (
									<Button
										disabled={pending}
										onClick={() =>
											undo.mutate(
												{
													path: { unitId, revisionId: revision.id },
													body: { baseRevisionId: currentRevision.id },
												},
												{ onSuccess: refresh },
											)
										}
										size="sm"
										variant="secondary"
									>
										{undo.isPending ? (
											<Spinner data-icon="inline-start" />
										) : null}
										{t.history.undoRevision}
									</Button>
								) : null}
								{canRestore &&
								!revision.isCurrent &&
								revision.contentAvailable &&
								currentRevision ? (
									<Button
										disabled={pending}
										onClick={() =>
											restore.mutate(
												{
													path: { unitId, revisionId: revision.id },
													body: { baseRevisionId: currentRevision.id },
												},
												{ onSuccess: refresh },
											)
										}
										size="sm"
										variant="solid"
									>
										{restore.isPending ? (
											<Spinner data-icon="inline-start" />
										) : null}
										{t.history.restoreRevision}
									</Button>
								) : null}
								{canManageRevisionVisibility ? (
									<UnitRevisionVisibilityDialog
										capabilities={capabilities}
										onChanged={refresh}
										revision={revision}
									/>
								) : null}
							</CardContent>
						</Card>
					);
				})
			) : (
				<p className="text-sm text-muted-foreground">{t.history.noRevisions}</p>
			)}
		</div>
	);
}

function formatDelta(value: string | number, bytesLabel: string) {
	const delta = Number(value);
	return `${delta > 0 ? "+" : ""}${delta} ${bytesLabel}`;
}
