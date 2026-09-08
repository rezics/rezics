import { notFound } from "next/navigation";
import { CatalogReferenceSchema } from "@rezics/reference";
import { CatalogEditorialEditPage } from "@/features/catalog/components/catalog-editorial";
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
	const reference = CatalogReferenceSchema.safeParse({ owner: "entity", id: (await params).id });
	if (!reference.success) notFound();
	return <CatalogEditorialEditPage reference={reference.data} />;
}
