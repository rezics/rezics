import { redirect } from "next/navigation";

export default async function Page({
	params,
}: {
	params: Promise<{ unit: string; chapterId: string }>;
}) {
	const { chapterId } = await params;
	redirect(`/posts/${chapterId}/edit`);
}
