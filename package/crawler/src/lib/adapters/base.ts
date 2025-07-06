import { Either, left, match, right } from "fp-ts/lib/Either.js";
import { Browser, Page, Response } from "playwright";
import { Book } from "../../schema.js";
import { pipe } from "fp-ts/lib/function.js";

export type Strategy = (driver: Browser, url: URL) => Promise<Either<string, Book>>;

export const create_context = async (driver: Browser) => {
    const context = await driver.newContext({
        userAgent:
            "'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'",
    });
    await context.addInitScript({
        content: "delete navigator.__proto__.webdriver",
    });
    return context;
};

export const create_strategy =
    (
        platform: string,
        domain: string,
        extractor: (
            page: Page,
            url: URL,
            responses: Response[],
        ) => Promise<Either<string, Omit<Book, "platform" | "link">>>,
    ): Strategy =>
    async (driver, url) => {
        if (url.hostname !== domain) {
            return left(`Domain must be ${domain}`);
        }
        url.searchParams.forEach((_, key) => url.searchParams.delete(key));

        const context = await create_context(driver);
        const page = await context.newPage();
        await page.setViewportSize({ width: 1920, height: 1080 });

        const responses: Response[] = [];
        page.on("response", (response) => responses.push(response));

        try {
            return pipe(
                await extractor(page, url, responses),
                match(
                    (error) => left(error),
                    (data) =>
                        right({
                            ...data,
                            platform: platform,
                            link: url.toString(),
                        }),
                ),
            );
        } catch (error) {
            return left(error instanceof Error ? error.message : String(error));
        } finally {
            await page.close();
        }
    };

export const create_discover =
    <T extends any[]>(discover: (page: Page, ...params: T) => AsyncGenerator<URL>) =>
    async (driver: Browser, ...params: T) => {
        const context = await create_context(driver);
        const page = await context.newPage();
        return discover(page, ...params);
    };

export const create_test = (strategy: Strategy, url: string) => async () => {
    const driver = (await import("../drivers/chromium.js")).chromium;
    return JSON.stringify(await strategy(driver, new URL(url)));
};
