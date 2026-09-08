"use client";
import { useState } from "react";
import { useReviewNativeMerge, useRetryNativeMerge } from "@rezics/openapi-tanstack-query";
import type { ReadNativeMergeRequestStatus200 } from "@rezics/openapi-tanstack-query";
import { Badge, Button } from "@rezics/ui";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { DefinitionText } from "@/features/catalog-definitions/components/definition-fields";
import { useConsoleWorkspace } from "./console-workspace";
import { NativeMergeManifest } from "./native-merge-plan";
import { NativeMergeReconciliation } from "./native-merge-reconciliation";

export function NativeMergeDetail({
	request,
	onChanged,
}: {
	request: ReadNativeMergeRequestStatus200;
	onChanged: () => void;
}) {
	const { t } = useTranslation(["console"]),
		copy = t.console.unitMerges,
		native = t.console.nativeMerge;
	const workspace = useConsoleWorkspace();
	const [decision, setDecision] = useState<"approve" | "reject">(),
		[note, setNote] = useState(""),
		[confirmation, setConfirmation] = useState("");
	const review = useReviewNativeMerge(),
		retry = useRetryNativeMerge();
	const canReview =
		workspace.canReviewUnitMerges &&
		request.state === "pending_review" &&
		request.proposer.entityId !== workspace.currentProfileId &&
		!request.reviews.some((item) => item.entityId === workspace.currentProfileId);
	async function submit() {
		if (!decision || !canReview || confirmation !== request.id) return;
		try {
			await review.mutateAsync({
				path: { requestId: request.id },
				body: {
					decision,
					requestFingerprint: request.manifest.fingerprint,
					...(note.trim() ? { note: note.trim() } : {}),
				},
			});
			setDecision(undefined);
			onChanged();
		} catch {
			/* Rendered below. */
		}
	}
	return (
		<>
			<div className="flex flex-wrap items-center gap-3">
				<Badge>{copy.states[request.state]}</Badge>
				<Button variant="outline" onClick={onChanged}>
					{native.refresh}
				</Button>
			</div>
			<NativeMergeManifest manifest={request.manifest} />
			<p>
				{copy.approvalProgress({ count: request.approvals, required: request.requiredApprovals })}
			</p>
			{request.note ? <p className="whitespace-pre-wrap">{request.note}</p> : null}
			<section className="grid gap-2">
				<h3 className="font-medium">{copy.reviews}</h3>
				{request.reviews.length ? (
					request.reviews.map((item) => (
						<article className="rounded border p-3" key={item.entityId}>
							<p>
								{item.entityId} · {copy.decisions[item.decision]}
							</p>
							{item.note ? <p className="whitespace-pre-wrap">{item.note}</p> : null}
							<time dateTime={item.createdAt}>{item.createdAt}</time>
						</article>
					))
				) : (
					<p>{copy.noReviews}</p>
				)}
			</section>
			{canReview ? (
				<div className="flex gap-2">
					<Button
						disabled={review.isPending}
						onClick={() => {
							setDecision("approve");
							setConfirmation("");
							review.reset();
						}}
					>
						{copy.approve}
					</Button>
					<Button
						variant="destructive"
						disabled={review.isPending}
						onClick={() => {
							setDecision("reject");
							setConfirmation("");
							review.reset();
						}}
					>
						{copy.reject}
					</Button>
				</div>
			) : null}
			{canReview && decision ? (
				<section className="grid gap-3 rounded border p-4">
					<h3 className="font-medium">
						{decision === "approve" ? copy.approveTitle : copy.rejectTitle}
					</h3>
					<p>{decision === "approve" ? native.retainedAccess : copy.rejectDescription}</p>
					<DefinitionText
						label={copy.reviewNote}
						value={note}
						onChange={setNote}
						multiline
						disabled={review.isPending}
					/>
					<code className="break-all">{request.id}</code>
					<DefinitionText
						label={copy.confirmRequest}
						value={confirmation}
						onChange={(value) => setConfirmation(value.trim())}
						disabled={review.isPending}
					/>
					<Button
						disabled={review.isPending || confirmation !== request.id}
						onClick={() => void submit()}
					>
						{decision === "approve" ? copy.confirmApprove : copy.confirmReject}
					</Button>
				</section>
			) : null}
			<RequestFailure error={review.error ?? retry.error} />
			{request.operation ? (
				<section className="grid gap-2 rounded border p-4">
					<h3 className="font-medium">{copy.operation}</h3>
					<p>
						{copy.operationStates[request.operation.state]} ·{" "}
						{native.phases[request.operation.phase]}
					</p>
					<p>{copy.processedRows({ count: request.operation.processedRows })}</p>
					<p>
						{native.resolved}: {request.operation.resolvedItems} / {request.operation.totalItems}
					</p>
					{request.operation.lastErrorCode ? (
						<code className="break-all text-xs">{request.operation.lastErrorCode}</code>
					) : null}
				</section>
			) : null}
			{workspace.canRetryUnitMerges &&
			(request.state === "failed" || request.state === "action_required") ? (
				<Button
					disabled={retry.isPending}
					onClick={() => {
						void retry
							.mutateAsync({ path: { requestId: request.id } })
							.then(onChanged)
							.catch(() => undefined);
					}}
				>
					{copy.retry}
				</Button>
			) : null}
			{request.canonicalizedAt ? (
				<NativeMergeReconciliation request={request} onChanged={onChanged} />
			) : null}
		</>
	);
}
