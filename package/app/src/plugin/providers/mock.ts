// 仅在开发环境启用 MSW

export const setupMock = async () => {
  if (import.meta.env.DEV) {
    const { worker } = await import("../../mock/browser.ts");
    await worker.start({
      onUnhandledRequest(request, _print) {
        // Ignore any requests containing "cdn.com" in their URL.
        if (request.url.includes("cover")) {
          return;
        }

        // Otherwise, print an unhandled request warning.
        console.log("MSW bypass:", request.url);
      },
    });
  }
};
