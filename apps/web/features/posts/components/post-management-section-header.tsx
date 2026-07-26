"use client";

import { ManagementWorkspaceSectionHeader } from "@rezics/ui";
import Link from "next/link";
import type { ReactNode } from "react";

import { useTranslation } from "@/i18n/client";
import { postManagementHref } from "../routing/post-management-routes";
import { usePostManagement } from "./post-management-workspace";

export function PostManagementSectionHeader({
	title,
	description,
	action,
}: {
	title: string;
	description?: string;
	action?: ReactNode;
}) {
	const { t } = useTranslation(["posts"]);
	const { resource } = usePostManagement();
	return (
		<ManagementWorkspaceSectionHeader
			action={action}
			backHref={postManagementHref(resource.kind, resource.item.id)}
			backLabel={t.posts.workspace.sections.main.label}
			description={description}
			link={Link}
			showBackOnMobile={false}
			title={title}
		/>
	);
}
