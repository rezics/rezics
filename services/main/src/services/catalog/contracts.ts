import { z } from "zod";
import { CatalogOwnerValues, CatalogReferenceSchema } from "@rezics/reference";
export { CatalogOwnerValues, CatalogReferenceSchema };
import { CatalogDefinitionConstraintsSchema } from "./definition-contracts";
import {
	ContentRatingValues,
	ModerationStatusValues,
	ResourceVisibilityValues,
	UnitStatusValues,
} from "../database/schema/contract-values";

export type CatalogOwner = (typeof CatalogOwnerValues)[number];
export type CatalogReference = z.infer<typeof CatalogReferenceSchema>;

export const CatalogFactStateValues = ["active", "disputed", "withdrawn", "superseded"] as const;
export type CatalogFactState = (typeof CatalogFactStateValues)[number];
export const CatalogValueKindValues = [
	"null",
	"string",
	"number",
	"boolean",
	"object",
	"array",
] as const;
export type CatalogValueKind = (typeof CatalogValueKindValues)[number];

export const CatalogIdentityInputSchema = z.strictObject({
	id: z.uuid().optional(),
	owner: z.enum(CatalogOwnerValues),
	/** Stable protocol shape; semantic classification is recorded separately. */
	shape: z.string().regex(/^[a-z][a-z0-9_.-]{0,95}$/u),
	status: z.enum(UnitStatusValues).default("draft"),
	visibility: z.enum(ResourceVisibilityValues).default("private"),
	contentRating: z.enum(ContentRatingValues).default("general"),
	moderationStatus: z.enum(ModerationStatusValues).default("approved"),
});
export type CatalogIdentityInput = z.input<typeof CatalogIdentityInputSchema>;

/** Missing year/month/day and ended state remain independent source facts. */
export const CatalogPartialDateSchema = z
	.strictObject({
		year: z.number().int().min(-2_147_483_648).max(2_147_483_647).nullable(),
		month: z.number().int().min(1).max(12).nullable(),
		day: z.number().int().min(1).max(31).nullable(),
	})
	.superRefine((value, context) => {
		if (value.month === null || value.day === null) return;
		const leap =
			value.year === null ||
			value.year % 400 === 0 ||
			(value.year % 4 === 0 && value.year % 100 !== 0);
		const maximum =
			value.month === 2 ? (leap ? 29 : 28) : [4, 6, 9, 11].includes(value.month) ? 30 : 31;
		if (value.day > maximum)
			context.addIssue({
				code: "custom",
				path: ["day"],
				message: "Day is outside the known calendar month",
			});
	});
export type CatalogPartialDate = z.infer<typeof CatalogPartialDateSchema>;

export const CatalogDefinitionInputSchema = z
	.strictObject({
		namespace: z.string().regex(/^[a-z][a-z0-9_.-]{0,95}$/u),
		key: z.string().min(1).max(160),
		kind: z.enum(["class", "property", "predicate", "role", "vocabulary"]),
		valueKind: z.enum(CatalogValueKindValues).nullable(),
		constraints: CatalogDefinitionConstraintsSchema.default({ nullable: false, integer: false }),
	})
	.refine((value) => (value.kind === "property") === (value.valueKind !== null), {
		message: "Only property definitions declare a value kind",
		path: ["valueKind"],
	});

export const CatalogPageSchema = z.strictObject({
	limit: z.number().int().min(1).max(100).default(50),
	afterId: z.uuid().optional(),
});
