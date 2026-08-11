import type { Metadata } from "next";

import { PostDetailPage } from "@/features/posts/pages/post-detail-page";
import { UnitLandingStructuredData } from "@/features/seo/components/unit-landing-structured-data";
import {
	getRequestedUnitLandingLanguage,
	type UnitLandingSearchParams,
} from "@/features/seo/data/unit-landing-search-params.server";
import { getUnitLandingSeoDocument } from "@/features/seo/data/unit-landing-seo.server";
import { postDetailSearchParams } from "@/lib/search-params.server";

export async function generateMetadata({
	params,
	searchParams,
}: {
	params: Promise<{ id: string }>;
	searchParams: UnitLandingSearchParams;
}): Promise<Metadata> {
	const [{ id }, requestedLanguage] = await Promise.all([
		params,
		getRequestedUnitLandingLanguage(searchParams),
	]);
	return (
		await getUnitLandingSeoDocument({
			unitId: id,
			expectedKind: "post",
			canonicalPath: `/posts/${id}`,
			requestedLanguage,
		})
	).metadata;
}

export default async function Page({
	params,
	searchParams,
}: {
	params: Promise<{ id: string }>;
	searchParams: Promise<{
		realmId?: string | string[];
		from?: string | string[];
		language?: string | string[];
	}>;
}) {
	const [{ id }, { from, realmId }, requestedLanguage] = await Promise.all([
		params,
		postDetailSearchParams.parse(searchParams),
		getRequestedUnitLandingLanguage(searchParams),
	]);
	return (
		<>
			<UnitLandingStructuredData
				canonicalPath={`/posts/${id}`}
				expectedKind="post"
				unitId={id}
				requestedLanguage={requestedLanguage}
			/>
			<PostDetailPage
				context={realmId ? { kind: "realm", realmId } : undefined}
				id={id}
				returnToDiscussion={from === "discussion"}
			/>
		</>
	);
}
