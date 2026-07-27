import type { ReactNode } from "react";

import { CollectionManagementWorkspace } from "@/features/collections/components/collection-management-workspace";

export default async function CollectionEditLayout({
	children,
	params,
}: {
	readonly children: ReactNode;
	readonly params: Promise<{ id: string }>;
}) {
	return (
		<CollectionManagementWorkspace collectionId={(await params).id}>
			{children}
		</CollectionManagementWorkspace>
	);
}
