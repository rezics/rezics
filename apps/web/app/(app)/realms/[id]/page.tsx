import { RealmDetailPage } from "@/features/realms/realm-pages";
import { getPublicSlugHrefByUnitId, isUuid } from "@/features/slugs/resolve-public-slug.server";
import { notFound, permanentRedirect } from "next/navigation";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;
	if (!isUuid(id)) notFound();
	const canonicalHref = await getPublicSlugHrefByUnitId("realm", id);
	if (canonicalHref) permanentRedirect(canonicalHref);
	return <RealmDetailPage id={id} />;
}
