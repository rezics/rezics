import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { isUuid } from "@/features/slugs/resolve-public-slug.server";
import { DevelopmentPreviewBoundary } from "@/features/preview-access/components/development-preview-boundary";
import { ZoneManagementWorkspace } from "@/features/zones/management/workspace";

export default async function Layout({
	children,
	params,
}: {
	children: ReactNode;
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;
	if (!isUuid(id)) notFound();
	return (
		<DevelopmentPreviewBoundary>
			<ZoneManagementWorkspace zoneId={id}>{children}</ZoneManagementWorkspace>
		</DevelopmentPreviewBoundary>
	);
}
