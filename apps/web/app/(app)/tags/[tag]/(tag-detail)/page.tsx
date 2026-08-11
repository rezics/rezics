import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { UnitLandingStructuredData } from "@/features/seo/components/unit-landing-structured-data";
import { getUnitLandingSeoDocument } from "@/features/seo/data/unit-landing-seo.server";
import { TagOverviewPage } from "@/features/tags/pages/tag-overview-page";
import { isUnitId } from "@/features/units/model/unit-id";

export async function generateMetadata({
	params,
}: {
	params: Promise<{ tag: string }>;
}): Promise<Metadata> {
	const { tag } = await params;
	if (!isUnitId(tag)) notFound();
	return (
		await getUnitLandingSeoDocument({
			unitId: tag,
			expectedKind: "tag",
			canonicalPath: `/tags/${tag}`,
		})
	).metadata;
}

export default async function Page({ params }: { params: Promise<{ tag: string }> }) {
	const { tag } = await params;
	if (!isUnitId(tag)) notFound();
	return (
		<>
			<UnitLandingStructuredData
				canonicalPath={`/tags/${tag}`}
				expectedKind="tag"
				unitId={tag}
			/>
			<TagOverviewPage />
		</>
	);
}
