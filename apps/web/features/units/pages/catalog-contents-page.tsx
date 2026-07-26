"use client";

import { BookContents } from "../components/book-contents";
import { useCatalogDetail } from "../components/catalog-detail-workspace";

export function CatalogContentsPage() {
	const detail = useCatalogDetail();
	if (detail.type !== "book")
		throw new Error("Book contents cannot be rendered for another Unit type");
	return <BookContents bookId={detail.unit.id} />;
}
