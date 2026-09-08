import { notFound } from "next/navigation";
import { CatalogReferenceSchema } from "@rezics/reference";
import { UnitCollectionsPage } from "@/features/units/pages/unit-collections-page";
export default async function Page({ params }: { params: Promise<{ owner: string; id: string }> }) {
	const reference = CatalogReferenceSchema.safeParse(await params);
	if (!reference.success) notFound();
	return <UnitCollectionsPage reference={reference.data} />;
}
