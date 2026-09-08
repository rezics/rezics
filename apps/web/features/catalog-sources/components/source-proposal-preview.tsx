"use client";
import { useState } from "react";
import {
	useGetCatalogSourceProposalPreview,
	useGetCatalogSourceProposalPreviewValue,
	type GetCatalogSourceProposalPreviewStatus200,
} from "@rezics/openapi-tanstack-query";
import { Button, QueryFailure, QueryPending } from "@rezics/ui";
import { useTranslation } from "@/i18n/client";
type Path = { sourceRecordId: string; proposalId: string };
type Value = NonNullable<GetCatalogSourceProposalPreviewStatus200["changes"][number]["before"]>;
export function SourceProposalPreview({
	path,
	action,
	disabled,
	onConfirm,
}: {
	path: Path;
	action: "apply" | "withdraw";
	disabled: boolean;
	onConfirm: () => void;
}) {
	const { t } = useTranslation(["units", "actions", "ui"]),
		copy = t.units.nativeSources;
	const [cursors, setCursors] = useState<number[]>([]);
	const query = useGetCatalogSourceProposalPreview({
		path,
		query: { action, limit: 25, afterPosition: cursors.at(-1) },
	});
	if (query.isPending) return <QueryPending />;
	if (query.isError) return <QueryFailure error={query.error} retry={() => void query.refetch()} />;
	return (
		<section className="grid gap-4">
			<p className="text-sm text-muted-foreground">{copy.sourcePreviewNotice}</p>
			<details className="text-sm">
				<summary>{copy.reviewDetails}</summary>
				<dl className="grid gap-2 break-all">
					<dt>{copy.mappingVersion}</dt>
					<dd>{query.data.proposal.mappingVersion}</dd>
					<dt>{copy.targetRevision}</dt>
					<dd>{query.data.proposal.expectedTargetRevision}</dd>
					<dt>{copy.bindingRevision}</dt>
					<dd>{query.data.proposal.expectedBindingRevision}</dd>
					<dt>{copy.sourceDigest}</dt>
					<dd>
						<code>{query.data.afterSha256}</code>
					</dd>
				</dl>
			</details>
			{query.data.changes.length ? (
				query.data.changes.map((change) => (
					<article key={change.position} className="grid gap-3 rounded border p-3">
						<h4 className="break-all font-mono text-sm">{change.path}</h4>
						<div className="grid gap-3 md:grid-cols-2">
							<SourcePreviewValue
								path={path}
								action={action}
								valuePath={change.path}
								side="before"
								value={change.before}
							/>
							<SourcePreviewValue
								path={path}
								action={action}
								valuePath={change.path}
								side="after"
								value={change.after}
							/>
						</div>
					</article>
				))
			) : (
				<p>{copy.noChanges}</p>
			)}
			<div className="flex flex-wrap gap-2">
				{cursors.length ? (
					<Button variant="outline" onClick={() => setCursors((value) => value.slice(0, -1))}>
						{t.ui.shelf.previous}
					</Button>
				) : null}
				{query.data.afterPosition !== null ? (
					<Button
						variant="outline"
						onClick={() => {
							const after = query.data.afterPosition;
							if (after !== null) setCursors((value) => [...value, after]);
						}}
					>
						{t.actions.loadMore}
					</Button>
				) : null}
			</div>
			{action === "withdraw" ? <p>{copy.withdrawProposalNotice}</p> : null}
			<Button disabled={disabled} onClick={onConfirm}>
				{action === "apply" ? copy.apply : copy.withdraw}
			</Button>
		</section>
	);
}
function SourcePreviewValue({
	path,
	action,
	valuePath,
	side,
	value,
}: {
	path: Path;
	action: "apply" | "withdraw";
	valuePath: string;
	side: "before" | "after";
	value: Value | null;
}) {
	const { t } = useTranslation(["units"]),
		copy = t.units.nativeSources;
	const [expanded, setExpanded] = useState(false);
	return (
		<section className="min-w-0">
			<h5 className="mb-2 text-sm font-medium">{copy[side]}</h5>
			{value ? (
				<>
					<pre className="max-h-80 overflow-auto whitespace-pre-wrap break-all rounded bg-muted p-3 text-xs">
						{value.text}
					</pre>
					{!value.complete ? (
						<Button
							variant="outline"
							aria-expanded={expanded}
							onClick={() => setExpanded((current) => !current)}
						>
							{copy.readValue}
						</Button>
					) : null}
					{expanded ? (
						<SourceFullValue
							path={path}
							action={action}
							side={side}
							valuePath={valuePath}
							expectedSha256={value.sha256}
						/>
					) : null}
				</>
			) : (
				<p className="text-sm text-muted-foreground">{copy.absent}</p>
			)}
		</section>
	);
}
function SourceFullValue({
	path,
	action,
	side,
	valuePath,
	expectedSha256,
}: {
	path: Path;
	action: "apply" | "withdraw";
	side: "before" | "after";
	valuePath: string;
	expectedSha256: string;
}) {
	const { t } = useTranslation(["units", "actions", "ui"]),
		copy = t.units.nativeSources;
	const [offsets, setOffsets] = useState<number[]>([]);
	const query = useGetCatalogSourceProposalPreviewValue({
		path,
		query: { action, side, path: valuePath, offset: offsets.at(-1) ?? 0, limit: 8192 },
	});
	if (query.isPending) return <QueryPending />;
	if (query.isError) return <QueryFailure error={query.error} retry={() => void query.refetch()} />;
	if (query.data.sha256 !== expectedSha256) return <p role="alert">{copy.changedEvidence}</p>;
	return (
		<div className="grid gap-2">
			<pre className="max-h-96 overflow-auto whitespace-pre-wrap break-all rounded bg-muted p-3 text-xs">
				{query.data.text}
			</pre>
			<div className="flex gap-2">
				{offsets.length ? (
					<Button variant="outline" onClick={() => setOffsets((value) => value.slice(0, -1))}>
						{t.ui.shelf.previous}
					</Button>
				) : null}
				{query.data.afterOffset !== null ? (
					<Button
						variant="outline"
						onClick={() => {
							const after = query.data.afterOffset;
							if (after !== null) setOffsets((value) => [...value, after]);
						}}
					>
						{t.actions.loadMore}
					</Button>
				) : null}
			</div>
		</div>
	);
}
