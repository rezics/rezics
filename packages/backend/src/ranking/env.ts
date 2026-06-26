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
     * PostgreSQL connection string for the Ranking database.
     * Ranking 数据库的 PostgreSQL 连接字符串。
     */
    RANKING_DATABASE_URL: v.string(),

    /**
     * PostgreSQL connection string for current-state main database reads.
     * 用于读取当前状态主数据库的 PostgreSQL 连接字符串。
     */
    SERVER_DATABASE_URL: v.string(),

    /**
     * Meilisearch endpoint used for serving projection patches.
     * 用于提供投影补丁的 Meilisearch 端点。
     */
    MEILI_HOST: v.string(),

    /**
     * Meilisearch API key used for serving projection patches.
     * 用于提供投影补丁的 Meilisearch API key。
     */
    MEILI_MASTER_KEY: v.string(),

    /**
     * Server HTTP listen port.
     * 服务器 HTTP 监听端口。
     */
    PORT: v.optional(v.string()),

    /**
     * Default bounded full-sync page size.
     * 默认的有界全量同步分页大小。
     */
    RANKING_FULL_SYNC_LIMIT: v.optional(v.string()),

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
     * 慢 HTTP 请求阈值（毫秒）。
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
