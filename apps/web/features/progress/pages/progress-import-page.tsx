"use client";

import { verbatimTerms } from "@rezics/i18n/verbatim-terms";
import { usePostApiProgressImport } from "@rezics/openapi-tanstack-query";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, FileUp } from "lucide-react";
import Link from "next/link";
import { useState, type FormEvent } from "react";

import {
	Button,
	Card,
	CardContent,
	Field,
	FieldDescription,
	FieldGroup,
	FieldLabel,
	Input,
	PageHeading,
} from "@rezics/ui";
import { RequireSession } from "@/features/auth/require-session";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { invalidateProgressQueries } from "../data/progress-cache";
import {
	ProgressImportHeader,
	parseProgressImportCsv,
	type ProgressImportResult,
} from "../model/progress-import";

export function ProgressImportPage() {
	return (
		<RequireSession>
			<ProgressImportContent />
		</RequireSession>
	);
}

function ProgressImportContent() {
	const queryClient = useQueryClient();
	const importProgress = usePostApiProgressImport();
	const { t } = useTranslation(["engagement", "errors", "ui"]);
	const [sourceProvider, setSourceProvider] = useState("");
	const [result, setResult] = useState<ProgressImportResult>();
	const [successCount, setSuccessCount] = useState<number>();
	const copy = t.engagement.progressJournal;

	async function selectFile(file: File | undefined) {
		setSuccessCount(undefined);
		setResult(file ? parseProgressImportCsv(await file.text()) : undefined);
	}

	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!result || result.kind !== "success" || !sourceProvider.trim()) return;
		try {
			const response = await importProgress.mutateAsync({
				body: {
					items: result.items,
					sourceProvider: sourceProvider.trim(),
				},
			});
			await invalidateProgressQueries(queryClient);
			setSuccessCount(Number(response.createdCount));
		} catch {
			// The typed mutation state supplies the visible API error.
		}
	}

	return (
		<main className="mx-auto flex w-full max-w-3xl flex-col gap-7 px-4 py-6 sm:px-6 sm:py-10">
			<Button asChild className="w-fit" variant="outline">
				<Link href="/me/progress">
					<ArrowLeft aria-hidden />
					{copy.backToProgress}
				</Link>
			</Button>
			<PageHeading description={copy.importDescription} title={copy.importHistory} />
			<Card appearance="outlined">
				<CardContent className="grid gap-6 p-5 sm:p-6">
					<div className="grid gap-2">
						<h2 className="font-heading text-lg font-bold">{copy.importFormat}</h2>
						<p className="text-muted-foreground text-sm">
							{copy.importFormatDescription}
						</p>
						<code className="overflow-x-auto rounded-lg bg-muted px-3 py-2 text-xs">
							{ProgressImportHeader}
						</code>
						<p className="text-muted-foreground text-xs">
							{copy.importFormatRules({ format: verbatimTerms.csv.value })}
						</p>
					</div>
					<form className="grid gap-6" onSubmit={(event) => void submit(event)}>
						<FieldGroup>
							<Field required>
								<FieldLabel htmlFor="progress-import-provider">
									{copy.sourceProvider}
								</FieldLabel>
								<Input
									id="progress-import-provider"
									maxLength={100}
									onChange={(event) =>
										setSourceProvider(event.currentTarget.value)
									}
									placeholder={copy.sourceProviderPlaceholder}
									required
									value={sourceProvider}
								/>
								<FieldDescription>
									{copy.importProviderDescription}
								</FieldDescription>
							</Field>
							<Field required>
								<FieldLabel htmlFor="progress-import-file">
									{copy.importFile}
								</FieldLabel>
								<Input
									accept=".csv,text/csv"
									id="progress-import-file"
									onChange={(event) =>
										void selectFile(event.currentTarget.files?.[0])
									}
									required
									type="file"
								/>
							</Field>
						</FieldGroup>
						{result?.kind === "failure" ? (
							<p className="text-destructive text-sm" role="alert">
								{copy.importInvalidLine({ line: result.line })}
							</p>
						) : result?.kind === "success" ? (
							<p className="rounded-lg bg-muted px-4 py-3 text-sm">
								{copy.importReady({ count: result.items.length })}
							</p>
						) : null}
						{successCount === undefined ? null : (
							<p className="rounded-lg bg-primary/8 px-4 py-3 text-sm" role="status">
								{copy.importComplete({ count: successCount })}
							</p>
						)}
						<RequestFailure error={importProgress.error} fallback={t.ui.retryLater} />
						<Button
							className="w-fit"
							disabled={!sourceProvider.trim() || result?.kind !== "success"}
							isLoading={importProgress.isPending}
							type="submit"
							variant="solid"
						>
							<FileUp aria-hidden />
							{copy.importHistory}
						</Button>
					</form>
				</CardContent>
			</Card>
		</main>
	);
}
