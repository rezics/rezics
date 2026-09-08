import { CatalogReferenceSchema } from "@rezics/reference";
import { notFound } from "next/navigation";
import { CatalogSemanticsPage } from "@/features/catalog-semantics/pages/catalog-semantics-page";
export default async function Page({ params }: { params: Promise<{ owner: string; id: string }> }) {
	const reference = CatalogReferenceSchema.safeParse(await params);
	if (!reference.success) notFound();
	return <CatalogSemanticsPage reference={reference.data} />;
}
