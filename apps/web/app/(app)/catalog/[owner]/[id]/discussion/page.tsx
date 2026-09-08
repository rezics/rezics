import { notFound } from "next/navigation";
import { CatalogReferenceSchema } from "@rezics/reference";
import { CatalogDiscussionPage } from "@/features/catalog/catalog-discussion-page";
export default async function Page({ params }: { params: Promise<{ owner: string; id: string }> }) {
	const reference = CatalogReferenceSchema.safeParse(await params);
	if (!reference.success) notFound();
	return <CatalogDiscussionPage reference={reference.data} />;
}
