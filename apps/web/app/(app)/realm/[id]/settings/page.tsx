import { notFound, permanentRedirect } from "next/navigation";

import { RealmSettingsPage } from "@/features/realms/realm-settings";
import { getPublicSlugHrefByUnitId, isUuid } from "@/features/slugs/resolve-public-slug.server";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;
	if (!isUuid(id)) notFound();
	const slugHref = await getPublicSlugHrefByUnitId("realm", id);
	if (slugHref) permanentRedirect(`${slugHref}/settings`);
	return <RealmSettingsPage id={id} />;
}
