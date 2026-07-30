"use client";

import { BookContents } from "../components/book-contents";
import { MediaContents } from "../components/media-contents";
import { useUnitDetail } from "../components/unit-detail-workspace";

export function UnitContentsPage() {
	const detail = useUnitDetail();
	if (detail.type === "book") return <BookContents bookId={detail.unit.id} />;
	if (detail.type === "media") return <MediaContents mediaId={detail.unit.id} />;
	throw new Error("Content structure cannot be rendered for this Unit type");
}
