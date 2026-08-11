import type { Metadata } from "next";

import { PostDetailPage } from "@/features/posts/pages/post-detail-page";
import { UnitLandingStructuredData } from "@/features/seo/components/unit-landing-structured-data";
import { getUnitLandingSeoDocument } from "@/features/seo/data/unit-landing-seo.server";
import { postDetailSearchParams } from "@/lib/search-params.server";

export async function generateMetadata({
	params,
}: {
	params: Promise<{ id: string }>;
}): Promise<Metadata> {
	const { id } = await params;
	return (
		await getUnitLandingSeoDocument({
			unitId: id,
			expectedKind: "post",
			canonicalPath: `/posts/${id}`,
		})
	).metadata;
}

export default async function Page({
	params,
	searchParams,
}: {
	params: Promise<{ id: string }>;
	searchParams: Promise<{ realmId?: string | string[]; from?: string | string[] }>;
}) {
	const [{ id }, { from, realmId }] = await Promise.all([
		params,
		postDetailSearchParams.parse(searchParams),
	]);
	return (
		<>
			<UnitLandingStructuredData
				canonicalPath={`/posts/${id}`}
				expectedKind="post"
				unitId={id}
			/>
			<PostDetailPage
				context={realmId ? { kind: "realm", realmId } : undefined}
				id={id}
				returnToDiscussion={from === "discussion"}
			/>
		</>
	);
}
