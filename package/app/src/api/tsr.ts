import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { initTsrReactQuery } from "@ts-rest/react-query/v5";
import { contract } from "../../../contract";
import { getAccessToken, refreshToken } from "./auth";

// 1. 创建并导出一个全局的 QueryClient
export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            retry: 2, // 请求失败时重试次数
            refetchOnWindowFocus: false, // 切回窗口是否重新获取
            staleTime: 5 * 60 * 1000, // 数据过期时间：5 分钟
            gcTime: 30 * 60 * 1000, // 缓存保留时间：30 分钟 (renamed in React Query v5)
        },
        mutations: {
            retry: 1, // 变更操作重试次数
        },
    },
});

// 2. 定义一个自带自动刷新 Token 的 fetcher
async function authFetch(input: RequestInfo, init?: RequestInit) {
    const token = await getAccessToken();
    const headers: Record<string, string> = {
        ...(init?.headers as Record<string, string>),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        "Content-Type": "application/json",
    };

    let response = await fetch(input, { ...init, headers });
    if (response.status === 401) {
        // Token 失效，尝试刷新
        const newToken = await refreshToken();
        if (newToken) {
            const retryHeaders = {
                ...headers,
                Authorization: `Bearer ${newToken}`,
            };
            response = await fetch(input, { ...init, headers: retryHeaders });
        }
    }

    return response;
}

// 3. 初始化 ts-rest/react-query 客户端
export const tsr = initTsrReactQuery(contract, {
    baseUrl: process.env["NEXT_PUBLIC_API_BASE_URL"] || "http://localhost:35001",
    baseHeaders: {
        // 动态读取 Token
        Authorization: () => {
            const token = getAccessToken();
            return token ? `Bearer ${token}` : "";
        },
        "X-App-Version": process.env["APP_VERSION"] || "1.0.0",
    },
    // 使用自定义 fetch 实现自动刷新逻辑
    fetch: authFetch,
    queryClient,
});

// 4. 导出 Provider 组件，方便在应用中统一挂载
export function TsrProvider({ children }: { children: React.ReactNode }) {
    return React.createElement(
        QueryClientProvider,
        { client: queryClient },
        React.createElement(tsr.ReactQueryProvider, null, children),
    );
}

// 5. 便捷获取 ts-rest QueryClient (for invalidateQueries 等)
export const useTsrQueryClient = () => tsr.useQueryClient();

// 默认导出
export default tsr;
