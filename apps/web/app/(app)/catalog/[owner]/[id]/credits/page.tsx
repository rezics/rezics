import { notFound } from "next/navigation";
import { CatalogReferenceSchema } from "@rezics/reference";
import { UnitCreditsPage } from "@/features/units/pages/unit-credits-page";
export default async function Page({ params }: { params: Promise<{ owner: string; id: string }> }) {
	const reference = CatalogReferenceSchema.safeParse(await params);
	if (!reference.success) notFound();
	return <UnitCreditsPage type={reference.data.owner} unitId={reference.data.id} />;
}
