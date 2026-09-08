"use client";
import { useState } from "react";
import { useApplicationRouter } from "@/features/application-shell/hooks/use-application-router";
import {
	useListCatalogSourceProposals,
	useDecideCatalogSourceProposal,
	type ListCatalogSourceProposalsStatus200,
} from "@rezics/openapi-tanstack-query";
import { Badge, Button, QueryFailure, QueryPending } from "@rezics/ui";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { SourceText } from "./source-fields";
import { SourceJob } from "./source-job";
import { SourceProposalPreview } from "./source-proposal-preview";
type Proposal = ListCatalogSourceProposalsStatus200["items"][number];
export function SourceProposals({
	sourceRecordId,
	mappingKey,
	canEdit,
	onChanged,
}: {
	sourceRecordId: string;
	mappingKey: string;
	canEdit: boolean;
	onChanged: () => void;
}) {
	const { t } = useTranslation(["units", "actions", "ui"]),
		copy = t.units.nativeSources;
	const [cursors, setCursors] = useState<string[]>([]);
	const query = useListCatalogSourceProposals({
		path: { sourceRecordId, mappingKey },
		query: { limit: 25, afterId: cursors.at(-1) },
	});
	if (query.isPending) return <QueryPending />;
	if (query.isError) return <QueryFailure error={query.error} retry={() => void query.refetch()} />;
	return (
		<section className="grid gap-4">
			<h3 className="font-semibold">{copy.history}</h3>
			{query.data.items.length ? (
				query.data.items.map((proposal) => (
					<SourceProposal
						key={`${proposal.id}:${proposal.state}`}
						proposal={proposal}
						canEdit={canEdit}
						onChanged={() => {
							void query.refetch();
							onChanged();
						}}
					/>
				))
			) : (
				<p>{copy.noProposals}</p>
			)}
			<div className="flex gap-2">
				{cursors.length ? (
					<Button variant="outline" onClick={() => setCursors((value) => value.slice(0, -1))}>
						{t.ui.shelf.previous}
					</Button>
				) : null}
				{query.data.afterId ? (
					<Button
						variant="outline"
						onClick={() => {
							const after = query.data.afterId;
							if (after) setCursors((value) => [...value, after]);
						}}
					>
						{t.actions.loadMore}
					</Button>
				) : null}
			</div>
		</section>
	);
}
function SourceProposal({
	proposal,
	canEdit,
	onChanged,
}: {
	proposal: Proposal;
	canEdit: boolean;
	onChanged: () => void;
}) {
	const { t } = useTranslation(["units"]),
		copy = t.units.nativeSources;
	const [review, setReview] = useState<"apply" | "withdraw" | null>(null),
		[reason, setReason] = useState(""),
		[job, setJob] = useState<{ sourceRecordId: string; id: string } | null>(null);
	const router = useApplicationRouter();
	const mutation = useDecideCatalogSourceProposal(),
		path = { sourceRecordId: proposal.sourceRecordId, proposalId: proposal.id };
	function decide(action: "apply" | "withdraw" | "reject" | "supersede") {
		if (mutation.isPending || !reason.trim() || reason.trim().length > 2048) return;
		void mutation
			.mutateAsync({
				path,
				body: { mappingVersion: proposal.mappingVersion, action, reason: reason.trim() },
			})
			.then((result) => {
				if (result.status === "queued") {
					setJob(result.job);
					router.push(`/catalog/sources/${result.job.sourceRecordId}/jobs/${result.job.id}`);
				}
				onChanged();
			})
			.catch(() => undefined);
	}
	return (
		<article className="grid gap-3 rounded-lg border p-4">
			<div className="flex flex-wrap gap-3">
				<Badge>{copy.proposalStates[proposal.state]}</Badge>
				<time dateTime={proposal.createdAt}>{proposal.createdAt}</time>
			</div>
			{proposal.decisionReason ? (
				<p className="whitespace-pre-wrap break-words">{proposal.decisionReason}</p>
			) : null}
			{canEdit && (proposal.state === "pending" || proposal.state === "applied") ? (
				<>
					<div className="flex gap-2">
						<Button
							variant="outline"
							aria-expanded={review !== null}
							onClick={() =>
								setReview((current) =>
									current ? null : proposal.state === "pending" ? "apply" : "withdraw",
								)
							}
						>
							{proposal.state === "pending" ? copy.review : copy.reviewWithdrawal}
						</Button>
					</div>
					<SourceText label={copy.reason} value={reason} onChange={setReason} multiline required />
					{review ? (
						<SourceProposalPreview
							path={path}
							action={review}
							disabled={mutation.isPending || !reason.trim() || reason.trim().length > 2048}
							onConfirm={() => decide(review)}
						/>
					) : null}
					{proposal.state === "pending" ? (
						<div className="flex gap-2">
							<Button
								variant="outline"
								disabled={mutation.isPending || !reason.trim() || reason.trim().length > 2048}
								onClick={() => decide("reject")}
							>
								{copy.reject}
							</Button>
							<Button
								variant="outline"
								disabled={mutation.isPending || !reason.trim() || reason.trim().length > 2048}
								onClick={() => decide("supersede")}
							>
								{copy.supersede}
							</Button>
						</div>
					) : null}
				</>
			) : null}
			{mutation.error ? <RequestFailure error={mutation.error} /> : null}
			{job ? <SourceJob sourceRecordId={job.sourceRecordId} jobId={job.id} /> : null}
		</article>
	);
}
