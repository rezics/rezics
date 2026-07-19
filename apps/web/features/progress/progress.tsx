"use client";

import {
	getApiProgressByUnitIdQueryKey,
	getApiProgressQueryKey,
	useDeleteApiProgressByUnitId,
	useGetApiProgress,
	useGetApiProgressByUnitId,
	usePutApiProgressByUnitId,
} from "@rezics/openapi-tanstack-query";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";

import { PageHeading } from "@rezics/ui";
import { QueryFailure, QueryPending } from "@rezics/ui";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogBody,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@rezics/ui";
import { Badge } from "@rezics/ui";
import { Button } from "@rezics/ui";
import { Card, CardAction, CardContent, CardHeader } from "@rezics/ui";
import { Field, FieldGroup, FieldLabel } from "@rezics/ui";
import { Input } from "@rezics/ui";
import { NativeSelect, NativeSelectOption } from "@rezics/ui";
import { SignInButton } from "@/features/auth/auth-portal";
import { RequireSession } from "@/features/auth/require-session";
import { useTranslation } from "@/i18n/client";
import { hasErrorCode } from "@/i18n/errors";
import { RequestFailure } from "@/i18n/request-failure";
import { useHydratedSession } from "@/lib/use-hydrated-session";

const ProgressStatuses = ["backlog", "active", "paused", "completed", "dropped"] as const;
type ProgressStatus = (typeof ProgressStatuses)[number];

function getProgressHref(type: string, unitId: string) {
	const normalized = type.toLowerCase();
	return ["book", "software", "media"].includes(normalized)
		? `/units/${normalized}/${unitId}`
		: undefined;
}

async function invalidateProgress(queryClient: ReturnType<typeof useQueryClient>, unitId?: string) {
	await Promise.all([
		queryClient.invalidateQueries({ queryKey: getApiProgressQueryKey() }),
		...(unitId
			? [
					queryClient.invalidateQueries({
						queryKey: getApiProgressByUnitIdQueryKey({ path: { unitId } }),
					}),
				]
			: []),
	]);
}

export function ProgressPage() {
	return (
		<RequireSession>
			<ProgressList />
		</RequireSession>
	);
}

function ProgressList() {
	const query = useGetApiProgress({ query: { limit: 100 } });
	const remove = useDeleteApiProgressByUnitId();
	const queryClient = useQueryClient();
	const { t } = useTranslation({ suspense: true });
	async function removeProgress(unitId: string) {
		try {
			await remove.mutateAsync({ path: { unitId } });
			await invalidateProgress(queryClient, unitId);
		} catch {
			// The typed mutation state supplies the visible API error.
		}
	}
	if (query.isPending) return <QueryPending />;
	if (query.isError)
		return <QueryFailure error={query.error} retry={() => void query.refetch()} />;
	return (
		<main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-10 sm:px-6">
			<PageHeading title={t.engagement.progress} />
			{query.data?.items.length ? (
				<div className="grid gap-3">
					{query.data.items.map((item) => {
						const href = getProgressHref(item.type, item.unitId);
						return (
							<Card key={item.unitId}>
								<CardHeader
									description={`${Math.round(item.progress * 100)}%`}
									title={item.title ?? t.ui.unnamed}
								>
									<CardAction>
										<div className="flex gap-2">
											{href && (
												<Button asChild size="sm" variant="outline">
													<Link href={href}>{t.engagement.select}</Link>
												</Button>
											)}
											<AlertDialog>
												<AlertDialogTrigger asChild>
													<Button size="sm" variant="ghost">
														{t.engagement.removeProgress}
													</Button>
												</AlertDialogTrigger>
												<AlertDialogContent>
													<AlertDialogHeader>
														<AlertDialogTitle>
															{t.engagement.removeProgress}
														</AlertDialogTitle>
													</AlertDialogHeader>
													<AlertDialogBody>
														<AlertDialogDescription>
															{t.engagement.removeProgressPrompt}
														</AlertDialogDescription>
													</AlertDialogBody>
													<AlertDialogFooter>
														<AlertDialogCancel>
															{t.engagement.cancel}
														</AlertDialogCancel>
														<AlertDialogAction
															isLoading={remove.isPending}
															variant="destructive"
															onClick={() =>
																void removeProgress(item.unitId)
															}
														>
															{t.engagement.delete}
														</AlertDialogAction>
													</AlertDialogFooter>
												</AlertDialogContent>
											</AlertDialog>
										</div>
									</CardAction>
								</CardHeader>
								<CardContent>
									<Badge variant="secondary">
										{getProgressStatusLabel(t, item.status)}
									</Badge>
								</CardContent>
							</Card>
						);
					})}
				</div>
			) : (
				<p className="text-muted-foreground text-sm">{t.ui.emptyProgress}</p>
			)}
			<RequestFailure error={remove.error} fallback={t.ui.retryLater} />
		</main>
	);
}

