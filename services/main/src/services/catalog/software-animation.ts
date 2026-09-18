import { and, eq } from "drizzle-orm";
import { z } from "zod";
import type { DatabaseTransaction } from "../database";
import { softwareReleaseAnimation } from "@rezics/schema/postgres/software/software";
import type { CatalogReference } from "@rezics/schema/contracts/native/catalog";
import { loadCatalogIdentity, recordCatalogChange } from "./storage";

export const SoftwareAnimationSchema = z
	.strictObject({
		context: z.enum(["story_sprite", "story_scene", "cutscene", "erotic_sprite", "erotic_scene"]),
		state: z.enum(["unknown", "none", "not_applicable", "animated"]),
		handDrawn: z.boolean().default(false),
		vectorial: z.boolean().default(false),
		threeDimensional: z.boolean().default(false),
		liveAction: z.boolean().default(false),
		frequency: z.enum(["unknown", "some", "all"]).default("unknown"),
	})
	.superRefine((value, ctx) => {
		const technique =
			value.handDrawn || value.vectorial || value.threeDimensional || value.liveAction;
		if (value.state === "animated" ? !technique : technique || value.frequency !== "unknown")
			ctx.addIssue({ code: "custom", message: "Animation state and technique differ" });
		if (value.context === "cutscene" && (value.state === "none" || value.frequency !== "unknown"))
			ctx.addIssue({
				code: "custom",
				message: "Cutscene animation does not admit absent animation or scene frequency",
			});
	});

/** Decode only the pinned upstream bitmask; unknown bits require review rather than data loss. */
export function vndbAnimation(
	context: z.input<typeof SoftwareAnimationSchema>["context"],
	value: number | null,
) {
	if (
		value !== null &&
		(!Number.isSafeInteger(value) ||
			value < 0 ||
			value > 1023 ||
			(value & ~(1 + 4 + 8 + 16 + 32 + 256 + 512)) !== 0)
	)
		throw new TypeError("Unrecognized VNDB animation flags");
	if (value !== null && value > 1 && (value & 1) !== 0)
		throw new TypeError("Animation sentinel cannot combine with techniques");
	if (value !== null && (value & 768) === 768)
		throw new TypeError("Animation has conflicting frequency flags");
	const flags = value ?? 0;
	return SoftwareAnimationSchema.parse({
		context,
		state:
			value === null
				? "unknown"
				: value === 0
					? "none"
					: value === 1
						? "not_applicable"
						: "animated",
		handDrawn: (flags & 4) !== 0,
		vectorial: (flags & 8) !== 0,
		threeDimensional: (flags & 16) !== 0,
		liveAction: (flags & 32) !== 0,
		frequency: flags & 256 ? "some" : flags & 512 ? "all" : "unknown",
	});
}

export async function setSoftwareAnimation(
	tx: DatabaseTransaction,
	release: CatalogReference,
	actor: string,
	expectedRevision: number,
	input: z.input<typeof SoftwareAnimationSchema>,
) {
	const value = SoftwareAnimationSchema.parse(input);
	const identity = await loadCatalogIdentity(tx, release, actor, true);
	if (release.owner !== "software" || identity.shape !== "release")
		throw new TypeError("Animation requires software release");
	const revision = await recordCatalogChange(
		tx,
		release,
		actor,
		expectedRevision,
		"software.animation.set",
	);
	await tx
		.insert(softwareReleaseAnimation)
		.values({ releaseId: release.id, ...value })
		.onConflictDoUpdate({
			target: [softwareReleaseAnimation.releaseId, softwareReleaseAnimation.context],
			set: value,
		});
	return { revision };
}

/** Five presentation contexts are a proven per-release bound. */
export async function readSoftwareAnimation(
	tx: DatabaseTransaction,
	release: CatalogReference,
	actor: string | null,
) {
	const identity = await loadCatalogIdentity(tx, release, actor, false);
	if (release.owner !== "software" || identity.shape !== "release")
		throw new TypeError("Animation requires software release");
	return tx
		.select()
		.from(softwareReleaseAnimation)
		.where(and(eq(softwareReleaseAnimation.releaseId, release.id)))
		.orderBy(softwareReleaseAnimation.context)
		.limit(5);
}
