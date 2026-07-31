import { notFound, permanentRedirect } from "next/navigation";

import { RealmContentCreatePage } from "@/features/realms/pages/realm-content-create-page";
import {
	loadRealmContentCreateRoute,
	realmContentCreateSearch,
} from "@/features/realms/routing/realm-content-create-route";
import { getPublicSlugHrefByUnitId, isUuid } from "@/features/slugs/resolve-public-slug.server";

export default async function Page({
	params,
	searchParams,
}: {
	params: Promise<{ id: string }>;
	searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
	const { id } = await params;
	if (!isUuid(id)) notFound();
	const slugHref = await getPublicSlugHrefByUnitId("realm", id);
	if (slugHref) {
		const { mode } = await loadRealmContentCreateRoute(searchParams);
		permanentRedirect(`${slugHref}/new${realmContentCreateSearch(mode)}`);
	}
	return <RealmContentCreatePage realmId={id} />;
}
