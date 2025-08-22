import { Either, pipe } from "effect";
import { Browser, Page, Response } from "rebrowser-playwright";
import { Book } from "../../schema.ts";

export type Strategy = (
	driver: Browser,
	url: URL,
) => Promise<Either.Either<Book, string>>;

export const make_context = async (driver: Browser) => {
	const context = await driver.newContext({
		userAgent:
			"'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'",
	});
	await context.addInitScript({
		content: "delete navigator.__proto__.webdriver",
	});
	return context;
};

export const make_strategy = (
	platform: string,
	domain: string,
	extractor: (
		page: Page,
		url: URL,
		responses: Response[],
	) => Promise<Either.Either<Omit<Book, "platform" | "link">, string>>,
): Strategy =>
async (driver, url) => {
	const domainValidation = url.hostname === domain
		? Either.right(url)
		: Either.left(`Domain must be ${domain}, got ${url.hostname}`);

	if (Either.isLeft(domainValidation)) {
		return Either.left(domainValidation.left);
	}

	const cleanUrl = new URL(url.toString());
	cleanUrl.searchParams.forEach((_, key) =>
		cleanUrl.searchParams.delete(key)
	);

	try {
		const context = await make_context(driver);
		const page = await context.newPage();
		await page.setViewportSize({ width: 1920, height: 1080 });

		const responses: Response[] = [];
		page.on("response", (response) => responses.push(response));

		try {
			const result = await extractor(page, cleanUrl, responses);

			return pipe(
				result,
				Either.map(
					(data: Omit<Book, "platform" | "link">): Book => ({
						...data,
						platform,
						link: cleanUrl.toString(),
					}),
				),
			);
		} finally {
			try {
				await page.close();
			} catch (error) {
				console.warn("Failed to close page:", error);
			}
		}
	} catch (error) {
		return Either.left(
			error instanceof Error ? error.message : String(error),
		);
	}
};

export const make_discover = <T extends any[]>(
	discover: (page: Page, ...params: T) => AsyncGenerator<URL>,
) =>
async (driver: Browser, ...params: T) => {
	try {
		const context = await make_context(driver);
		const page = await context.newPage();
		return discover(page, ...params);
	} catch (error) {
		throw new Error(
			`Failed to create discover: ${
				error instanceof Error ? error.message : String(error)
			}`,
		);
	}
};

export const make_test =
	(strategy: Strategy, url: string) => async (): Promise<string> => {
		try {
			const driver = (await import("../drivers/chromium.ts")).chromium;
			const result = await strategy(driver, new URL(url));
			return JSON.stringify(result, null, 2);
		} catch (error) {
			const errorResult = Either.left(
				`Test failed: ${
					error instanceof Error ? error.message : String(error)
				}`,
			);
			return JSON.stringify(errorResult, null, 2);
		}
	};
