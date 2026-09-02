"use client";

import { Badge, Button } from "@rezics/ui";
import { Plus } from "lucide-react";

import { AppLink as Link } from "@/features/application-shell/components/app-link";
import { useTranslation } from "@/i18n/client";
import { studioSectionCreateActions, type StudioSectionId } from "../model/studio-section";

export function StudioCreateActions({
	context = "section",
	sectionId,
}: {
	readonly context?: "overview" | "section";
	readonly sectionId: StudioSectionId;
}) {
	const { t } = useTranslation(["create", "tags"]);
	const actions = studioSectionCreateActions(sectionId);
	return (
		<div className="flex flex-wrap gap-2">
			{actions.map((action) => {
				const label =
					action.kind === "tag_path"
						? t.tags.createPath.title
						: sectionId === "tag"
							? t.tags.create.title
							: context === "overview"
								? t.create.overview.createAction({
										subject: t.create.sections[sectionId].label,
									})
								: t.create.list.create;
				return (
					<div className="flex items-center gap-2" key={action.kind}>
						<Button
							asChild
							size={context === "overview" ? "sm" : undefined}
							variant={action.kind === "tag_path" ? "outline" : "solid"}
						>
							<Link href={action.href}>
								<Plus aria-hidden className="size-4" />
								{label}
							</Link>
						</Button>
						<Badge size="sm" variant="outline">
							{t.create.lifecycle[action.lifecycle]}
						</Badge>
					</div>
				);
			})}
		</div>
	);
}
