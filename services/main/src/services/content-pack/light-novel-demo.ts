import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import {
	parseDocument,
	ZoneAppearanceDocument,
	type ZoneAppearanceDocument as ZoneAppearance,
} from "@rezics/block";
import { TopLevelSlugNamespaceUnitIds } from "@rezics/slug";
import { and, eq, isNull } from "drizzle-orm";

import { completeImageAsset, createImageAsset } from "../api/image-assets/service";
import {
	BootstrapPlatformAdministratorProfile,
	OfficialProfileIds,
} from "../bootstrap/data";
import { env } from "../config";
import { putCustomThemeInstallation } from "../custom-themes/presentation";
import { validateSubmittedCustomThemePackage } from "../custom-themes/package";
import { createCustomTheme, submitCustomThemeRevision } from "../custom-themes/service";
import { database } from "../database";
import {
	customThemeRevision,
	customThemeRevisionReviewEvent,
	unit,
	unitCustomThemeInstallation,
	unitSlugAddress,
	zone,
} from "../database/schema";
import { canonicalRevisionJson } from "../history/content";
import { assertLocalDatabaseUrl } from "../seed/data";
import { storage } from "../storage";
import {
	buildLightNovelDemoThemePackage,
	localLightNovelDemoReviewEvidence,
} from "./light-novel-demo-package";
import { resolveShowcasePacksDir } from "./resolve-source";

export const LightNovelZoneSlug = "light-novel";
const ThemeTitle = "Light novel catalog theme";

export type LightNovelDemoResult = {
	readonly hostUnitId: string;
	readonly bannerAssetId: string | null;
	readonly themeUnitId: string;
	readonly revisionId: string;
	readonly reused: boolean;
};

function sha256Hex(value: string): string {
	return createHash("sha256").update(value).digest("hex");
}

function mimeFromExportName(fileName: string): string {
	if (fileName.endsWith(".png")) return "image/png";
	if (fileName.endsWith(".webp")) return "image/webp";
	if (fileName.endsWith(".jpg") || fileName.endsWith(".jpeg")) return "image/jpeg";
	throw new Error(`Unsupported light-novel demo image ${fileName}`);
}

async function findLightNovelZoneId(): Promise<string> {
	const [row] = await database
		.select({ id: unitSlugAddress.targetUnitId })
		.from(unitSlugAddress)
		.innerJoin(unit, eq(unit.id, unitSlugAddress.targetUnitId))
		.where(
			and(
				eq(unitSlugAddress.slug, LightNovelZoneSlug),
				eq(unitSlugAddress.kind, "canonical"),
				eq(unitSlugAddress.scopeUnitId, TopLevelSlugNamespaceUnitIds.zones),
				eq(unit.kind, "zone"),
				isNull(unit.deletedAt),
			),
		)
		.limit(1);
	if (!row)
		throw new Error(
			"The light-novel Zone is not in the local database. Run `task local:showcase` first.",
		);
	return row.id;
}

async function uploadBannerIfPresent(
	exportDir: string,
	hostUnitId: string,
	ownerProfileId: string,
): Promise<string | null> {
	const [current] = await database
		.select({ appearanceDocument: zone.appearanceDocument })
		.from(zone)
		.where(eq(zone.id, hostUnitId))
		.limit(1);
	if (!current) throw new Error("The light-novel Zone row is missing");
	const appearance = parseDocument(ZoneAppearanceDocument, current.appearanceDocument);
	if (appearance.heroAssetId) return appearance.heroAssetId;

	let bytes: Buffer;
	let fileName: string;
	try {
		fileName = "catalog-banner.jpg";
		bytes = await readFile(join(exportDir, fileName));
	} catch {
		try {
			fileName = "catalog-banner.webp";
			bytes = await readFile(join(exportDir, fileName));
		} catch {
			console.info("No local light-novel banner export found; installing the theme without a hero.");
			return null;
		}
	}
	const contentType = mimeFromExportName(fileName);
	const created = await createImageAsset(ownerProfileId, {
		contentType,
		size: bytes.byteLength,
		access: "public",
	});
	const objectId = created.upload.headers["x-amz-meta-image_object_id"];
	if (!objectId) throw new Error("Image asset create did not return object tracking metadata");
	await storage.put({
		Key: `image-objects/${created.id}/original`,
		Body: bytes,
		ContentType: contentType,
		ContentLength: bytes.byteLength,
		Metadata: {
			image_asset_id: created.id,
			image_object_id: objectId,
			uploader_profile_id: ownerProfileId,
		},
	});
	const completed = await completeImageAsset(ownerProfileId, created.id, { role: "banner" });
	const nextAppearance: ZoneAppearance = { ...appearance, heroAssetId: completed.id };
	await database
		.update(zone)
		.set({ appearanceDocument: nextAppearance })
		.where(eq(zone.id, hostUnitId));
	return completed.id;
}

