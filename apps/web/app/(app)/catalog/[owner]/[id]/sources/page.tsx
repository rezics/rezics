import { CatalogReferenceSchema } from "@rezics/reference";
import { notFound } from "next/navigation";
import { CatalogSourcesPage } from "@/features/catalog-sources/pages/catalog-sources-page";
export default async function Page({ params }: { params: Promise<{ owner: string; id: string }> }) {
	const reference = CatalogReferenceSchema.safeParse(await params);
	if (!reference.success) notFound();
	return <CatalogSourcesPage reference={reference.data} />;
}
