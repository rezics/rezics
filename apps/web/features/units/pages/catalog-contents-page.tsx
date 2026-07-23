"use client";

import { useTranslation } from "@/i18n/client";
import { CatalogDetailSectionFrame } from "../components/catalog-detail-section-frame";
import { useCatalogDetail } from "../components/catalog-detail-workspace";
import { BookChapters } from "../reader";

export function CatalogContentsPage() {
	const detail = useCatalogDetail();
	const { t } = useTranslation(["units"]);
	if (detail.type !== "book")
		throw new Error("Book contents cannot be rendered for another Unit type");
	return (
		<CatalogDetailSectionFrame
			description={t.units.detail.sectionDescriptions.book.contents}
			title={t.units.detail.tabs.book.contents}
		>
			<BookChapters bookId={detail.unit.id} />
		</CatalogDetailSectionFrame>
	);
}
