function setupGlobalErrorHandlers() {
    const REFRESH_FLAG_KEY = "__error_refresh_flag__";

    const refreshPageSafely = () => {
        const hasRefreshed = sessionStorage.getItem(REFRESH_FLAG_KEY);

        if (hasRefreshed) {
            console.warn("Detected repeated error after refresh. Skipping reload.");
            sessionStorage.removeItem(REFRESH_FLAG_KEY);
            return;
        }

        console.warn("Captured critical error. Refreshing page...");
        sessionStorage.setItem(REFRESH_FLAG_KEY, "1");
        window.location.reload();
    };

    // 捕捉同步錯誤
    window.onerror = function (message, source, lineno, colno, error) {
        console.error("Global Error:", message, source, lineno, colno, error);
        refreshPageSafely();
        return true;
    };

    // 捕捉未處理的 Promise 錯誤
    window.onunhandledrejection = function (event) {
        console.error("Unhandled Promise Rejection:", event.reason);
        refreshPageSafely();
    };
}
