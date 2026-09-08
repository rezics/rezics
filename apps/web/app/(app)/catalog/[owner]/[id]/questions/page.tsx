import { notFound } from "next/navigation";
import { CatalogReferenceSchema } from "@rezics/reference";
import { UnitQuestionsPage } from "@/features/units/pages/unit-questions-page";
export default async function Page({ params }: { params: Promise<{ owner: string; id: string }> }) {
	const reference = CatalogReferenceSchema.safeParse(await params);
	if (!reference.success) notFound();
	return <UnitQuestionsPage type={reference.data.owner} unitId={reference.data.id} />;
}
