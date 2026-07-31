import { notFound, permanentRedirect } from "next/navigation";

import { RealmContentCreatePage } from "@/features/realms/pages/realm-content-create-page";
import { getPublicSlugHrefByUnitId, isUuid } from "@/features/slugs/resolve-public-slug.server";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;
	if (!isUuid(id)) notFound();
	const slugHref = await getPublicSlugHrefByUnitId("realm", id);
	if (slugHref) permanentRedirect(`${slugHref}/new`);
	return <RealmContentCreatePage realmId={id} />;
}
