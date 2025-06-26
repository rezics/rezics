// 仅在开发环境启用 MSW

export const setupMock = async () => {
    if (import.meta.env.DEV) {
        const { worker } = await import("@/mock/browser");
        // await worker.start({ onUnhandledRequest: "bypass" });
        await worker.start({ onUnhandledRequest: "error"});
    }
};
