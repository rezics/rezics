import { Either } from "effect";
import { pipe } from "effect/Function";
import { Browser, Page, Response } from "playwright";
import { Book } from "../../schema.js";

export type Strategy = (driver: Browser, url: URL) => Promise<Either.Either<Book, string>>;

/**
 * 验证URL域名是否匹配
 */
const validateDomain = (url: URL, expectedDomain: string): Either.Either<URL, string> =>
    url.hostname === expectedDomain ? Either.right(url) : Either.left(`Domain must be ${expectedDomain}, got ${url.hostname}`);

/**
 * 清理URL参数
 */
const cleanUrlParams = (url: URL): URL => {
    const cleanUrl = new URL(url.toString());
    cleanUrl.searchParams.forEach((_, key) => cleanUrl.searchParams.delete(key));
    return cleanUrl;
};

/**
 * 安全地创建浏览器上下文
 */
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

/**
 * 安全地设置页面环境
 */
const setupPage = async (driver: Browser): Promise<{ page: Page; responses: Response[] }> => {
    const context = await create_context(driver);
    const page = await context.newPage();
    await page.setViewportSize({ width: 1920, height: 1080 });

    const responses: Response[] = [];
    page.on("response", (response) => responses.push(response));

    return { page, responses };
};

/**
 * 安全地清理资源
 */
const cleanup = async (page: Page): Promise<void> => {
    try {
        await page.close();
    } catch (error) {
        // 静默处理清理错误，不影响主要逻辑
        console.warn("Failed to close page:", error);
    }
};

/**
 * 将书籍数据与平台信息合并
 */
const enrichBookData =
    (platform: string, url: URL) =>
    (data: Omit<Book, "platform" | "link">): Book => ({
        ...data,
        platform,
        link: url.toString(),
    });

/**
 * 捕获并转换错误
 */
const catchToLeft = (error: unknown): Either.Either<never, string> =>
    Either.left(error instanceof Error ? error.message : String(error));

/**
 * 创建爬虫策略的高阶函数
 */
export const create_strategy =
    (
        platform: string,
        domain: string,
        extractor: (
            page: Page,
            url: URL,
            responses: Response[],
        ) => Promise<Either.Either<Omit<Book, "platform" | "link">, string>>,
    ): Strategy =>
    async (driver, url) => {
        // 验证域名
        const domainValidation = validateDomain(url, domain);
        if (Either.isLeft(domainValidation)) {
            return domainValidation;
        }

        // 清理URL
        const cleanUrl = cleanUrlParams(url);

        try {
            const { page, responses } = await setupPage(driver);

            try {
                const result = await extractor(page, cleanUrl, responses);

                return pipe(result, Either.map(enrichBookData(platform, cleanUrl)));
            } finally {
                await cleanup(page);
            }
        } catch (error) {
            return catchToLeft(error);
        }
    };

/**
 * 创建发现器的高阶函数
 *
 * 改进：
 * - 更好的错误处理
 * - 类型安全的参数传递
 */
export const create_discover =
    <T extends any[]>(discover: (page: Page, ...params: T) => AsyncGenerator<URL>) =>
    async (driver: Browser, ...params: T) => {
        try {
            const context = await create_context(driver);
            const page = await context.newPage();
            return discover(page, ...params);
        } catch (error) {
            throw new Error(`Failed to create discover: ${error instanceof Error ? error.message : String(error)}`);
        }
    };

/**
 * 创建测试函数
 *
 * 改进：
 * - 更好的错误处理
 * - 格式化的JSON输出
 */
export const create_test = (strategy: Strategy, url: string) => async (): Promise<string> => {
    try {
        const driver = (await import("../drivers/chromium.js")).chromium;
        const result = await strategy(driver, new URL(url));
        return JSON.stringify(result, null, 2);
    } catch (error) {
        const errorResult = Either.left(`Test failed: ${error instanceof Error ? error.message : String(error)}`);
        return JSON.stringify(errorResult, null, 2);
    }
};
