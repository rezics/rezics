import {
    createClient,
    cacheExchange,
    fetchExchange,
    type Exchange,
    Provider,
} from "urql";
import { retryExchange } from "@urql/exchange-retry";
import { devtoolsExchange } from "@urql/devtools";
import { authExchange } from "@urql/exchange-auth";

// --- 1. 身份验证逻辑 ---
const getAuthToken = (): string | null => {
    if (typeof window === "undefined") {
        return null;
    }
    return localStorage.getItem("authToken");
};

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
    authExchange(async (utils) => {
        const token = getAuthToken();

        return {
            addAuthToOperation(operation) {
                if (token) {
                    return utils.appendHeaders(operation, {
                        Authorization: `Bearer ${token}`,
                    });
                }
                return operation;
            },
            didAuthError(error) {
                return error.graphQLErrors.some(
                    (e) => e.extensions?.["code"] === "FORBIDDEN",
                );
            },
            async refreshAuth() {
                // TODO: Handle token refresh logic if your API supports it.
                // For now, we'll just clear the token.
                localStorage.removeItem("authToken");
            },
        };
    }),
    // we need to add timeoutExchange to handle the timeout of the request
    // timeoutExchange, 
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
