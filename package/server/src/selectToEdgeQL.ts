import type { Select } from "contract";

export function selectToEdgeQL<TSelect extends Select<object>>(
	select: TSelect,
): object {
	return Object.fromEntries(
		Object.entries(select).map(([key, value]) => {
			if (Array.isArray(value)) {
				return [
					key,
					{
						...selectToEdgeQL(value[0]),
						...value[1],
					},
				];
			}

			return [key, value];
		}),
	);
}
