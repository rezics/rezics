import { CatalogReferenceSchema } from "@rezics/reference";
import { notFound } from "next/navigation";
import { CatalogResourcePage } from "@/features/catalog/catalog-resource-page";

export default async function Page({ params }: { params: Promise<{ owner: string; id: string }> }) {
	const reference = CatalogReferenceSchema.safeParse(await params);
	if (!reference.success) notFound();
	return <CatalogResourcePage reference={reference.data} />;
}
