import { notFound } from "next/navigation";
import { BookContents } from "@/features/units/components/book-contents";
import { MediaContents } from "@/features/units/components/media-contents";

export default async function Page({ params }: { params: Promise<{ owner: string; id: string }> }) {
	const { owner, id } = await params;
	if (owner !== "publishing" && owner !== "program") notFound();
	return owner === "publishing" ? <BookContents bookId={id} /> : <MediaContents mediaId={id} />;
}
