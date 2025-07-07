import React from "react";
import { createRoot } from "react-dom/client";

import App from "./App";

async function enableMocking() {
    if (process.env.NODE_ENV !== "development") {
        return;
    }

    const { worker } = await import("./mocks/browser");
    return worker.start();
}

async function consoleLogCustomMessage() {
    if (import.meta.env.DEV || process.env.NODE_ENV === "development") {
        console.log("consoleLogCustomMessage");
        const originalError = console.error;

        console.error = (...args: any[]) => {
            const msg = args[0]?.toString?.() || "";

            if (
                msg.includes("Warning: Instance created by `useForm`") ||
                msg.includes("Warning: [antd: Menu] `children` is deprecated") ||
                msg.includes("Warning: findDOMNode is deprecated")
            ) {
                return; // 忽略这些警告
            }

            originalError(...args); // 输出其他错误
        };
    }
}

enableMocking().then(() => {
    consoleLogCustomMessage();
    const container = document.getElementById("root");
    // eslint-disable-next-line
    const root = createRoot(container!);
    root.render(
        <React.StrictMode>
            <App />
        </React.StrictMode>,
    );
});
