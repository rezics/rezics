"use client";

import { BookContents } from "../components/book-contents";
import { MediaContents } from "../components/media-contents";
import { useCatalogDetail } from "../components/catalog-detail-workspace";

export function CatalogContentsPage() {
	const detail = useCatalogDetail();
	if (detail.type === "book") return <BookContents bookId={detail.unit.id} />;
	if (detail.type === "media") return <MediaContents mediaId={detail.unit.id} />;
	throw new Error("Content structure cannot be rendered for this Unit type");
}
