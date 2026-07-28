import { describe, expect, it } from "vitest";
import type { PortableTextValue } from "@rezics/portable-text";

import {
	convertChineseContentText,
	convertChinesePortableText,
} from "./chinese-content-conversion";

describe("Chinese content display conversion", () => {
	it("keeps original text byte-for-byte", async () => {
		const original = "汉字與繁體";
		await expect(convertChineseContentText(original, "original")).resolves.toBe(original);
	});

	it("converts both display directions without rewriting URLs", async () => {
		await expect(convertChineseContentText("汉字", "hant")).resolves.toBe("漢字");
		await expect(convertChineseContentText("漢字", "hans")).resolves.toBe("汉字");
		await expect(
			convertChineseContentText("查看 https://例子.测试/汉字", "hant"),
		).resolves.toBe("查看 https://例子.测试/汉字");
	});

	it("projects only Portable Text prose leaves without mutating input", async () => {
		const value: PortableTextValue = [
			{
				_key: "block",
				_type: "block",
				children: [
					{ _key: "text", _type: "span", marks: [], text: "汉字" },
					{ _key: "code", _type: "span", marks: ["code"], text: "汉字" },
					{
						_key: "mention",
						_type: "unit-mention",
						unitId: "11111111-1111-4111-8111-111111111111",
					},
				],
				markDefs: [],
				style: "normal",
			},
		];

		const converted = await convertChinesePortableText(value, "hant");
		expect(converted).not.toBe(value);
		expect(converted[0]).toMatchObject({
			children: [{ text: "漢字" }, { text: "汉字" }, { _type: "unit-mention" }],
		});
		expect(value[0]).toMatchObject({
			children: [{ text: "汉字" }, { text: "汉字" }, { _type: "unit-mention" }],
		});
	});
});
