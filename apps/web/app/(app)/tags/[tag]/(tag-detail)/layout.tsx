import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { TagDetailWorkspace } from "@/features/tags/components/tag-detail-workspace";
import { isUnitId } from "@/features/units/model/unit-id";

export default async function Layout({
	children,
	params,
}: {
	readonly children: ReactNode;
	readonly params: Promise<{ tag: string }>;
}) {
	const { tag } = await params;
	if (!isUnitId(tag)) notFound();
	return <TagDetailWorkspace tagId={tag}>{children}</TagDetailWorkspace>;
}
