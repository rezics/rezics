"use client";
import { useGetCatalogSourceJob, useControlCatalogSourceJob } from "@rezics/openapi-tanstack-query";
import { Badge, Button, QueryFailure, QueryPending } from "@rezics/ui";
import { AppLink } from "@/features/application-shell/components/app-link";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
export function SourceJob({ sourceRecordId, jobId }: { sourceRecordId: string; jobId: string }) {
	const { t } = useTranslation(["units", "actions"]),
		copy = t.units.nativeSources;
	const query = useGetCatalogSourceJob({ path: { sourceRecordId, jobId } }),
		control = useControlCatalogSourceJob();
	if (query.isPending) return <QueryPending />;
	if (query.isError) return <QueryFailure error={query.error} retry={() => void query.refetch()} />;
	const job = query.data;
	return (
		<section className="grid gap-3 rounded-lg border p-4">
			<h2 className="font-semibold">{copy.job}</h2>
			<Badge>{copy.jobStates[job.state]}</Badge>
			<p>
				{copy.preparedDependencies}: {job.preparedDependencies}
			</p>
			{job.outcomeCode ? (
				<p className="break-all">
					{copy.outcome}: <code>{job.outcomeCode}</code>
				</p>
			) : null}
			<div className="flex flex-wrap gap-2">
				<Button variant="outline" onClick={() => void query.refetch()} disabled={query.isFetching}>
					{copy.refresh}
				</Button>
				{job.state === "queued" || job.state === "prepared" || job.state === "paused" ? (
					<Button
						variant="outline"
						disabled={control.isPending}
						onClick={() => {
							void control
								.mutateAsync({
									path: { sourceRecordId, jobId },
									body: { action: job.state === "paused" ? "resume" : "pause" },
								})
								.then(() => query.refetch())
								.catch(() => undefined);
						}}
					>
						{job.state === "paused" ? copy.resume : copy.pause}
					</Button>
				) : null}
				{job.reference ? (
					<Button asChild>
						<AppLink href={`/catalog/${job.reference.owner}/${job.reference.id}`}>
							{copy.openRecord}
						</AppLink>
					</Button>
				) : null}
			</div>
			{control.error ? <RequestFailure error={control.error} /> : null}
		</section>
	);
}
