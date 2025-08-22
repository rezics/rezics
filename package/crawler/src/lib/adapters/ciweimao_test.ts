import { chromium } from "../drivers/chromium.ts";
import { make_test } from "./base.ts";
import { discover, strategy } from "./ciweimao.ts";

export const test = make_test(
	strategy,
	"https://www.ciweimao.com/book/100409881",
);

console.log(await test());

const links = await discover(chromium);

while (true) {
	console.log(
		JSON.stringify(
			await strategy(chromium, (await links.next()).value),
		),
	);
}
