import { notFound, permanentRedirect } from "next/navigation";

import { RealmDetailPage } from "@/features/realms/realm-pages";
import { getPublicSlugHrefByUnitId, isUuid } from "@/features/slugs/resolve-public-slug.server";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;
	if (!isUuid(id)) notFound();
	const slugHref = await getPublicSlugHrefByUnitId("realm", id);
	if (slugHref) permanentRedirect(`${slugHref}/wiki`);
	return <RealmDetailPage id={id} page="wiki" />;
}
