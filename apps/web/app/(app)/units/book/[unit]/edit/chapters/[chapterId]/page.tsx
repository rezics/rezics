import { ChapterLocalizationEdit } from "@/features/units/reader";

export default async function Page({
	params,
}: {
	params: Promise<{ unit: string; chapterId: string }>;
}) {
	const { unit, chapterId } = await params;
	return <ChapterLocalizationEdit bookId={unit} chapterId={chapterId} />;
}
