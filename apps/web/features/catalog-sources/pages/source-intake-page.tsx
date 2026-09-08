"use client";
import { useState } from "react";
import { useApplicationRouter } from "@/features/application-shell/hooks/use-application-router";
import {
	useIntakeCatalogSource,
	type IntakeCatalogSourceStatus200,
} from "@rezics/openapi-tanstack-query";
import { Badge, Button, PageHeading } from "@rezics/ui";
import { RequireSession } from "@/features/auth/require-session";
import { AppLink } from "@/features/application-shell/components/app-link";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { SourceChoice, SourceText } from "../components/source-fields";
import { SourceJob } from "../components/source-job";
import {
	SourceProviders,
	SourceObjectTypes,
	sourceIntakeBody,
	type SourceProvider,
} from "../model/source-intake";
export function SourceIntakePage() {
	return (
		<RequireSession>
			<SourceIntakeForm />
		</RequireSession>
	);
}
function SourceIntakeForm() {
	const { t } = useTranslation(["units"]),
		copy = t.units.nativeSources;
	const [source, setSource] = useState<SourceProvider>("vndb"),
		[objectType, setObjectType] = useState<string>("vn"),
		[externalId, setExternalId] = useState(""),
		[invalid, setInvalid] = useState(false),
		[result, setResult] = useState<IntakeCatalogSourceStatus200 | null>(null);
	const mutation = useIntakeCatalogSource(),
		router = useApplicationRouter();
	return (
		<main className="mx-auto grid max-w-3xl gap-6 px-4 py-8">
			<PageHeading title={copy.intake} />
			<p>{copy.privateDraft}</p>
			<form
				className="grid gap-4"
				onSubmit={(event) => {
					event.preventDefault();
					if (mutation.isPending) return;
					const body = sourceIntakeBody(source, objectType, externalId);
					if (!body) {
						setInvalid(true);
						return;
					}
					setInvalid(false);
					setResult(null);
					void mutation
						.mutateAsync({ body })
						.then((result) => {
							setResult(result);
							if (result.status === "queued")
								router.push(`/catalog/sources/${result.job.sourceRecordId}/jobs/${result.job.id}`);
						})
						.catch(() => undefined);
				}}
			>
				<SourceChoice
					label={copy.provider}
					value={source}
					values={SourceProviders}
					labelFor={(value) => copy.providers[value]}
					onChange={(value) => {
						setSource(value);
						setObjectType(SourceObjectTypes[value][0]);
						setResult(null);
					}}
				/>
				<SourceChoice
					label={copy.objectType}
					value={objectType}
					values={SourceObjectTypes[source]}
					labelFor={(value) => {
						const type = SourceObjectTypes[source].find((item) => item === value);
						if (type === "release")
							return source === "musicbrainz"
								? copy.releaseTypes.musicbrainz
								: copy.releaseTypes.vndb;
						return type ? copy.objectTypes[type] : value;
					}}
					onChange={(value) => {
						setObjectType(value);
						setResult(null);
					}}
				/>
				<SourceText label={copy.externalId} value={externalId} onChange={setExternalId} required />
				{invalid ? <p role="alert">{copy.invalidInput}</p> : null}
				{mutation.error ? <RequestFailure error={mutation.error} /> : null}
				<Button type="submit" disabled={mutation.isPending}>
					{copy.import}
				</Button>
			</form>
			{result ? (
				result.status === "queued" ? (
					<SourceJob sourceRecordId={result.job.sourceRecordId} jobId={result.job.id} />
				) : (
					<section className="grid gap-3">
						<Badge>{copy.intakeStates[result.status]}</Badge>
						<div className="flex flex-wrap gap-2">
							<Button asChild>
								<AppLink href={`/catalog/${result.reference.owner}/${result.reference.id}`}>
									{copy.openRecord}
								</AppLink>
							</Button>
							<Button asChild variant="outline">
								<AppLink href={`/catalog/${result.reference.owner}/${result.reference.id}/sources`}>
									{copy.title}
								</AppLink>
							</Button>
						</div>
					</section>
				)
			) : null}
		</main>
	);
}
