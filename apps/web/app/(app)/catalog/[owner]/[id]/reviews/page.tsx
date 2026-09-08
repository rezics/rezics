import { notFound } from "next/navigation";
import { CatalogReferenceSchema } from "@rezics/reference";
import { UnitReviewsPage } from "@/features/units/pages/unit-reviews-page";
export default async function Page({ params }: { params: Promise<{ owner: string; id: string }> }) {
	const reference = CatalogReferenceSchema.safeParse(await params);
	if (!reference.success) notFound();
	return <UnitReviewsPage type={reference.data.owner} unitId={reference.data.id} />;
}
