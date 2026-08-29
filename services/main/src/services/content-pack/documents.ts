import {
	UnitReferencedBlockDocument,
	WikiPostBlockHostPolicy,
	ZonePageBlockHostPolicy,
	ZoneAppearanceDocument,
	assertBlockQueryBudget,
	assertUnitReferencedBlockDocument,
	assertWikiPostPortableTextDocument,
	describeDocumentIssues,
	isDocument,
} from "@rezics/block";

import { ContentPackInvalid } from "./errors";
import type { LoadedPack, PackObject } from "./contracts";

export function assertContentPackDocuments(pack: LoadedPack): void {
	for (const object of pack.objects) assertPackObjectDocuments(object);
}

export function assertPackObjectDocuments(object: PackObject): void {
	if (object.unit.kind === "zone") {
		const appearanceDocument = object.compiledZone?.appearanceDocument;
		if (!isDocument(ZoneAppearanceDocument, appearanceDocument))
			throw new ContentPackInvalid(
				`${object.sourceKey} compiled Zone theme is not a ZoneAppearanceDocument`,
			);
	}
	if (object.unit.kind === "zone_page") {
		for (const localization of object.localizations)
			assertZonePageLocalization(object, localization);
		return;
	}
	if (object.post?.kind !== "wiki") return;
	for (const localization of object.localizations) {
		if (localization.content === undefined) continue;
		try {
			assertWikiPostPortableTextDocument(localization.content);
			assertBlockQueryBudget({ blocks: [localization.content] }, WikiPostBlockHostPolicy);
		} catch {
			throw new ContentPackInvalid(
				`${object.sourceKey}.${localization.language} wiki content is not a Wiki Post Portable Text document`,
			);
		}
	}
}

function assertZonePageLocalization(
	object: PackObject,
	localization: PackObject["localizations"][number],
): void {
	const label = `${object.sourceKey}.${localization.language}`;
	if (!localization.title || localization.content === undefined || !localization.contentStatus)
		throw new ContentPackInvalid(`${label} zone page localization is incomplete`);
	if (!isDocument(UnitReferencedBlockDocument, localization.content)) {
		const issues = describeDocumentIssues(UnitReferencedBlockDocument, localization.content)
			.map((issue) => `${issue.path} ${issue.message}`)
			.join("; ");
		throw new ContentPackInvalid(
			`${label} zone page content is not a UnitReferencedBlockDocument${issues ? `: ${issues}` : ""}`,
		);
	}
	try {
		assertUnitReferencedBlockDocument(localization.content, ZonePageBlockHostPolicy);
		assertBlockQueryBudget(localization.content, ZonePageBlockHostPolicy);
	} catch {
		throw new ContentPackInvalid(`${label} zone page content violates ZonePageBlockHostPolicy`);
	}
}
