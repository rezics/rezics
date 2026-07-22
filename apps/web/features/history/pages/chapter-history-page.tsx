"use client";

import { useGetApiUnitsByTypeByUnitId } from "@rezics/openapi-tanstack-query";
import { Button, PageHeading, QueryFailure, QueryPending } from "@rezics/ui";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";

import { RequireSession } from "@/features/auth/require-session";
import {
	chapterEditorHref,
	chapterHistoryHref,
} from "@/features/units/routing/unit-management-routes";
import { invalidateChapter } from "@/features/units/unit-cache";
import { useTranslation } from "@/i18n/client";
import { UnitRevisionCompare } from "../components/unit-revision-compare";
import { UnitRevisionHistory } from "../components/unit-revision-history";

export function ChapterHistoryPage({ bookId, chapterId }: { bookId: string; chapterId: string }) {
	return (
		<RequireSession>
			<ChapterHistoryContent bookId={bookId} chapterId={chapterId} />
		</RequireSession>
	);
}

function ChapterHistoryContent({ bookId, chapterId }: { bookId: string; chapterId: string }) {
	const { t } = useTranslation(["history", "units"]);
	const queryClient = useQueryClient();
	const book = useGetApiUnitsByTypeByUnitId({ path: { type: "book", unitId: bookId } });
	if (book.isPending) return <QueryPending />;
	if (book.isError || !book.data)
		return <QueryFailure error={book.error} retry={() => void book.refetch()} />;
	const historyHref = chapterHistoryHref(bookId, chapterId);
	return (
		<main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-10 sm:px-6">
			<PageHeading
				action={
					<Button asChild variant="outline">
						<Link href={chapterEditorHref(bookId, chapterId)}>
							{t.history.backToEditor}
						</Link>
					</Button>
				}
				description={t.units.chapter.title}
				title={t.history.title}
			/>
			<UnitRevisionHistory
				compareHref={(from, to) =>
					`${historyHref}/compare?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
				}
				onChanged={() => invalidateChapter(queryClient, chapterId)}
				unitId={chapterId}
			/>
		</main>
	);
}

export function ChapterHistoryComparePage({
	bookId,
	chapterId,
	from,
	to,
}: {
	bookId: string;
	chapterId: string;
	from: string | null;
	to: string | null;
}) {
	const { t } = useTranslation(["errors", "history"]);
	return (
		<main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-10 sm:px-6">
			<PageHeading
				action={
					<Button asChild variant="outline">
						<Link href={chapterHistoryHref(bookId, chapterId)}>
							{t.history.backToHistory}
						</Link>
					</Button>
				}
				title={t.history.compareTitle}
			/>
			{from && to ? (
				<UnitRevisionCompare from={from} to={to} unitId={chapterId} />
			) : (
				<p className="text-sm text-destructive">{t.errors.invalid}</p>
			)}
		</main>
	);
}
