"use client";
import { useState } from "react";
import {
	useListNativeMergeReconciliation,
	useReadCatalogResource,
	useResolveNativeMergeReconciliation,
} from "@rezics/openapi-tanstack-query";
import type {
	ListNativeMergeReconciliationStatus200,
	ReadNativeMergeRequestStatus200,
} from "@rezics/openapi-tanstack-query";
import { Badge, Button, QueryFailure, QueryPending } from "@rezics/ui";
import { AppLink } from "@/features/application-shell/components/app-link";
import {
	DefinitionChoice,
	DefinitionText,
} from "@/features/catalog-definitions/components/definition-fields";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { useConsoleWorkspace } from "./console-workspace";
type Item = ListNativeMergeReconciliationStatus200["items"][number];

export function NativeMergeReconciliation({
	request,
	onChanged,
}: {
	request: ReadNativeMergeRequestStatus200;
	onChanged: () => void;
}) {
	const { t } = useTranslation(["console"]),
		copy = t.console.nativeMerge;
	const [cursors, setCursors] = useState<string[]>([]),
		[state, setState] = useState<Item["state"] | "all">("all");
	const items = useListNativeMergeReconciliation({
		path: { requestId: request.id },
		query: { limit: 25, cursor: cursors.at(-1), ...(state === "all" ? {} : { state }) },
	});
	return (
		<section className="grid gap-3">
			<h3 className="font-medium">{copy.items}</h3>
			<DefinitionChoice
				label={copy.itemState}
				value={state}
				values={["all", "pending", "applied", "retained", "action_required"]}
				labelFor={(value) =>
					value === "all" ? t.console.unitMerges.allStates : copy.itemStates[value]
				}
				onChange={(value) => {
					setState(value);
					setCursors([]);
				}}
			/>
			{items.isPending ? (
				<QueryPending />
			) : items.isError ? (
				<QueryFailure error={items.error} retry={() => void items.refetch()} />
			) : (
				<>
					{items.data.items.map((item) => (
						<ReconciliationItem
							key={`${item.id}:${item.currentBinding?.revision ?? 0}`}
							item={item}
							request={request}
							onChanged={() => {
								void items.refetch();
								onChanged();
							}}
						/>
					))}
					{!items.data.items.length ? <p>{copy.noItems}</p> : null}
					<div className="flex gap-2">
						{cursors.length ? (
							<Button variant="outline" onClick={() => setCursors((value) => value.slice(0, -1))}>
								{copy.previous}
							</Button>
						) : null}
						{items.data.nextCursor ? (
							<Button
								variant="outline"
								onClick={() => {
									const next = items.data.nextCursor;
									if (next) setCursors((value) => [...value, next]);
								}}
							>
								{t.console.unitMerges.loadMore}
							</Button>
						) : null}
					</div>
				</>
			)}
		</section>
	);
}

