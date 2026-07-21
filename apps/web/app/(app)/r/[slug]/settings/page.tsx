import { notFound, permanentRedirect } from "next/navigation";

import { RealmSettingsPage } from "@/features/realms/realm-settings";
import { resolvePublicSlug } from "@/features/slugs/resolve-public-slug.server";

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
	const { slug } = await params;
	const resolved = await resolvePublicSlug("realm", slug);
	if (!resolved) notFound();
	if (resolved.redirected || resolved.canonicalHref !== `/r/${slug}`)
		permanentRedirect(`${resolved.canonicalHref}/settings`);
	return <RealmSettingsPage id={resolved.id} />;
}
