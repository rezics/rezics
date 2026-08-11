import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { UnitLandingStructuredData } from "@/features/seo/components/unit-landing-structured-data";
import { getUnitLandingSeoDocument } from "@/features/seo/data/unit-landing-seo.server";
import { TagStructureDetailPage } from "@/features/tags/pages/tag-structure-detail-page";
import { isUnitId } from "@/features/units/model/unit-id";

export async function generateMetadata({
	params,
}: {
	readonly params: Promise<{ structure: string }>;
}): Promise<Metadata> {
	const { structure } = await params;
	if (!isUnitId(structure)) notFound();
	return (
		await getUnitLandingSeoDocument({
			unitId: structure,
			expectedKind: "structure",
			canonicalPath: `/tag-structures/${structure}`,
		})
	).metadata;
}

export default async function Page({
	params,
}: {
	readonly params: Promise<{ structure: string }>;
}) {
	const { structure } = await params;
	if (!isUnitId(structure)) notFound();
	return (
		<>
			<UnitLandingStructuredData
				canonicalPath={`/tag-structures/${structure}`}
				expectedKind="structure"
				unitId={structure}
			/>
			<TagStructureDetailPage structureId={structure} />
		</>
	);
}
