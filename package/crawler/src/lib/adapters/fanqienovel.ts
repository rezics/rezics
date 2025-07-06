import { right } from "fp-ts/lib/Either.js";
import { create_strategy, create_test } from "./base.js";
import { Unit } from "../../schema.js";
import { exec } from "../util.js";

export const platform = "fanqienovel";
export const domain = "fanqienovel.com";

export const strategy = create_strategy(platform, domain, async (page, url, responses) => {
    await page.goto(url.toString());

    const cover_src = (await page.locator(".book-cover-img.loaded").getAttribute("src"))!;

    const tags = await page.locator(".info-label").evaluate((element) =>
        Array.from(element.children)
            .filter((child) => child instanceof HTMLElement)
            .map((child) => (child as HTMLElement).innerText!),
    );

    return right({
        id: {},
        cover: (await responses.find((response) => response.url() === cover_src)!.body()).toString("base64"),
        title: (await page.locator(".info-name").textContent())!,
        authors: [(await page.locator(".author-name-text").textContent())!],
        description: (await page.locator(".page-abstract-content").textContent())!,
        tags,
        units: await Promise.all(
            (await page.locator(".volume").all()).map((volume) =>
                volume.evaluate(async (volumeElement: HTMLElement) =>
                    Array.from(volumeElement.parentElement!.children)
                        .filter((element) => element instanceof HTMLElement)
                        .reduce(
                            (acc, cur) => {
                                if (cur.classList.contains("chapter")) {
                                    Array.from(cur.children)
                                        .filter((chapter) => chapter instanceof HTMLElement)
                                        .forEach((chapter) => acc.children.push({ title: chapter.innerText }));
                                }
                                return acc;
                            },
                            { title: volumeElement.innerText, children: [] as Unit[] },
                        ),
                ),
            ),
        ),
        completed: tags.some((tag) => tag.includes("完结")),
        length: parseInt(await page.locator(".info-count-word").locator(".detail").innerText()) * 1_0000,
        last_update: new Date(await page.locator(".info-last-time").first().innerText()).toISOString(),
        rating: null,
        release: null,
    });
});

export const test = create_test(strategy, "https://fanqienovel.com/page/7143038691944959011");

process.env["TEST"] &&
    exec(async () => {
        console.log(await test());
    });
