import { notFound } from "next/navigation";
import { CatalogReferenceSchema } from "@rezics/reference";
import { UnitProgressPage } from "@/features/progress/pages/unit-progress-page";
import { isProgressTrackableUnitType } from "@/features/progress/model/progress-record";
export default async function Page({ params }: { params: Promise<{ owner: string; id: string }> }) {
	const reference = CatalogReferenceSchema.safeParse(await params);
	if (!reference.success || !isProgressTrackableUnitType(reference.data.owner)) notFound();
	return <UnitProgressPage type={reference.data.owner} unitId={reference.data.id} />;
}
