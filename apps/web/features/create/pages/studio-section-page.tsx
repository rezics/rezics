"use client";

import { useListCurrentUserStudioContent } from "@rezics/openapi-tanstack-query";
import {
	Button,
	Card,
	CardContent,
	ManagementWorkspaceSectionHeader,
	QueryFailure,
	QueryPending,
} from "@rezics/ui";
import { Plus } from "lucide-react";
import Link from "next/link";

import { PreviewCapabilityBoundary } from "@/features/development/components/preview-capability-boundary";
import { useTranslation } from "@/i18n/client";
import {
	StudioSectionCreateHrefs,
	studioContentHref,
	type StudioSectionId,
} from "../model/studio-section";
import { StudioOverviewHref } from "../routing/studio-routes";

function StudioSectionContent({ sectionId }: { readonly sectionId: StudioSectionId }) {
	const { t } = useTranslation(["create"]);
	const query = useListCurrentUserStudioContent({ query: { section: sectionId } });
	const section = t.create.sections[sectionId];

	if (query.isPending) return <QueryPending />;
	if (query.isError || !query.data)
		return <QueryFailure error={query.error} retry={() => void query.refetch()} />;

	return (
		<section>
			<ManagementWorkspaceSectionHeader
				action={
					<Button asChild variant="solid">
						<Link href={StudioSectionCreateHrefs[sectionId]}>
							<Plus aria-hidden className="size-4" />
							{t.create.list.create}
						</Link>
					</Button>
				}
				backHref={StudioOverviewHref}
				backLabel={t.create.workspace.backToOverview}
				description={section.description}
				link={Link}
				title={section.label}
			/>
			{query.data.items.length === 0 ? (
				<Card appearance="outlined">
					<CardContent className="p-6 text-sm text-muted-foreground">
						{t.create.list.empty}
					</CardContent>
				</Card>
			) : (
				<ul className="grid gap-3">
					{query.data.items.map((item) => (
						<li key={item.id}>
							<Card
								appearance="outlined"
								className="transition-colors hover:border-border"
							>
								<CardContent className="p-0">
									<Link
										className="block rounded-[inherit] p-5 font-medium outline-none focus-visible:ring-[3px] focus-visible:ring-ring/32"
										href={studioContentHref(sectionId, item.id)}
									>
										{item.title ?? t.create.list.untitled}
									</Link>
								</CardContent>
							</Card>
						</li>
					))}
				</ul>
			)}
		</section>
	);
}

export function StudioSectionPage({ sectionId }: { readonly sectionId: StudioSectionId }) {
	if (sectionId === "realm")
		return (
			<PreviewCapabilityBoundary capability="unit.realm.preview">
				<StudioSectionContent sectionId={sectionId} />
			</PreviewCapabilityBoundary>
		);
	return <StudioSectionContent sectionId={sectionId} />;
}
