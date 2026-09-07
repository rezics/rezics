import { z } from "zod";

const target = z.strictObject({
	owner: z.enum([
		"publishing",
		"music",
		"program",
		"software",
		"entity",
		"grouping",
		"reference",
		"distribution",
	]),
	shapes: z
		.array(z.string().regex(/^[a-z][a-z0-9_.-]{0,95}$/u))
		.min(1)
		.max(64),
});
const scalar = {
	nullable: z.boolean().default(false),
	minLength: z.number().int().min(0).max(131072).optional(),
	maxLength: z.number().int().min(0).max(131072).optional(),
	minimum: z.number().finite().optional(),
	maximum: z.number().finite().optional(),
	integer: z.boolean().default(false),
	allowedValues: z
		.array(z.union([z.string().max(4096), z.number().finite(), z.boolean()]))
		.max(512)
		.optional(),
	unit: z.string().min(1).max(96).optional(),
	vocabularyRevisionId: z.uuid().optional(),
};
/** @alpha Reviewed, bounded validation grammar. Domain composition never belongs here. */
export const CatalogDefinitionConstraintsSchema = z
	.strictObject({
		...scalar,
		targets: z.array(target).max(32).optional(),
		slots: z
			.array(z.string().regex(/^[a-z][a-z0-9_.-]{0,95}$/u))
			.max(32)
			.optional(),
		roles: z
			.array(
				z
					.strictObject({
						roleRevisionId: z.uuid(),
						min: z.number().int().min(0).max(128),
						max: z.number().int().min(1).max(128),
						targets: z.array(target).min(1).max(32),
					})
					.refine((v) => v.min <= v.max, "Role minimum exceeds maximum"),
			)
			.max(32)
			.optional(),
		qualifierRevisionIds: z.array(z.uuid()).max(64).optional(),
		memberRevisionIds: z.array(z.uuid()).max(512).optional(),
		rules: z
			.array(
				z.strictObject({
					position: z.number().int().min(0).max(127),
					parent: z.number().int().min(0).max(127).nullable(),
					memberKey: z.string().max(256).nullable(),
					kind: z.enum(["string", "number", "boolean", "null", "object", "array"]),
					...scalar,
				}),
			)
			.min(1)
			.max(128)
			.optional(),
	})
	.superRefine((v, ctx) => {
		if (v.minimum !== undefined && v.maximum !== undefined && v.minimum > v.maximum)
			ctx.addIssue({ code: "custom", message: "Invalid numeric bounds" });
		if (v.minLength !== undefined && v.maxLength !== undefined && v.minLength > v.maxLength)
			ctx.addIssue({ code: "custom", message: "Invalid text bounds" });
		if (v.roles && v.roles.reduce((sum, role) => sum + role.min, 0) > 128)
			ctx.addIssue({
				code: "custom",
				message: "Predicate minimum participation exceeds command budget",
			});
		if (v.roles && new Set(v.roles.map((r) => r.roleRevisionId)).size !== v.roles.length)
			ctx.addIssue({ code: "custom", message: "Duplicate predicate role" });
		if (Buffer.byteLength(JSON.stringify(v), "utf8") > 262144)
			ctx.addIssue({ code: "custom", message: "Definition exceeds governance byte budget" });
		const rules = v.rules;
		if (rules)
			for (const [i, rule] of rules.entries()) {
				if (
					rule.position !== i ||
					(i === 0
						? rule.parent !== null || rule.memberKey !== null
						: rule.parent === null || rule.parent >= i)
				)
					ctx.addIssue({
						code: "custom",
						message: "Rules must be a contiguous parent-before-child grammar",
					});
				if (rule.parent !== null) {
					const parent = rules[rule.parent];
					if (
						!parent ||
						!["array", "object"].includes(parent.kind) ||
						(parent.kind === "array" ? rule.memberKey !== null : rule.memberKey === null)
					)
						ctx.addIssue({ code: "custom", message: "Rule does not match its container" });
				}
				if (
					rules.slice(0, i).some((r) => r.parent === rule.parent && r.memberKey === rule.memberKey)
				)
					ctx.addIssue({ code: "custom", message: "Ambiguous child rule" });
			}
	});
export type CatalogDefinitionConstraints = z.infer<typeof CatalogDefinitionConstraintsSchema>;
