import process from "node:process";

export function setupGlobalErrorHandlers() {
  const REFRESH_FLAG_KEY = "__error_refresh_flag__";

  const refreshPageSafely = () => {
    const hasRefreshed = sessionStorage.getItem(REFRESH_FLAG_KEY);

    if (hasRefreshed) {
      console.warn(
        "Detected repeated error after refresh. Skipping reload.",
      );
      sessionStorage.removeItem(REFRESH_FLAG_KEY);
      return;
    }

    console.warn("Captured critical error. Refreshing page...");
    sessionStorage.setItem(REFRESH_FLAG_KEY, "1");
    globalThis.location.reload();
  };

  const logError = (error: any) => {
    // Send error to a remote logging service
    console.log("Logging error to remote service:", error);
  };

  const notifyUser = (message: string) => {
    alert(message);
  };

  const isProduction = process.env.NODE_ENV === "production";

  globalThis.onerror = function(
    message: string | Event,
    source?: string,
    lineno?: number,
    colno?: number,
    error?: Error,
  ) {
    console.error("Global Error:", message, source, lineno, colno, error);
    logError({ message, source, lineno, colno, error });
    if (isProduction) {
      notifyUser("A critical error occurred. Please refresh the page.");
      refreshPageSafely();
    }
    return true;
  };

  globalThis.onunhandledrejection = function(event: PromiseRejectionEvent) {
    console.error("Unhandled Promise Rejection:", event.reason);
    logError(event.reason);
    if (isProduction) {
      notifyUser("An error occurred. Please try again later.");
      refreshPageSafely();
    }
  };
}
