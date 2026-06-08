import { createEnv } from "@t3-oss/env-core";
import * as v from "valibot";

export const env = createEnv({
  server: {
    NODE_ENV: v.optional(
      v.union([
        v.literal("development"),
        v.literal("test"),
        v.literal("production"),
      ]),
    ),

    /**
     * PostgreSQL connection string for the Reaction database.
     * Reaction 数据库的 PostgreSQL 连接字符串。
     */
    REACTION_DATABASE_URL: v.string(),

    /**
     * Shared secret for authenticating internal service-to-service calls.
     * 用于认证内部服务间调用的共享密钥。
     */
    REACTION_INTERNAL_SECRET: v.string(),

    /**
     * Server JWKS URL for verifying rezics-session-token JWTs.
     * 用于验证 rezics-session-token JWT 的 Server JWKS URL。
     */
    SERVER_JWKS_URL: v.string(),

    /**
     * Expected JWT issuer for rezics-session-token.
     * rezics-session-token 期望的 JWT 签发者。
     */
    SERVER_ISSUER: v.fallback(v.string(), "rezics-server"),

    /**
     * Comma-separated list of allowed reaction types.
     * 以逗号分隔的允许 reaction 类型列表。
     */
    REACTION_TYPES: v.fallback(v.string(), "upvote,downvote"),

    /**
     * Server HTTP listen port.
     * 服务器 HTTP 监听端口。
     */
    PORT: v.optional(v.string()),

    /**
     * Observability log output mode: local text or newline-delimited JSON.
     * 可观测性日志输出模式：本地文本或以换行分隔的 JSON。
     */
    OBSERVABILITY_LOG_FORMAT: v.optional(
      v.union([v.literal("local"), v.literal("json")]),
    ),
    /**
     * Enables ANSI color for local observability output.
     * 为本地可观测性输出启用 ANSI 颜色。
     */
    OBSERVABILITY_COLOR: v.optional(v.string()),
    /**
     * Slow HTTP request threshold in milliseconds.
     * 慢 HTTP 请求阈值，单位毫秒。
     */
    OBSERVABILITY_SLOW_REQUEST_MS: v.optional(v.string()),
    /**
     * OpenTelemetry mode: auto, disabled, enabled, or required.
     * OpenTelemetry 模式：auto、disabled、enabled 或 required。
     */
    OBSERVABILITY_TELEMETRY: v.optional(
      v.union([
        v.literal("auto"),
        v.literal("disabled"),
        v.literal("enabled"),
        v.literal("required"),
      ]),
    ),
    /**
     * OTLP HTTP traces endpoint. When omitted, telemetry export is disabled.
     * OTLP HTTP traces 端点。省略时禁用遥测导出。
     */
    OTEL_EXPORTER_OTLP_ENDPOINT: v.optional(v.string()),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});

/**
 * Parsed set of allowed reaction types for validation.
 * 已解析的允许 reaction 类型集合，用于校验。
 */
export const allowedReactionTypes = new Set(
  env.REACTION_TYPES.split(",")
    .map((t) => t.trim())
    .filter(Boolean),
);