async function installTheme(
	hostUnitId: string,
	themeDir: string,
): Promise<{ readonly themeUnitId: string; readonly revisionId: string; readonly reused: boolean }> {
	const pack = await buildLightNovelDemoThemePackage(themeDir);
	const validated = validateSubmittedCustomThemePackage(pack);
	const [installed] = await database
		.select({
			revisionId: unitCustomThemeInstallation.revisionId,
			manifestSha256: customThemeRevision.manifestSha256,
			themeUnitId: customThemeRevision.customThemeUnitId,
		})
		.from(unitCustomThemeInstallation)
		.innerJoin(
			customThemeRevision,
			eq(customThemeRevision.id, unitCustomThemeInstallation.revisionId),
		)
		.where(eq(unitCustomThemeInstallation.hostUnitId, hostUnitId))
		.limit(1);
	if (installed?.manifestSha256 === validated.manifestSha256)
		return {
			themeUnitId: installed.themeUnitId,
			revisionId: installed.revisionId,
			reused: true,
		};

	const created = await createCustomTheme({
		ownerProfileId: OfficialProfileIds.editorial,
		localization: { language: "en", title: ThemeTitle },
	});
	const submitted = await submitCustomThemeRevision({
		themeUnitId: created.id,
		profileId: OfficialProfileIds.editorial,
		manifest: pack.manifest,
		sourceArchive: pack.sourceArchive,
		files: pack.files,
	});
	const evidence = localLightNovelDemoReviewEvidence();
	const evidenceSha256 = sha256Hex(canonicalRevisionJson(evidence));
	await database.transaction(async (tx) => {
		const [humanReady] = await tx
			.update(customThemeRevision)
			.set({ reviewState: "pending_human" })
			.where(
				and(
					eq(customThemeRevision.id, submitted.id),
					eq(customThemeRevision.reviewState, "pending_automated"),
				),
			)
			.returning({ id: customThemeRevision.id });
		if (!humanReady) throw new Error("Local Custom Theme revision was not pending automated review");
		const now = new Date();
		const [approved] = await tx
			.update(customThemeRevision)
			.set({
				reviewState: "approved",
				approvedHostUnitId: hostUnitId,
				reviewedByProfileId: OfficialProfileIds.moderation,
				reviewedAt: now,
				reviewEvidence: evidence,
				reviewEvidenceSha256: evidenceSha256,
				decisionReason: "Local disposable development install; automated browser review is skipped.",
			})
			.where(
				and(
					eq(customThemeRevision.id, submitted.id),
					eq(customThemeRevision.reviewState, "pending_human"),
				),
			)
			.returning({ id: customThemeRevision.id });
		if (!approved) throw new Error("Local Custom Theme revision could not be approved");
		await tx.insert(customThemeRevisionReviewEvent).values({
			revisionId: submitted.id,
			kind: "approve",
			actorProfileId: OfficialProfileIds.moderation,
			evidence,
			evidenceSha256,
		});
		await putCustomThemeInstallation(tx, {
			hostUnitId,
			revisionId: submitted.id,
			actorProfileId: BootstrapPlatformAdministratorProfile.profileId,
		});
	});
	return { themeUnitId: created.id, revisionId: submitted.id, reused: false };
}

export class LightNovelDemoService {
	async run(): Promise<LightNovelDemoResult> {
		assertLocalDatabaseUrl(env.DATABASE_URL);
		const packsRoot = resolveShowcasePacksDir({});
		const hostUnitId = await findLightNovelZoneId();
		const bannerAssetId = await uploadBannerIfPresent(
			join(packsRoot, "assets/demo/light-novel/export"),
			hostUnitId,
			BootstrapPlatformAdministratorProfile.profileId,
		);
		const theme = await installTheme(hostUnitId, join(packsRoot, "tools/light-novel-theme"));
		return { hostUnitId, bannerAssetId, ...theme };
	}
}

export const lightNovelDemoService = new LightNovelDemoService();
