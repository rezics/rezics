import { right } from "fp-ts/lib/Either.js";
import { create_discover, create_strategy, create_test } from "./base.js";
import { exec, sleep } from "../util.js";
import { chromium } from "../drivers/chromium.js";
import { expect } from "playwright/test";

export const platform = "ciweimao";
export const domain = "www.ciweimao.com";

/**
 * 创建书籍爬虫策略
 */
export const strategy = create_strategy(platform, domain, async (page, url, responses) => {
    let res = await page.goto(url.toString());

    while (res?.status() !== 200) {
        await sleep(3000);
        res = await page.reload();
    }

    const show = page.locator("a.btn-read-all");

    await show.last().click();
    await expect(show).toHaveCount(0);

    const cover_src = (await page.locator(".cover").locator("img").first().getAttribute("src"))!;

    return right({
        id: {},
        cover: (await responses.find((response) => response.url() === cover_src)!.body()).toString("base64"),
        title: (await page
            .locator(".title")
            .first()
            .evaluate(
                (element: HTMLElement) =>
                    Array.from(element.childNodes).filter((node) => node instanceof Text)[0]!.textContent,
            ))!.trim() as string,
        authors: [(await page.locator(".title").locator("span").locator("a").innerText())!.trim()],
        tags: await page.locator(".label-box").evaluate((element) =>
            Array.from(element.children)
                .filter((element) => element instanceof HTMLSpanElement)
                .map(({ innerText }) => innerText!.trim()),
        ),
        description: (await page.locator(".book-desc").innerText())!.trim(),
        units: await Promise.all(
            (await page.locator(".book-chapter-box").first().locator(".book-chapter-box").all()).map(
                async (volume) => ({
                    title: (await volume.evaluate((element) =>
                        Array.from(element.childNodes)
                            .filter((node) => node instanceof Text)[0]!
                            .textContent?.trim(),
                    ))!,
                    children: await volume.locator(".book-chapter-list").evaluate((element) =>
                        Array.from(element.children)
                            .filter((element) => element instanceof HTMLLIElement)
                            .map(({ innerText }) => ({ title: innerText!.trim() })),
                    ),
                }),
            ),
        ),
        completed: Boolean((await page.locator("p.update-state").first().innerText())?.includes("完结")),
        length: parseInt(
            (await page
                .locator(".book-property")
                .locator("span", { hasText: "完成字数" })
                .first()
                .locator("i")
                .innerText())!,
        ),
        last_update: new Date(
            (await page.locator("p.update-time").first().innerText()).match(/\[(.*)\]/)?.[1]!,
        ).toISOString(),
        release: null,
        rating: null,
    });
});

export const discover = create_discover(async function* (page): AsyncGenerator<URL> {
    await page.goto(`https://${domain}/book_list`, { waitUntil: "domcontentloaded" });

    try {
        while (true) {
            const links = (
                await Promise.all(
                    (await page.locator("table.book-list-table").locator("a").all()).map(
                        async (a) => await a.getAttribute("href"),
                    ),
                )
            ).filter((url) => url?.startsWith("https://www.ciweimao.com/book"));

            for (const link of links) {
                try {
                    yield new URL(link!);
                } catch (e) {}
            }

            const next = page.locator("ul.pagination").locator("li", { hasText: ">>" }).last();

            await Promise.all([page.waitForURL(/.*/), next.click()]);
        }
    } catch (e) {
        console.error(e);
        return;
    }
});

export const test = create_test(strategy, "https://www.ciweimao.com/book/100409881");

process.env["TEST"] &&
    exec(async () => {
        console.log(await test());

        const links = await discover(chromium);

        while (true) {
            console.log(JSON.stringify(await strategy(chromium, (await links.next()).value)));
        }
    });
