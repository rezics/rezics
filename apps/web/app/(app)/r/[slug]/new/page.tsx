import { notFound, redirect } from "next/navigation";

import { RealmContentCreatePage } from "@/features/realms/pages/realm-content-create-page";
import {
	loadRealmContentCreateRoute,
	realmContentCreateSearch,
} from "@/features/realms/routing/realm-content-create-route";
import { resolvePublicSlug } from "@/features/slugs/resolve-public-slug.server";

export default async function Page({
	params,
	searchParams,
}: {
	params: Promise<{ slug: string }>;
	searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
	const { slug } = await params;
	const resolved = await resolvePublicSlug("realm", slug);
	if (!resolved) notFound();
	if (resolved.redirected || resolved.canonicalHref !== `/r/${slug}`) {
		const { mode } = await loadRealmContentCreateRoute(searchParams);
		redirect(`${resolved.canonicalHref}/new${realmContentCreateSearch(mode)}`);
	}
	return <RealmContentCreatePage realmId={resolved.id} />;
}
