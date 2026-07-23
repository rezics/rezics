import { notFound } from "next/navigation";

import { TagStructureDetailPage } from "@/features/tags/pages/tag-structure-detail-page";
import { isUnitId } from "@/features/units/model/unit-id";

export default async function Page({
	params,
}: {
	readonly params: Promise<{ structure: string }>;
}) {
	const { structure } = await params;
	if (!isUnitId(structure)) notFound();
	return <TagStructureDetailPage structureId={structure} />;
}
