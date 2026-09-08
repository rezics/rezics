"use client";
import { useState } from "react";
import {
	useGetCatalogSourceProposalPreview,
	useGetCatalogSourceProposalPreviewValue,
	type GetCatalogSourceProposalPreviewStatus200,
} from "@rezics/openapi-tanstack-query";
import { Button, QueryFailure, QueryPending } from "@rezics/ui";
import { useTranslation } from "@/i18n/client";
import { DefinitionChoice } from "@/features/catalog-definitions/components/definition-fields";
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
	const [profileKey, setProfileKey] = useState("");
	const query = useGetCatalogSourceProposalPreview({
		path,
		query: {
			action,
			limit: 25,
			afterPosition: cursors.at(-1),
			...(profileKey ? { profileKey } : {}),
		},
	});
	if (query.isPending) return <QueryPending />;
	if (query.isError) return <QueryFailure error={query.error} retry={() => void query.refetch()} />;
	const rawProfiles = new Map(
		[...query.data.profiles.before, ...query.data.profiles.after]
			.filter((profile) => profile.kind === "upstream_response")
			.map((profile) => [profile.key, profile]),
	);
	return (
		<section className="grid gap-4">
			<p className="text-sm text-muted-foreground">{copy.sourcePreviewNotice}</p>
			{rawProfiles.size ? (
				<DefinitionChoice
					label={copy.previewProfile}
					value={profileKey}
					values={["", ...rawProfiles.keys()]}
					labelFor={(key) => (key ? `${copy.rawProfile} · ${key}` : copy.nativeProfile)}
					onChange={(key) => {
						setProfileKey(key);
						setCursors([]);
					}}
				/>
			) : null}
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
					<dt>{copy.archiveDigest}</dt>
					<dd>
						<code>{query.data.afterArchiveSha256}</code>
					</dd>
				</dl>
				<SourceProfileEvidence profiles={query.data.profiles} />
			</details>
			{query.data.changes.length ? (
				query.data.changes.map((change) => (
					<article
						key={`${profileKey}:${change.position}`}
						className="grid gap-3 rounded border p-3"
					>
						<h4 className="break-all font-mono text-sm">{change.path}</h4>
						<div className="grid gap-3 md:grid-cols-2">
							<SourcePreviewValue
								path={path}
								action={action}
								profileKey={profileKey}
								valuePath={change.path}
								side="before"
								value={change.before}
							/>
							<SourcePreviewValue
								path={path}
								action={action}
								profileKey={profileKey}
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
	profileKey,
}: {
	path: Path;
	action: "apply" | "withdraw";
	valuePath: string;
	side: "before" | "after";
	value: Value | null;
	profileKey: string;
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
							profileKey={profileKey}
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
	profileKey,
}: {
	path: Path;
	action: "apply" | "withdraw";
	side: "before" | "after";
	valuePath: string;
	expectedSha256: string;
	profileKey: string;
}) {
	const { t } = useTranslation(["units", "actions", "ui"]),
		copy = t.units.nativeSources;
	const [offsets, setOffsets] = useState<number[]>([]);
	const query = useGetCatalogSourceProposalPreviewValue({
		path,
		query: {
			action,
			side,
			path: valuePath,
			offset: offsets.at(-1) ?? 0,
			limit: 8192,
			...(profileKey ? { profileKey } : {}),
		},
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

function SourceProfileEvidence({
	profiles,
}: {
	profiles: GetCatalogSourceProposalPreviewStatus200["profiles"];
}) {
	const { t } = useTranslation(["units"]),
		copy = t.units.nativeSources;
	if (!profiles.before.length && !profiles.after.length) return null;
	return (
		<section className="mt-3 grid gap-3">
			<p>{copy.profileCaptureNotice}</p>
			{(["before", "after"] as const).map((side) => (
				<div key={side} className="grid gap-2">
					<h4 className="font-medium">{copy[side]}</h4>
					{profiles[side].map((profile) => (
						<details key={profile.key} className="rounded border p-3">
							<summary>
								{profile.kind === "derived_view" ? copy.nativeProfile : copy.rawProfile} ·{" "}
								<code>{profile.key}</code>
							</summary>
							<dl className="mt-2 grid gap-2 break-all">
								<dt>{copy.capturedAt}</dt>
								<dd>
									<time dateTime={profile.observedAt}>{profile.observedAt}</time>
								</dd>
								<dt>{copy.sourceDigest}</dt>
								<dd>
									<code>{profile.contentSha256}</code>
								</dd>
								<dt>{copy.captureRequest}</dt>
								<dd>
									<code>{profile.requestUrl}</code>
								</dd>
								{profile.derivedFrom.length ? (
									<>
										<dt>{copy.derivedFrom}</dt>
										<dd>
											<ul>
												{profile.derivedFrom.map((source) => (
													<li key={source.key}>
														<code>
															{source.key} · {source.contentSha256}
														</code>
													</li>
												))}
											</ul>
										</dd>
									</>
								) : null}
							</dl>
						</details>
					))}
				</div>
			))}
		</section>
	);
}
