import type { Select } from "contract";

export function selectQuery<
	TBase,
	TSelect extends Select<TBase> = Select<TBase>,
>(
	select: TSelect,
): string {
	const keys = Object.entries(select).filter(([_, value]) => Boolean(value))
		.reduce<{
			simple: [key: string, value: any][];
			rested: [key: string, value: any][];
			nested: [key: string, value: any][];
		}>((acc, cur) => {
			if (typeof cur[1] === "object") {
				acc.nested.push(cur);
			} else if (typeof cur[1] === "string") {
				acc.rested.push(cur);
			} else {
				acc.simple.push(cur);
			}
			return acc;
		}, {
			simple: [],
			rested: [],
			nested: [],
		});

	return `{${
		[
			...keys.simple.map(([key]) => key),
			...keys.rested.map(([key, value]) => `${key}:{${value}}`),
			...keys.nested.map(([key, value]) =>
				`${key}:${selectQuery(value)}`
			),
		].join(",")
	}}`;
}
