import { make_test } from "./base.ts";
import { strategy } from "./fanqienovel.ts";

export const test = make_test(
	strategy,
	"https://fanqienovel.com/page/7143038691944959011",
);

console.log(await test());
