import { ChapterHistoryPage } from "@/features/history/pages/chapter-history-page";

export default async function Page({
	params,
}: {
	params: Promise<{ unit: string; chapterId: string }>;
}) {
	const { unit, chapterId } = await params;
	return <ChapterHistoryPage bookId={unit} chapterId={chapterId} />;
}
