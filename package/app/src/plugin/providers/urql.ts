import {
    createClient,
    cacheExchange,
    fetchExchange,
    type Exchange,
    Provider,
} from "urql";
import { retryExchange } from "@urql/exchange-retry";
import { devtoolsExchange } from "@urql/devtools";

// --- 2. 配置 Exchanges (交换) ---
const exchanges: Exchange[] = [
    cacheExchange,
    retryExchange({
        initialDelayMs: 1000,
        maxDelayMs: 15000,
        randomDelay: true,
        maxNumberAttempts: 3,
        retryIf: (err) => !!(err && err.networkError),
    }),
    fetchExchange,
];

// --- 3. 在开发环境中添加 Devtools Exchange ---
if (import.meta.env.DEV) {
    exchanges.unshift(devtoolsExchange);
}

// --- 4. 创建并导出 Client ---
const client = createClient({
    url: import.meta.env["VITE_GRAPHQL_URL"] || "http://localhost:4000/graphql",
    exchanges,
});

export { client, Provider as UrqlProvider };
