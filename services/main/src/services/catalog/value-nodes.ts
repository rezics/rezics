import { z } from "zod";
import { CatalogValueKindValues } from "@rezics/schema/contracts/native/catalog";

export const CatalogValueNodeSchema = z
	.strictObject({
		position: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
		parentPosition: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).nullable(),
		parentKind: z.enum(["object", "array"]).nullable(),
		memberKey: z.string().nullable(),
		kind: z.enum(CatalogValueKindValues),
		textValue: z.string().nullable(),
		numberValue: z
			.string()
			.max(4096)
			.regex(/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d{1,4})?$/u)
			.nullable(),
		booleanValue: z.boolean().nullable(),
	})
	.superRefine((value, context) => {
		const scalarValid =
			value.kind === "string"
				? value.textValue !== null && value.numberValue === null && value.booleanValue === null
				: value.kind === "number"
					? value.numberValue !== null && value.textValue === null && value.booleanValue === null
					: value.kind === "boolean"
						? value.booleanValue !== null && value.textValue === null && value.numberValue === null
						: value.textValue === null && value.numberValue === null && value.booleanValue === null;
		if (!scalarValid)
			context.addIssue({ code: "custom", message: "Value columns do not match node kind" });
		const parentValid =
			value.position === 0
				? value.parentPosition === null && value.parentKind === null && value.memberKey === null
				: value.parentPosition !== null &&
					value.parentPosition < value.position &&
					value.parentKind !== null &&
					(value.parentKind === "object" ? value.memberKey !== null : value.memberKey === null);
		if (!parentValid)
			context.addIssue({
				code: "custom",
				message: "Value node has an invalid parent or member key",
			});
	});
export type CatalogValueNode = z.infer<typeof CatalogValueNodeSchema>;

/** Stream typed nodes without making a second whole-document copy. */
export function* catalogValueNodes(value: unknown): Generator<CatalogValueNode> {
	let position = 0;
	const ancestors = new Set<object>();
	function* visit(
		input: unknown,
		parentPosition: number | null,
		parentKind: "array" | "object" | null,
		memberKey: string | null,
		depth: number,
	): Generator<CatalogValueNode> {
		if (depth > 64)
			throw new RangeError("Catalog value nesting exceeds the supported source grammar");
		if (position >= Number.MAX_SAFE_INTEGER)
			throw new RangeError("Catalog value position exceeds exact integer range");
		const here = position++;
		const base = {
			position: here,
			parentPosition,
			parentKind,
			memberKey,
			textValue: null,
			numberValue: null,
			booleanValue: null,
		};
		if (input === null) {
			yield { ...base, kind: "null" };
			return;
		}
		if (typeof input === "string") {
			yield { ...base, kind: "string", textValue: input };
			return;
		}
		if (typeof input === "boolean") {
			yield { ...base, kind: "boolean", booleanValue: input };
			return;
		}
		if (typeof input === "number") {
			if (!Number.isFinite(input)) throw new TypeError("Catalog JSON numbers must be finite");
			yield { ...base, kind: "number", numberValue: String(input) };
			return;
		}
		if (typeof input !== "object" || ancestors.has(input))
			throw new TypeError("Catalog values must be acyclic JSON data");
		ancestors.add(input);
		try {
			if (Array.isArray(input)) {
				yield { ...base, kind: "array" };
				for (const child of input) yield* visit(child, here, "array", null, depth + 1);
			} else {
				if (
					Object.getPrototypeOf(input) !== Object.prototype &&
					Object.getPrototypeOf(input) !== null
				)
					throw new TypeError("Catalog object values must be plain JSON objects");
				yield { ...base, kind: "object" };
				for (const [key, child] of Object.entries(input))
					yield* visit(child, here, "object", key, depth + 1);
			}
		} finally {
			ancestors.delete(input);
		}
	}
	yield* visit(value, null, null, null, 0);
}
