import { Reader } from "@/features/units/reader";
export default async function Page({
	params,
}: {
	params: Promise<{ unit: string; chapterId: string }>;
}) {
	const value = await params;
	return <Reader bookId={value.unit} chapterId={value.chapterId} />;
}
