import { right } from "fp-ts/lib/Either.js";
import { create_discover, create_strategy, create_test } from "./base.js";
import { exec, sleep } from "../util.js";
import { Page } from "playwright";

export const platform = "qidian";
export const domain = "www.qidian.com";

export const strategy = create_strategy(platform, domain, async (page, url, responses) => {
    await page.goto(url.toString());

    const cover_src = (await page.locator("#bookImg").locator("img").first().getAttribute("src"))!;

    return right({
        id: {},
        cover: (await responses.find((response) => response.url().endsWith(cover_src))!.body()).toString("base64"),
        title: (await page.locator("#bookName").innerText())!,
        authors: [(await page.locator(".author").innerText()).split(":").at(-1)!],
        tags: await page.locator(".all-label").first().locator("a").allInnerTexts(),
        description: (await page.locator("#book-intro-detail").first().innerText())!,
        units: await Promise.all(
            (await page.locator(".catalog-volume").all()).map(async (locator) => ({
                title: await locator.locator(".volume-name").evaluate(
                    (element) =>
                        Array.from(element.childNodes)
                            .filter((node) => node instanceof Text)[0]
                            ?.textContent?.trim()!,
                ),
                children: (await locator.locator(".chapter-name").allInnerTexts()).map((chapter) => ({
                    title: chapter,
                })),
            })),
        ),
        length:
            parseInt((await page.locator(".count").locator("em").first().innerText()).match(/(\d+)万/)![0]) * 1_0000,
        release: null,
        last_update: new Date((await page.locator(".update-time").innerText()).replace("更新时间:", "")!).toISOString(),
        completed: (await page.locator(".book-attribute").allInnerTexts()).some((attr) => attr.includes("完本")),
        rating: null,
    });
});

export const discover = create_discover(async function* (page, keyword: string) {
    try {
        await page.goto(`https://www.qidian.com/so/${keyword}.html`);

        const get_links = async (page: Page) =>
            await Promise.all(
                (await page.locator(".book-img-box").all()).map(
                    async (locator) => await locator.locator("a").getAttribute("src"),
                ),
            );

        while (true) {
            const links = await get_links(page);

            for (const link of links) {
                try {
                    yield new URL(link!);
                } catch (e) {}
            }

            const next = page.locator(".lbf-pagination-next").last();

            await Promise.all([
                new Promise<void>(async function _(resolve) {
                    if (JSON.stringify(links) === JSON.stringify(await get_links(page))) {
                        await sleep(1000);
                        _(resolve);
                    } else {
                        resolve();
                    }
                }),
                next.click(),
            ]);
        }
    } catch (e) {
        return;
    }
});

export const test = create_test(strategy, "https://www.qidian.com/book/1032982789");

process.env["TEST"] &&
    exec(async () => {
        console.log(await test());
    });
