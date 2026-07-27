import { notFound, permanentRedirect } from "next/navigation";

import { parseRealmSettingsPath } from "@/features/realms/model/realm-settings-section";
import { RealmSettingsWorkspacePage } from "@/features/realms/realm-settings-workspace";
import { getPublicSlugHrefByUnitId, isUuid } from "@/features/slugs/resolve-public-slug.server";

export default async function Page({
	params,
	searchParams,
}: {
	params: Promise<{ id: string; section?: string[] }>;
	searchParams: Promise<{ from?: string; to?: string }>;
}) {
	const [{ id, section }, query] = await Promise.all([params, searchParams]);
	if (!isUuid(id)) notFound();
	const route = parseRealmSettingsPath(section);
	if (!route) notFound();
	const suffix = section?.length ? `/${section.join("/")}` : "";
	const revisionQuery = new URLSearchParams();
	if (route.comparison && query.from) revisionQuery.set("from", query.from);
	if (route.comparison && query.to) revisionQuery.set("to", query.to);
	const querySuffix = revisionQuery.size ? `?${revisionQuery.toString()}` : "";
	const slugHref = await getPublicSlugHrefByUnitId("realm", id);
	if (slugHref) permanentRedirect(`${slugHref}/settings${suffix}${querySuffix}`);
	const baseHref = `/realm/${id}/settings`;
	return (
		<RealmSettingsWorkspacePage
			baseHref={baseHref}
			comparison={
				route.comparison ? { from: query.from ?? null, to: query.to ?? null } : undefined
			}
			realmId={id}
			section={route.section}
		/>
	);
}
