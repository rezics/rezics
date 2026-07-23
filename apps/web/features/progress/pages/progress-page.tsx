"use client";

import { useDeleteApiProgressByUnitId, useGetApiProgress } from "@rezics/openapi-tanstack-query";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";

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
	Badge,
	Button,
	Card,
	CardAction,
	CardContent,
	CardHeader,
	PageHeading,
	QueryFailure,
	QueryPending,
} from "@rezics/ui";
import { RequireSession } from "@/features/auth/require-session";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { toFiniteApiNumber, toNonNegativeApiInteger } from "@/lib/api-number";
import { invalidateProgressQueries } from "../data/progress-cache";
import { toProgressStatus } from "../model/progress-record";

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
	const { t } = useTranslation(["engagement", "ui"]);
	if (query.isPending) return <QueryPending />;
	if (query.isError)
		return <QueryFailure error={query.error} retry={() => void query.refetch()} />;

	async function removeProgress(unitId: string) {
		try {
			await remove.mutateAsync({ path: { unitId } });
			await invalidateProgressQueries(queryClient, unitId);
		} catch {
			// The typed mutation state supplies the visible API error.
		}
	}

	return (
		<main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-10 sm:px-6">
			<PageHeading title={t.engagement.progress} />
			{query.data?.items.length ? (
				<div className="grid gap-3">
					{query.data.items.map((item) => {
						const type =
							item.type === "book" ||
							item.type === "media" ||
							item.type === "software"
								? item.type
								: undefined;
						return (
							<Card key={item.unitId}>
								<CardHeader
									description={
										type === "software"
											? t.engagement.progressByType.software.listSummary({
													count: toNonNegativeApiInteger(
														item.completedCount,
													),
													minutes: Math.round(
														(toFiniteApiNumber(item.totalTimeMs) ?? 0) /
															60_000,
													),
												})
											: type === "media"
												? t.engagement.progressByType.media.listSummary({
														count: toNonNegativeApiInteger(
															item.completedCount,
														),
														percent: Math.round(item.progress * 100),
													})
												: type === "book"
													? t.engagement.progressByType.book.listSummary({
															percent: Math.round(
																item.progress * 100,
															),
														})
													: `${Math.round(item.progress * 100)}%`
									}
									title={item.title ?? t.ui.unnamed}
								>
									<CardAction>
										<div className="flex gap-2">
											{type ? (
												<Button asChild size="sm" variant="outline">
													<Link href={`/units/${type}/${item.unitId}`}>
														{t.engagement.select}
													</Link>
												</Button>
											) : null}
											<AlertDialog>
												<AlertDialogTrigger asChild>
													<Button size="sm" variant="quiet">
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
															onClick={() =>
																void removeProgress(item.unitId)
															}
															variant="destructive"
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
										{type
											? t.engagement.progressByType[type].statuses[
													toProgressStatus(item.status)
												]
											: item.status}
									</Badge>
								</CardContent>
							</Card>
						);
					})}
				</div>
			) : (
				<p className="text-sm text-muted-foreground">{t.ui.emptyProgress}</p>
			)}
			<RequestFailure error={remove.error} fallback={t.ui.retryLater} />
		</main>
	);
}
