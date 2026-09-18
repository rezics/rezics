declare module "rdf-canonize" {
	import type { RdfQuad } from "@rezics/schema";
	export function canonize(
		input: readonly RdfQuad[],
		options: {
			algorithm: "RDFC-1.0";
			maxWorkFactor: number;
			signal: AbortSignal;
		},
	): Promise<string>;
	export const NQuads: {
		parse(input: string): unknown[];
		serialize(input: readonly RdfQuad[]): string;
	};
}
