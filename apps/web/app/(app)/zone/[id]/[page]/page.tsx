import { notFound, permanentRedirect } from "next/navigation";

import { getPublicSlugHrefByUnitId, isUuid } from "@/features/slugs/resolve-public-slug.server";
import { ZonePage } from "@/features/zones/zone-page";

export default async function Page({ params }: { params: Promise<{ id: string; page: string }> }) {
	const { id, page } = await params;
	if (!isUuid(id)) notFound();
	const slugHref = await getPublicSlugHrefByUnitId("zone", id);
	if (slugHref) permanentRedirect(`${slugHref}/${page}`);
	return <ZonePage baseHref={`/zone/${id}`} id={id} page={page} />;
}
