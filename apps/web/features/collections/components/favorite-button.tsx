"use client";

import { CollectionSaveControl } from "./collection-save-control";

export function FavoriteButton({ targetId }: { readonly targetId: string }) {
	return <CollectionSaveControl targetId={targetId} triggerVariant="outline" />;
}
