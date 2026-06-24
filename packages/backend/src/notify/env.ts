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
     * PostgreSQL connection string for the Notify database.
     * Notify 数据库的 PostgreSQL 连接字符串。
     */
    NOTIFY_DATABASE_URL: v.string(),

    /**
     * Shared secret for authenticating internal service-to-service calls.
     * 用于认证内部服务间调用的共享密钥。
     */
    NOTIFY_INTERNAL_SECRET: v.string(),

    /**
     * Server JWKS URL for verifying rezics-session-token JWTs.
     * 用于验证 rezics-session-token JWT 的服务端 JWKS URL。
     */
    SERVER_JWKS_URL: v.string(),

    /**
     * Expected JWT issuer for rezics-session-token.
     * rezics-session-token 期望的 JWT 签发者。
     */
    SERVER_ISSUER: v.fallback(v.string(), "rezics-server"),

    /**
     * Server HTTP listen port.
     * 服务端 HTTP 监听端口。
     */
    PORT: v.optional(v.string()),

    /**
     * Observability log output mode: local text or newline-delimited JSON.
     * 可观测性日志输出模式：本地文本或换行分隔的 JSON。
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
     * OTLP HTTP 追踪端点。省略时禁用遥测导出。
     */
    OTEL_EXPORTER_OTLP_ENDPOINT: v.optional(v.string()),

    /**
     * SMTP host. When unset, the email transport is a no-op stub that logs
     * the rendered message instead of delivering — useful in dev/CI.
     * SMTP 主机。未设置时，邮件传输为无操作占位实现，仅记录渲染后的消息而不实际投递——
     * 在 dev/CI 中很有用。
     */
    SMTP_HOST: v.optional(v.string()),
    SMTP_PORT: v.optional(v.string()),
    SMTP_USER: v.optional(v.string()),
    SMTP_PASSWORD: v.optional(v.string()),
    SMTP_FROM: v.optional(v.string()),
    SMTP_SECURE: v.optional(v.string()),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
