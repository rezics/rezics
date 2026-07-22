import { notFound, redirect } from "next/navigation";

import { parseRealmSettingsPath } from "@/features/realms/model/realm-settings-section";
import { RealmSettingsWorkspacePage } from "@/features/realms/realm-settings-workspace";
import { resolvePublicSlug } from "@/features/slugs/resolve-public-slug.server";

export default async function Page({
	params,
	searchParams,
}: {
	params: Promise<{ slug: string; section?: string[] }>;
	searchParams: Promise<{ from?: string; to?: string }>;
}) {
	const [{ slug, section }, query] = await Promise.all([params, searchParams]);
	const route = parseRealmSettingsPath(section);
	if (!route) notFound();
	const resolved = await resolvePublicSlug("realm", slug);
	if (!resolved) notFound();
	const suffix = section?.length ? `/${section.join("/")}` : "";
	const revisionQuery = new URLSearchParams();
	if (route.comparison && query.from) revisionQuery.set("from", query.from);
	if (route.comparison && query.to) revisionQuery.set("to", query.to);
	const querySuffix = revisionQuery.size ? `?${revisionQuery.toString()}` : "";
	if (resolved.redirected || resolved.canonicalHref !== `/r/${slug}`)
		redirect(`${resolved.canonicalHref}/settings${suffix}${querySuffix}`);
	return (
		<RealmSettingsWorkspacePage
			baseHref={`${resolved.canonicalHref}/settings`}
			comparison={
				route.comparison ? { from: query.from ?? null, to: query.to ?? null } : undefined
			}
			realmId={resolved.id}
			section={route.section}
		/>
	);
}
