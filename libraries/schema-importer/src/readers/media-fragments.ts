/** @alpha Lossless media-fragment dimensions; time units and absent bounds are never coerced to floating-point seconds. */
export function convertMediaFragment(uri: string) {
	const hash = uri.indexOf("#");
	if (hash < 0) return { uri, resource: uri, dimensions: [] };
	const dimensions = uri
		.slice(hash + 1)
		.split("&")
		.filter(Boolean)
		.map((entry, position) => {
			const equal = entry.indexOf("=");
			if (equal < 0) throw new TypeError("Media fragment dimension needs a value");
			const name = decodeURIComponent(entry.slice(0, equal)),
				value = decodeURIComponent(entry.slice(equal + 1));
			if (name === "t") {
				const unit = /^(npt|smpte(?:-25|-30|-30-drop)?|clock):/.exec(value);
				const format = unit?.[1] ?? "npt",
					range = (unit ? value.slice(unit[0].length) : value).split(",");
				if (range.length > 2 || range.every((value) => !value))
					throw new TypeError("Invalid temporal fragment");
				if (
					format === "npt" &&
					range.some((value) => value && !/^(?:[0-9]+:){0,2}[0-9]+(?:\.[0-9]+)?$/.test(value))
				)
					throw new TypeError("Invalid NPT value");
				return {
					position,
					name,
					raw: entry,
					value,
					kind: "time",
					format,
					start: range[0] || null,
					end: range[1] || null,
				};
			}
			if (name === "xywh") {
				const match =
					/^(?:(pixel|percent):)?([0-9]+(?:\.[0-9]+)?),([0-9]+(?:\.[0-9]+)?),([0-9]+(?:\.[0-9]+)?),([0-9]+(?:\.[0-9]+)?)$/.exec(
						value,
					);
				if (!match) throw new TypeError("Invalid spatial fragment");
				const [x, y, width, height] = match.slice(2).map(Number);
				if (!width || !height || !Number.isFinite(x! + y! + width + height))
					throw new TypeError("Invalid spatial extent");
				if (match[1] === "percent" && (x! + width > 100 || y! + height > 100))
					throw new TypeError("Percent extent exceeds the resource");
				if (
					(match[1] ?? "pixel") === "pixel" &&
					match.slice(2).some((value) => value.includes("."))
				)
					throw new TypeError("Pixel coordinates are integers");
				return {
					position,
					name,
					raw: entry,
					value,
					kind: "space",
					unit: match[1] ?? "pixel",
					x: match[2],
					y: match[3],
					width: match[4],
					height: match[5],
				};
			}
			return {
				position,
				name,
				raw: entry,
				value,
				kind: name === "track" || name === "id" ? name : "extension",
			};
		});
	return { uri, resource: uri.slice(0, hash), dimensions };
}
