import {
	assertDockDocument,
	assertNavigationDocument,
	assertUnitReferencedBlockDocument,
	assertWikiPostPortableTextDocument,
	ZonePageBlockHostPolicy,
} from "@rezics/block";

import {
	BootstrapEpochIso,
	BootstrapEpochUnixMilliseconds,
	OfficialZoneManifest,
	ReservedBootstrapUuidv7s,
} from "./data";

const UuidV7Pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export function uuidv7UnixMilliseconds(value: string): number {
	if (!UuidV7Pattern.test(value)) throw new Error(`Invalid reserved UUIDv7: ${value}`);
	return Number.parseInt(value.slice(0, 8) + value.slice(9, 13), 16);
}

export function assertBootstrapManifest(): void {
	const uniqueIds = new Set(ReservedBootstrapUuidv7s);
	if (uniqueIds.size !== ReservedBootstrapUuidv7s.length)
		throw new Error("Bootstrap manifest contains duplicate UUIDs");
	for (const id of ReservedBootstrapUuidv7s) {
		if (uuidv7UnixMilliseconds(id) !== BootstrapEpochUnixMilliseconds)
			throw new Error(`Bootstrap UUID does not use ${BootstrapEpochIso}: ${id}`);
	}
	for (const zone of OfficialZoneManifest) {
		assertDockDocument(zone.mainDockDocument);
		assertNavigationDocument(zone.navigation.document);
		assertUnitReferencedBlockDocument(zone.homePage.document, ZonePageBlockHostPolicy);
		for (const localization of zone.wikiPost.localizations)
			assertWikiPostPortableTextDocument(localization.body);
	}
}