export function ProgressRecordForm({ unitId }: { unitId: string }) {
	const { data: session } = useHydratedSession();
	const record = useGetApiProgressByUnitId(
		{ path: { unitId } },
		{ query: { enabled: Boolean(session) } },
	);
	const save = usePutApiProgressByUnitId();
	const queryClient = useQueryClient();
	const { t } = useTranslation({ suspense: true });
	const [status, setStatus] = useState<ProgressStatus>("active");
	const [percentage, setPercentage] = useState("0");
	const recordMissing = record.isError && hasErrorCode(record.error, "ProgressNotFound");
	useEffect(() => {
		if (!record.data) return;
		setStatus(toProgressStatus(record.data.status));
		setPercentage(String(Math.round(record.data.progress * 100)));
	}, [record.data]);
	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const normalized = Number(percentage);
		if (!Number.isFinite(normalized) || normalized < 0 || normalized > 100) return;
		try {
			await save.mutateAsync({
				path: { unitId },
				body: { status, progress: normalized / 100 },
			});
			await invalidateProgress(queryClient, unitId);
		} catch {
			// The typed mutation state supplies the visible API error.
		}
	}
	if (!session) return <SignInButton variant="outline">{t.actions.login}</SignInButton>;
	const available = !record.isPending && (!record.isError || recordMissing);
	return (
		<Card>
			<CardHeader title={t.engagement.progress} />
			<CardContent>
				<form className="flex flex-col gap-4" onSubmit={(event) => void submit(event)}>
					<FieldGroup>
						<Field>
							<FieldLabel>{t.engagement.progressStatus}</FieldLabel>
							<NativeSelect
								name="status"
								onChange={(event) =>
									setStatus(toProgressStatus(event.currentTarget.value))
								}
								value={status}
							>
								<NativeSelectOption value="backlog">
									{t.engagement.backlog}
								</NativeSelectOption>
								<NativeSelectOption value="active">
									{t.engagement.active}
								</NativeSelectOption>
								<NativeSelectOption value="paused">
									{t.engagement.paused}
								</NativeSelectOption>
								<NativeSelectOption value="completed">
									{t.engagement.completed}
								</NativeSelectOption>
								<NativeSelectOption value="dropped">
									{t.engagement.dropped}
								</NativeSelectOption>
							</NativeSelect>
						</Field>
						<Field>
							<FieldLabel>{t.engagement.progressPercent}</FieldLabel>
							<Input
								max={100}
								min={0}
								onChange={(event) => setPercentage(event.currentTarget.value)}
								type="number"
								value={percentage}
							/>
						</Field>
					</FieldGroup>
					{record.isPending && (
						<p className="text-muted-foreground text-sm">{t.state.loading}</p>
					)}
					{record.isError && !recordMissing && (
						<RequestFailure error={record.error} fallback={t.ui.retryLater} />
					)}
					<RequestFailure error={save.error} fallback={t.ui.retryLater} />
					<Button disabled={!available} isLoading={save.isPending} type="submit">
						{t.engagement.updateProgress}
					</Button>
				</form>
			</CardContent>
		</Card>
	);
}

function toProgressStatus(status: string): ProgressStatus {
	return ProgressStatuses.find((candidate) => candidate === status) ?? "active";
}

function getProgressStatusLabel(t: ReturnType<typeof useTranslation>["t"], status: string) {
	switch (status) {
		case "backlog":
			return t.engagement.backlog;
		case "active":
			return t.engagement.active;
		case "paused":
			return t.engagement.paused;
		case "completed":
			return t.engagement.completed;
		case "dropped":
			return t.engagement.dropped;
		default:
			return status;
	}
}
