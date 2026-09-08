import { notFound } from "next/navigation";
import { CatalogReferenceSchema } from "@rezics/reference";
import { UnitTagsPage } from "@/features/tags/pages/unit-tags-page";
import { loadUnitTagsRouteState } from "@/features/tags/routing/tag-links";
export default async function Page({
	params,
	searchParams,
}: {
	params: Promise<{ owner: string; id: string }>;
	searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
	const reference = CatalogReferenceSchema.safeParse(await params);
	if (!reference.success) notFound();
	return (
		<UnitTagsPage
			type={reference.data.owner}
			unitId={reference.data.id}
			routeState={await loadUnitTagsRouteState(searchParams)}
		/>
	);
}
