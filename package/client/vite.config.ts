import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "node:path";
import process from "node:process";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), "ICS");

    return {
        plugins: [tailwindcss(), react()],
        server: {
            port: 35001,
        },
        resolve: {
            alias: {
                "@": resolve(__dirname, "./src"),
                "@component": resolve(__dirname, "./src/component"),
                "@page": resolve(__dirname, "./src/page"),
                "@util": resolve(__dirname, "./src/util"),
                "@locale": resolve(__dirname, "./src/locale/index.ts"),
                // Local workspace aliases so the client can run without pnpm workspaces
                contract: resolve(__dirname, "../contract/src/index.ts"),
                "contract/": resolve(__dirname, "../contract/src"),
            },
        },
        define: {
            "process.env": env,
        },
    };
});
