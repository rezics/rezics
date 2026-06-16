import { appRuntime } from "../../env";

// Enable MSW only in the dev environment.
// 仅在开发环境启用 MSW。

export const setupMock = async () => {
  if (appRuntime.isDev) {
    const { worker } = await import("../../mocks/browser.ts");
    await worker.start({
      onUnhandledRequest(request, _print) {
        // Ignore any requests containing "cdn.com" in their URL.
        // 忽略 URL 中包含 "cdn.com" 的任何请求。
        if (request.url.includes("cover")) {
          return;
        }

        // Otherwise, print an unhandled request warning.
        // 否则，打印一条未处理请求的警告。
        console.log("MSW bypass:", request.url);
      },
    });
  }
};