function ReconciliationItem({
	item,
	request,
	onChanged,
}: {
	item: Item;
	request: ReadNativeMergeRequestStatus200;
	onChanged: () => void;
}) {
	const { t } = useTranslation(["console", "units"]),
		copy = t.console.nativeMerge;
	const { canRetryUnitMerges } = useConsoleWorkspace();
	const [resolving, setResolving] = useState(false),
		[reason, setReason] = useState("");
	const target = useReadCatalogResource(
		{ path: item.targetReference },
		{ query: { enabled: resolving } },
	);
	const mutation = useResolveNativeMergeReconciliation();
	const currentBinding = item.currentBinding;
	const bindingAtSource =
		currentBinding?.reference.owner === item.sourceReference.owner &&
		currentBinding.reference.id === item.sourceReference.id;
	const missingBinding = item.kind === "source_binding" && !currentBinding;
	async function resolve(action: "retry" | "retain_source") {
		if (
			!target.data ||
			!reason.trim() ||
			missingBinding ||
			(action === "retry" && item.kind === "source_binding" && !bindingAtSource)
		)
			return;
		try {
			await mutation.mutateAsync({
				path: { requestId: request.id, itemId: item.id },
				body: {
					action,
					expectedTargetRevision: target.data.revision,
					reason: reason.trim(),
					...(item.kind === "source_binding" && currentBinding
						? { expectedBindingRevision: currentBinding.revision }
						: {}),
				},
			});
			setResolving(false);
			onChanged();
		} catch {
			/* Rendered below. */
		}
	}
	const sourceHref = `/catalog/${item.sourceReference.owner}/${item.sourceReference.id}`;
	return (
		<article className="grid gap-3 rounded border p-3">
			<div className="flex flex-wrap gap-2">
				<span>{copy.kinds[item.kind]}</span>
				<Badge>{copy.itemStates[item.state]}</Badge>
			</div>
			{item.kind === "source_binding" ? (
				currentBinding ? (
					<section className="grid gap-2 rounded border p-3">
						<h4 className="font-medium">{copy.currentBinding}</h4>
						<AppLink
							className="break-all underline"
							href={`/catalog/${currentBinding.reference.owner}/${currentBinding.reference.id}/sources`}
						>
							{currentBinding.reference.id}
						</AppLink>
						<p>
							{copy.revision}: {currentBinding.revision} ·{" "}
							{t.units.nativeSources.bindingStates[currentBinding.state]}
						</p>
						{!bindingAtSource ? <p>{copy.bindingMoved}</p> : null}
					</section>
				) : (
					<p>{copy.bindingUnavailable}</p>
				)
			) : null}
			<details>
				<summary>{copy.evidence}</summary>
				<dl className="mt-2 grid gap-2 text-xs">
					<dt>{copy.sourceKey}</dt>
					<dd className="break-all">
						<code>{item.sourceKey}</code>
					</dd>
					{item.sourceSemanticId ? (
						<>
							<dt>{copy.semantic}</dt>
							<dd>
								<code>{item.sourceSemanticId}</code> · {item.sourceSemanticVersion}
							</dd>
						</>
					) : null}
					{item.sourceNameId ? (
						<>
							<dt>{copy.names}</dt>
							<dd>
								<code>{item.sourceNameId}</code> · {item.sourceNameRevision}
							</dd>
						</>
					) : null}
					{item.sourceIdentifierId ? (
						<>
							<dt>{copy.identifiers}</dt>
							<dd>
								<code>{item.sourceIdentifierId}</code> · {item.sourceIdentifierRevision}
							</dd>
						</>
					) : null}
					{item.sourceRecordId ? (
						<>
							<dt>{copy.bindings}</dt>
							<dd>
								<AppLink href={`${sourceHref}/sources`}>{item.sourceRecordId}</AppLink> ·{" "}
								{item.sourceBindingRevision}
							</dd>
						</>
					) : null}
					{item.errorCode ? (
						<>
							<dt>{copy.issue}</dt>
							<dd>
								<code>{item.errorCode}</code>
							</dd>
						</>
					) : null}
				</dl>
			</details>
			<Button asChild variant="outline">
				<AppLink href={item.kind === "semantic" ? `${sourceHref}/facts` : sourceHref}>
					{copy.openEvidence}
				</AppLink>
			</Button>
			{canRetryUnitMerges &&
			request.operation?.state !== "processing" &&
			(item.state === "pending" || item.state === "action_required") ? (
				<Button
					variant="outline"
					aria-expanded={resolving}
					onClick={() => setResolving((value) => !value)}
				>
					{copy.resolve}
				</Button>
			) : null}
			{resolving ? (
				<div className="grid gap-3">
					{target.isPending ? (
						<QueryPending />
					) : target.isError ? (
						<QueryFailure error={target.error} retry={() => void target.refetch()} />
					) : (
						<>
							<p>
								{request.manifest.targetUnit.title ?? item.targetReference.id} · {copy.revision}{" "}
								{target.data.revision}
							</p>
							<DefinitionText
								label={copy.reason}
								value={reason}
								onChange={setReason}
								multiline
								disabled={mutation.isPending}
							/>
							<div className="flex gap-2">
								<Button
									disabled={
										mutation.isPending ||
										!reason.trim() ||
										missingBinding ||
										(item.kind === "source_binding" && !bindingAtSource)
									}
									onClick={() => void resolve("retry")}
								>
									{copy.retryItem}
								</Button>
								<Button
									variant="outline"
									disabled={mutation.isPending || !reason.trim() || missingBinding}
									onClick={() => void resolve("retain_source")}
								>
									{item.kind === "source_binding" && !bindingAtSource
										? copy.keepCurrentBinding
										: copy.retainItem}
								</Button>
							</div>
						</>
					)}
					<RequestFailure error={mutation.error} />
				</div>
			) : null}
		</article>
	);
}
