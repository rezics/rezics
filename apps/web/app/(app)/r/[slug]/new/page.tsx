import { notFound, redirect } from "next/navigation";

import { RealmContentCreatePage } from "@/features/realms/pages/realm-content-create-page";
import { resolvePublicSlug } from "@/features/slugs/resolve-public-slug.server";

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
	const { slug } = await params;
	const resolved = await resolvePublicSlug("realm", slug);
	if (!resolved) notFound();
	if (resolved.redirected || resolved.canonicalHref !== `/r/${slug}`)
		redirect(`${resolved.canonicalHref}/new`);
	return <RealmContentCreatePage realmId={resolved.id} />;
}
