"use client";

import {
	useDeleteApiProgressByUnitId,
	useGetApiProgress,
	type GetApiProgressStatus200,
} from "@rezics/openapi-tanstack-query";
import { useQueryClient } from "@tanstack/react-query";
import { Import } from "lucide-react";
import { AppLink as Link } from "@/features/application-shell/components/app-link";

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
import { useChineseContentText } from "@/features/content-language-display/chinese-content-display-context";
import { useTranslation } from "@/i18n/client";
import { useLocalizationLanguages } from "@/i18n/use-localization-languages";
import { RequestFailure } from "@/i18n/request-failure";
import { toFiniteApiNumber, toNonNegativeApiInteger } from "@/lib/api-number";
import { invalidateProgressQueries } from "../data/progress-cache";
import { toProgressStatus } from "../model/progress-record";
import { unitProgressHref } from "../routing/progress-routes";

export function ProgressPage() {
	return (
		<RequireSession>
			<ProgressList />
		</RequireSession>
	);
}

function ProgressList() {
	const localizationLanguages = useLocalizationLanguages();
	const query = useGetApiProgress({
		query: { limit: 100, localizationLanguages },
	});
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
			<PageHeading
				action={
					<Button asChild variant="outline">
						<Link href="/me/progress/import">
							<Import aria-hidden />
							{t.engagement.progressJournal.importHistory}
						</Link>
					</Button>
				}
				title={t.engagement.progress}
			/>
			{query.data?.items.length ? (
				<div className="grid gap-3">
					{query.data.items.map((item) => (
						<ProgressListItem
							isRemoving={remove.isPending}
							item={item}
							key={item.unitId}
							onRemove={removeProgress}
						/>
					))}
				</div>
			) : (
				<p className="text-sm text-muted-foreground">{t.ui.emptyProgress}</p>
			)}
			<RequestFailure error={remove.error} fallback={t.ui.retryLater} />
		</main>
	);
}

function ProgressListItem({
	isRemoving,
	item,
	onRemove,
}: {
	readonly isRemoving: boolean;
	readonly item: GetApiProgressStatus200["items"][number];
	readonly onRemove: (unitId: string) => Promise<void>;
}) {
	const { t } = useTranslation(["engagement", "ui"]);
	const title = useChineseContentText(
		item.title ?? t.ui.unnamed,
		item.title ? item.language : null,
	);
	const type =
		item.type === "book" || item.type === "media" || item.type === "software"
			? item.type
			: undefined;

	return (
		<Card>
			<CardHeader
				description={
					type === "software"
						? t.engagement.progressByType.software.listSummary({
								count: toNonNegativeApiInteger(item.completedCount),
								minutes: Math.round(
									(toFiniteApiNumber(item.totalTimeMs) ?? 0) / 60_000,
								),
							})
						: type === "media"
							? t.engagement.progressByType.media.listSummary({
									count: toNonNegativeApiInteger(item.completedCount),
									percent: Math.round(item.progress * 100),
								})
							: type === "book"
								? t.engagement.progressByType.book.listSummary({
										count: toNonNegativeApiInteger(item.completedCount),
										percent: Math.round(item.progress * 100),
									})
								: `${Math.round(item.progress * 100)}%`
				}
				title={title}
			>
				<CardAction>
					<div className="flex gap-2">
						{type ? (
							<Button asChild size="sm" variant="outline">
								<Link href={unitProgressHref(type, item.unitId)}>
									{t.engagement.viewProgressHistory}
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
									<AlertDialogCancel>{t.engagement.cancel}</AlertDialogCancel>
									<AlertDialogAction
										isLoading={isRemoving}
										onClick={() => void onRemove(item.unitId)}
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
				<div className="flex flex-wrap gap-2">
					<Badge variant="secondary">
						{type
							? t.engagement.progressByType[type].statuses[
									toProgressStatus(item.status)
								]
							: item.status}
					</Badge>
					<Badge variant="secondary">{t.ui[item.visibility]}</Badge>
				</div>
			</CardContent>
		</Card>
	);
}
