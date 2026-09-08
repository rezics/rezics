import { CatalogReferenceSchema } from "@rezics/reference";
import { notFound } from "next/navigation";
import { MusicPage } from "@/features/music/pages/music-page";
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
	const reference = CatalogReferenceSchema.safeParse({ owner: "music", ...(await params) });
	if (!reference.success) notFound();
	return <MusicPage id={reference.data.id} />;
}
